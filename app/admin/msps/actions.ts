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
