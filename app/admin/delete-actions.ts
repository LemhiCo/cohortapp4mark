"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type DeleteWorkspaceState = {
  status: "idle" | "error";
  message: string;
};

const confirmationSchema = z.object({
  acknowledgement: z.literal("on"),
  confirmationName: z.string().trim().min(1).max(160),
  ownerEmail: z.email().transform((value) => value.trim().toLowerCase()),
  reason: z.string().trim().min(10).max(500),
});

const cohortDeleteSchema = confirmationSchema.extend({ cohortId: z.uuid() });
const mspDeleteSchema = confirmationSchema.extend({ mspId: z.uuid() });

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type TargetType = "cohort" | "msp";

function inputError(): DeleteWorkspaceState {
  return {
    status: "error",
    message: "Enter a reason of at least 10 characters, your signed-in email, the exact name, and acknowledge permanent deletion.",
  };
}

function validateConfirmation(
  input: z.infer<typeof confirmationSchema>,
  targetName: string,
  signedInEmail: string,
): DeleteWorkspaceState | null {
  if (input.ownerEmail !== signedInEmail.toLowerCase()) {
    return { status: "error", message: `The deletion owner must be your signed-in email: ${signedInEmail}` };
  }
  if (input.confirmationName !== targetName) {
    return { status: "error", message: `Type “${targetName}” exactly to confirm deletion.` };
  }
  return null;
}

async function createAudit(
  admin: AdminClient,
  input: z.infer<typeof confirmationSchema>,
  actorId: string,
  target: { id: string; name: string; type: TargetType },
) {
  const { data, error } = await admin
    .from("admin_deletion_audit")
    .insert({
      deleted_by: actorId,
      owner_email: input.ownerEmail,
      reason: input.reason,
      status: "requested",
      target_id: target.id,
      target_name: target.name,
      target_type: target.type,
    })
    .select("id")
    .single();

  if (error || !data) throw error ?? new Error("Deletion audit could not be created.");
  return data.id;
}

async function setAuditStatus(
  admin: AdminClient,
  auditId: string,
  status: "completed" | "failed",
  failureMessage?: string,
) {
  const { error } = await admin
    .from("admin_deletion_audit")
    .update({
      completed_at: status === "completed" ? new Date().toISOString() : null,
      failure_message: failureMessage ?? null,
      status,
    })
    .eq("id", auditId);
  if (error) console.error("Deletion audit update failed", auditId, error);
}

async function removeStorageObjects(admin: AdminClient, bucket: "msp-logos" | "portal-assets", paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const { error } = await admin.storage.from(bucket).remove(uniquePaths.slice(index, index + 100));
    if (error) console.error("Deleted workspace left private storage objects behind", bucket, error);
  }
}

async function deleteMspRecords(admin: AdminClient, mspIds: string[]) {
  if (!mspIds.length) return;

  const [{ data: people, error: peopleError }, { data: assets, error: assetsError }, { data: msps, error: mspsError }] = await Promise.all([
    admin.from("profiles").select("id").in("msp_id", mspIds),
    admin.from("assets").select("storage_path").in("msp_id", mspIds),
    admin.from("msps").select("id, logo_path").in("id", mspIds),
  ]);
  if (peopleError || assetsError || mspsError) throw peopleError ?? assetsError ?? mspsError;

  const cleanupResults = await Promise.all([
    admin.from("task_notes").delete().in("msp_id", mspIds),
    admin.from("task_completions").delete().in("msp_id", mspIds),
    admin.from("msp_hidden_tasks").delete().in("msp_id", mspIds),
    admin.from("activity_events").delete().in("msp_id", mspIds),
  ]);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) throw cleanupError;

  // Invitations can reference an MSP owner as the inviter with ON DELETE
  // RESTRICT, so remove the portal's invitations before deleting profiles.
  const { error: invitationDeleteError } = await admin.from("invitations").delete().in("msp_id", mspIds);
  if (invitationDeleteError) throw invitationDeleteError;

  const userIds = (people ?? []).map((person) => person.id);
  if (userIds.length) {
    const { error } = await admin.from("profiles").delete().in("id", userIds);
    if (error) throw error;
  }

  const { error: mspDeleteError } = await admin.from("msps").delete().in("id", mspIds);
  if (mspDeleteError) throw mspDeleteError;

  // App access is already gone once the profiles are deleted. Remove the
  // corresponding Auth users as a final cleanup, without risking a rollback
  // of the completed workspace deletion if Supabase Auth is temporarily down.
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error("Deleted workspace left an inaccessible Auth user behind", userId, error);
  }

  await Promise.all([
    removeStorageObjects(admin, "portal-assets", (assets ?? []).flatMap((asset) => asset.storage_path ? [asset.storage_path] : [])),
    removeStorageObjects(admin, "msp-logos", (msps ?? []).flatMap((msp) => msp.logo_path ? [msp.logo_path] : [])),
  ]);
}

export async function deleteMspPortal(
  _previousState: DeleteWorkspaceState,
  formData: FormData,
): Promise<DeleteWorkspaceState> {
  const actor = await requireAdminProfile();
  const parsed = mspDeleteSchema.safeParse({
    acknowledgement: formData.get("acknowledgement"),
    confirmationName: formData.get("confirmationName"),
    mspId: formData.get("mspId"),
    ownerEmail: formData.get("ownerEmail"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return inputError();

  const admin = createAdminSupabaseClient();
  const { data: msp } = await admin.from("msps").select("id, name").eq("id", parsed.data.mspId).maybeSingle();
  if (!msp) return { status: "error", message: "That MSP portal no longer exists." };

  const confirmationError = validateConfirmation(parsed.data, msp.name, actor.email);
  if (confirmationError) return confirmationError;

  let auditId: string;
  try {
    auditId = await createAudit(admin, parsed.data, actor.id, { id: msp.id, name: msp.name, type: "msp" });
  } catch (error) {
    console.error("MSP deletion audit creation failed", error);
    return { status: "error", message: "The deletion could not be audited, so nothing was deleted." };
  }

  try {
    await deleteMspRecords(admin, [msp.id]);
    await setAuditStatus(admin, auditId, "completed");
  } catch (error) {
    console.error("MSP deletion failed", msp.id, error);
    await setAuditStatus(admin, auditId, "failed", "Workspace deletion failed before completion.");
    return { status: "error", message: "The MSP portal could not be completely deleted. Contact engineering before retrying." };
  }

  redirect("/admin");
}

export async function deleteCohort(
  _previousState: DeleteWorkspaceState,
  formData: FormData,
): Promise<DeleteWorkspaceState> {
  const actor = await requireAdminProfile();
  const parsed = cohortDeleteSchema.safeParse({
    acknowledgement: formData.get("acknowledgement"),
    cohortId: formData.get("cohortId"),
    confirmationName: formData.get("confirmationName"),
    ownerEmail: formData.get("ownerEmail"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return inputError();

  const admin = createAdminSupabaseClient();
  const { data: cohort } = await admin.from("cohorts").select("id, name").eq("id", parsed.data.cohortId).maybeSingle();
  if (!cohort) return { status: "error", message: "That cohort no longer exists." };

  const confirmationError = validateConfirmation(parsed.data, cohort.name, actor.email);
  if (confirmationError) return confirmationError;

  let auditId: string;
  try {
    auditId = await createAudit(admin, parsed.data, actor.id, { id: cohort.id, name: cohort.name, type: "cohort" });
  } catch (error) {
    console.error("Cohort deletion audit creation failed", error);
    return { status: "error", message: "The deletion could not be audited, so nothing was deleted." };
  }

  try {
    const [{ data: msps, error: mspsError }, { data: assets, error: assetsError }] = await Promise.all([
      admin.from("msps").select("id").eq("cohort_id", cohort.id),
      admin.from("assets").select("storage_path").eq("cohort_id", cohort.id),
    ]);
    if (mspsError || assetsError) throw mspsError ?? assetsError;

    await deleteMspRecords(admin, (msps ?? []).map((msp) => msp.id));
    const { error: cohortDeleteError } = await admin.from("cohorts").delete().eq("id", cohort.id);
    if (cohortDeleteError) throw cohortDeleteError;

    await removeStorageObjects(admin, "portal-assets", (assets ?? []).flatMap((asset) => asset.storage_path ? [asset.storage_path] : []));
    await setAuditStatus(admin, auditId, "completed");
  } catch (error) {
    console.error("Cohort deletion failed", cohort.id, error);
    await setAuditStatus(admin, auditId, "failed", "Cohort deletion failed before completion.");
    return { status: "error", message: "The cohort could not be completely deleted. Contact engineering before retrying." };
  }

  redirect("/admin");
}
