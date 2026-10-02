"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AdminMspActionState = {
  status: "idle" | "success" | "error";
  message: string;
  completed?: boolean;
};

const taskSchema = z.object({ mspId: z.uuid(), taskId: z.uuid() });
const noteSchema = taskSchema.extend({ body: z.string().trim().min(1).max(5000) });
const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.url().optional(),
);
const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.email().transform((value) => value.trim().toLowerCase()).optional(),
);
const optionalName = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(2).max(120).optional(),
);
const settingsSchema = z
  .object({
    contactEmail: optionalEmail,
    contactName: optionalName,
    mspId: z.uuid(),
    name: z.string().trim().min(2).max(120),
    status: z.enum(["active", "deactivated"]),
    website: optionalUrl,
  })
  .refine((value) => Boolean(value.contactEmail) === Boolean(value.contactName), {
    message: "Provide both a contact name and email, or leave both blank.",
  });

async function validateTask(mspId: string, taskId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ data: msp }, { data: task }] = await Promise.all([
    supabase.from("msps").select("id, cohort_id").eq("id", mspId).maybeSingle(),
    supabase.from("cohort_tasks").select("id, cohort_id, owner_type, kind").eq("id", taskId).maybeSingle(),
  ]);
  return { msp, supabase, task: msp && task?.cohort_id === msp.cohort_id ? task : null };
}

export async function toggleAdminTask(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  const admin = await requireAdminProfile();
  const parsed = taskSchema.safeParse({ mspId: formData.get("mspId"), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "That task is not available." };

  const { msp, supabase, task } = await validateTask(parsed.data.mspId, parsed.data.taskId);
  if (!msp || !task || (task.owner_type !== "lemhi" && task.kind !== "checkpoint")) {
    return { status: "error", message: "Only Lemhi-owned work can be updated here." };
  }

  const { data: completion } = await supabase
    .from("task_completions")
    .select("cohort_task_id")
    .eq("msp_id", msp.id)
    .eq("cohort_task_id", task.id)
    .maybeSingle();

  if (completion) {
    const { error } = await supabase.from("task_completions").delete().eq("msp_id", msp.id).eq("cohort_task_id", task.id);
    if (error) return { status: "error", message: "The task could not be reopened." };
    revalidatePath(`/admin/msps/${msp.id}`);
    return { status: "success", message: "Task reopened.", completed: false };
  }

  const { error } = await supabase.from("task_completions").insert({
    cohort_task_id: task.id,
    completed_by: admin.id,
    msp_id: msp.id,
  });
  if (error) return { status: "error", message: "The task could not be completed." };
  revalidatePath(`/admin/msps/${msp.id}`);
  return { status: "success", message: "Task completed.", completed: true };
}

export async function addAdminTaskNote(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  const admin = await requireAdminProfile();
  const parsed = noteSchema.safeParse({ body: formData.get("body"), mspId: formData.get("mspId"), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "Write a note before posting." };
  const { msp, supabase, task } = await validateTask(parsed.data.mspId, parsed.data.taskId);
  if (!msp || !task) return { status: "error", message: "That task is not available." };

  const { error } = await supabase.from("task_notes").insert({
    author_id: admin.id,
    body: parsed.data.body,
    cohort_task_id: task.id,
    msp_id: msp.id,
  });
  if (error) return { status: "error", message: "The note could not be posted." };
  revalidatePath(`/admin/msps/${msp.id}`);
  return { status: "success", message: "Note posted." };
}

export async function updateMspSettings(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  await requireAdminProfile();
  const parsed = settingsSchema.safeParse({
    contactEmail: formData.get("contactEmail"),
    contactName: formData.get("contactName"),
    mspId: formData.get("mspId"),
    name: formData.get("name"),
    status: formData.get("status"),
    website: formData.get("website"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Enter valid company details and include both main-contact fields or neither." };
  }

  const supabase = await createServerSupabaseClient();
  const { data: owner } = await supabase
    .from("profiles")
    .select("email")
    .eq("msp_id", parsed.data.mspId)
    .eq("role", "msp_owner")
    .eq("active", true)
    .maybeSingle();

  if (owner && owner.email.toLowerCase() !== parsed.data.contactEmail?.toLowerCase()) {
    return {
      status: "error",
      message: "The active owner’s email cannot be changed here. Deactivate or transfer that account first.",
    };
  }

  const { error } = await supabase
    .from("msps")
    .update({
      name: parsed.data.name,
      primary_contact_email: parsed.data.contactEmail ?? null,
      primary_contact_name: parsed.data.contactName ?? null,
      status: parsed.data.status,
      website: parsed.data.website ?? null,
    })
    .eq("id", parsed.data.mspId);

  if (error) {
    console.error("MSP settings update failed", error);
    return {
      status: "error",
      message: error.code === "23505"
        ? "That contact email is already assigned to another MSP."
        : "The MSP settings could not be saved.",
    };
  }

  revalidatePath(`/admin/msps/${parsed.data.mspId}`);
  revalidatePath("/admin");
  return { status: "success", message: "MSP settings saved." };
}

const hideSchema = taskSchema.extend({ hidden: z.enum(["true", "false"]) });
const extraTaskSchema = z.object({
  cohortWeekId: z.uuid(),
  description: z.string().trim().max(2000),
  kind: z.enum(["task", "checkpoint"]),
  mspId: z.uuid(),
  ownerLabel: z.string().trim().min(2).max(120),
  ownerType: z.enum(["msp", "lemhi"]),
  title: z.string().trim().min(2).max(200),
});

export async function setTaskHiddenForMsp(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  const profile = await requireAdminProfile();
  const parsed = hideSchema.safeParse({
    hidden: formData.get("hidden"),
    mspId: formData.get("mspId"),
    taskId: formData.get("taskId"),
  });
  if (!parsed.success) return { status: "error", message: "That task could not be found." };

  const { msp, supabase, task } = await validateTask(parsed.data.mspId, parsed.data.taskId);
  if (!msp || !task) return { status: "error", message: "That task could not be found." };

  // The database only allows hiding an active program task in the MSP's cohort.
  const { error } = parsed.data.hidden === "true"
    ? await supabase.from("msp_hidden_tasks").upsert(
      { cohort_task_id: task.id, hidden_by: profile.id, msp_id: msp.id },
      { ignoreDuplicates: true, onConflict: "msp_id,cohort_task_id" },
    )
    : await supabase.from("msp_hidden_tasks").delete().eq("msp_id", msp.id).eq("cohort_task_id", task.id);

  if (error) {
    console.error("Task visibility update failed", error);
    return { status: "error", message: "The task could not be updated." };
  }

  revalidatePath(`/admin/msps/${msp.id}`);
  revalidatePath("/admin");
  return { status: "success", message: parsed.data.hidden === "true" ? "Hidden for this MSP." : "Shown again." };
}

export async function addExtraTask(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  await requireAdminProfile();
  const parsed = extraTaskSchema.safeParse({
    cohortWeekId: formData.get("cohortWeekId"),
    description: formData.get("description") ?? "",
    kind: formData.get("kind"),
    mspId: formData.get("mspId"),
    ownerLabel: formData.get("ownerLabel"),
    ownerType: formData.get("ownerType"),
    title: formData.get("title"),
  });
  if (!parsed.success) return { status: "error", message: "Enter a title and who owns the task." };

  const supabase = await createServerSupabaseClient();
  const [{ data: msp }, { data: week }] = await Promise.all([
    supabase.from("msps").select("id, cohort_id").eq("id", parsed.data.mspId).maybeSingle(),
    supabase.from("cohort_weeks").select("id, cohort_id").eq("id", parsed.data.cohortWeekId).maybeSingle(),
  ]);
  if (!msp || !week || week.cohort_id !== msp.cohort_id) return { status: "error", message: "That week could not be found." };

  // Extra tasks come after everything this MSP already has in the week.
  const { data: last } = await supabase
    .from("cohort_tasks")
    .select("position")
    .eq("cohort_week_id", week.id)
    .or(`msp_id.is.null,msp_id.eq.${msp.id}`)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("cohort_tasks").insert({
    cohort_id: msp.cohort_id,
    cohort_week_id: week.id,
    description: parsed.data.description,
    kind: parsed.data.kind,
    msp_id: msp.id,
    owner_label: parsed.data.ownerLabel,
    owner_type: parsed.data.ownerType,
    position: (last?.[0]?.position ?? 0) + 1,
    title: parsed.data.title,
  });

  if (error) {
    console.error("Extra task creation failed", error);
    return { status: "error", message: "The task could not be added." };
  }

  revalidatePath(`/admin/msps/${msp.id}`);
  revalidatePath("/admin");
  return { status: "success", message: "Task added for this MSP." };
}

export async function removeExtraTask(
  _previousState: AdminMspActionState,
  formData: FormData,
): Promise<AdminMspActionState> {
  await requireAdminProfile();
  const parsed = taskSchema.safeParse({ mspId: formData.get("mspId"), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "That task could not be found." };

  // Archive rather than delete, so any completion history is kept.
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("cohort_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.taskId)
    .eq("msp_id", parsed.data.mspId)
    .is("archived_at", null)
    .select("id");

  if (error || !data?.length) {
    console.error("Extra task removal failed", error);
    return { status: "error", message: "The task could not be removed." };
  }

  revalidatePath(`/admin/msps/${parsed.data.mspId}`);
  revalidatePath("/admin");
  return { status: "success", message: "Removed." };
}
