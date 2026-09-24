"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { sendPortalInvitation } from "@/lib/invitations";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type InviteActionState = AdminActionState;

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);

const createCohortSchema = z.object({
  leadId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  sessionTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  sessionWeekday: z.coerce.number().int().min(0).max(6),
  startDate: z.iso.date(),
  timezone: z.string().trim().min(1).max(80),
});

const createMspPortalSchema = z.object({
  cohortId: z.uuid(),
  contactEmail: z.email().transform((value) => value.trim().toLowerCase()),
  contactName: z.string().trim().min(2).max(120),
  mspName: z.string().trim().min(2).max(120),
  website: optionalUrl,
});

const updateSessionSchema = z.object({
  cohortId: z.uuid(),
  joinUrl: optionalUrl,
  localStartsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  sessionId: z.uuid(),
  title: z.string().trim().min(2).max(160),
});

const inviteOwnerSchema = z.object({
  email: z.email().transform((value) => value.trim().toLowerCase()),
  fullName: z.string().trim().min(2).max(120),
  mspId: z.uuid(),
});

export async function createCohort(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = createCohortSchema.safeParse({
    leadId: formData.get("leadId"),
    name: formData.get("name"),
    sessionTime: formData.get("sessionTime"),
    sessionWeekday: formData.get("sessionWeekday"),
    startDate: formData.get("startDate"),
    timezone: formData.get("timezone"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Complete every cohort field with a valid value." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id")
    .eq("active", true)
    .maybeSingle();

  if (!program) return { status: "error", message: "No active program template is available." };

  const { data: lead } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.leadId)
    .eq("role", "lemhi_admin")
    .eq("active", true)
    .maybeSingle();

  if (!lead) return { status: "error", message: "Choose an active Lemhi lead." };

  const { data: cohort, error } = await supabase
    .from("cohorts")
    .insert({
      lead_id: parsed.data.leadId,
      name: parsed.data.name,
      program_id: program.id,
      session_time: parsed.data.sessionTime,
      session_weekday: parsed.data.sessionWeekday,
      start_date: parsed.data.startDate,
      timezone: parsed.data.timezone,
    })
    .select("id")
    .single();

  if (error || !cohort) {
    console.error("Cohort creation failed", error);
    return {
      status: "error",
      message: error?.code === "23505" ? "A cohort with that name already exists." : "The cohort could not be created.",
    };
  }

  revalidatePath("/admin");
  redirect(`/admin/cohorts/${cohort.id}`);
}

export async function createMspPortal(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const inviter = await requireAdminProfile();
  const parsed = createMspPortalSchema.safeParse({
    cohortId: formData.get("cohortId"),
    contactEmail: formData.get("contactEmail"),
    contactName: formData.get("contactName"),
    mspName: formData.get("mspName"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter an MSP name, contact, valid email, and optional full website URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id")
    .eq("id", parsed.data.cohortId)
    .maybeSingle();

  if (!cohort) return { status: "error", message: "That cohort is not available." };

  const { data: msp, error: mspError } = await supabase
    .from("msps")
    .insert({
      cohort_id: cohort.id,
      name: parsed.data.mspName,
      website: parsed.data.website ?? null,
    })
    .select("id")
    .single();

  if (mspError || !msp) {
    console.error("MSP portal creation failed", mspError);
    return {
      status: "error",
      message: mspError?.code === "23505" ? "That MSP already has a portal in this cohort." : "The MSP portal could not be created.",
    };
  }

  const result = await sendPortalInvitation({
    email: parsed.data.contactEmail,
    fullName: parsed.data.contactName,
    invitedBy: inviter.id,
    mspId: msp.id,
    redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/confirm`,
    role: "msp_owner",
  });

  if (!result.ok) {
    const admin = createAdminSupabaseClient();
    const { error: cleanupError } = await admin.from("msps").delete().eq("id", msp.id);
    if (cleanupError) console.error("MSP portal cleanup failed", cleanupError);
    return { status: "error", message: result.message };
  }

  revalidatePath(`/admin/cohorts/${cohort.id}`);
  revalidatePath("/admin");
  return { status: "success", message: `${parsed.data.mspName} is ready. ${result.message}` };
}

export async function updateGroupSession(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdminProfile();
  const parsed = updateSessionSchema.safeParse({
    cohortId: formData.get("cohortId"),
    joinUrl: formData.get("joinUrl"),
    localStartsAt: formData.get("localStartsAt"),
    sessionId: formData.get("sessionId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter a title, local date and time, and optional full meeting URL." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", parsed.data.sessionId)
    .eq("cohort_id", parsed.data.cohortId)
    .eq("kind", "group")
    .maybeSingle();

  if (!session) return { status: "error", message: "That cohort session is not available." };

  const { error } = await supabase.rpc("update_group_session_local", {
    local_starts_at: parsed.data.localStartsAt.replace("T", " "),
    target_join_url: parsed.data.joinUrl ?? "",
    target_session_id: session.id,
    target_title: parsed.data.title,
  });

  if (error) {
    console.error("Session update failed", error);
    return { status: "error", message: "The session could not be updated." };
  }

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  return { status: "success", message: "Session updated." };
}

export async function inviteMspOwner(
  _previousState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const inviter = await requireAdminProfile();
  const parsed = inviteOwnerSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    mspId: formData.get("mspId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter a name, valid email, and MSP portal." };
  }

  const admin = createAdminSupabaseClient();
  const { data: msp } = await admin
    .from("msps")
    .select("id")
    .eq("id", parsed.data.mspId)
    .eq("status", "active")
    .maybeSingle();

  if (!msp) return { status: "error", message: "That MSP portal is not active." };

  const result = await sendPortalInvitation({
    ...parsed.data,
    invitedBy: inviter.id,
    redirectTo: `${process.env.APP_URL ?? "http://localhost:3000"}/auth/confirm`,
    role: "msp_owner",
  });

  if (!result.ok) return { status: "error", message: result.message };
  revalidatePath("/admin");
  return { status: "success", message: result.message };
}
