"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMspProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ChecklistActionState = {
  status: "idle" | "success" | "error";
  message: string;
  completed?: boolean;
};

const taskSchema = z.object({ taskId: z.uuid() });
const noteSchema = taskSchema.extend({ body: z.string().trim().min(1).max(5000) });

export async function toggleTaskCompletion(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const profile = await requireMspProfile();
  const parsed = taskSchema.safeParse({ taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "That task is not available." };

  const supabase = await createServerSupabaseClient();
  const { data: task } = await supabase
    .from("cohort_tasks")
    .select("id, owner_type, kind")
    .eq("id", parsed.data.taskId)
    .maybeSingle();

  if (!task || task.owner_type !== "msp" || task.kind !== "task") {
    return { status: "error", message: "Only MSP-owned tasks can be updated here." };
  }

  const { data: completion } = await supabase
    .from("task_completions")
    .select("cohort_task_id")
    .eq("msp_id", profile.msp_id)
    .eq("cohort_task_id", task.id)
    .maybeSingle();

  if (completion) {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("msp_id", profile.msp_id)
      .eq("cohort_task_id", task.id);
    if (error) return { status: "error", message: "This task can no longer be changed." };
    revalidatePath("/checklist");
    revalidatePath("/cohort");
    return { status: "success", message: "Task reopened.", completed: false };
  }

  const { error } = await supabase.from("task_completions").insert({
    cohort_task_id: task.id,
    completed_by: profile.id,
    msp_id: profile.msp_id,
  });

  if (error) return { status: "error", message: "This task can no longer be changed." };
  revalidatePath("/checklist");
  revalidatePath("/cohort");
  return { status: "success", message: "Task completed.", completed: true };
}

export async function addTaskNote(
  _previousState: ChecklistActionState,
  formData: FormData,
): Promise<ChecklistActionState> {
  const profile = await requireMspProfile();
  const parsed = noteSchema.safeParse({ body: formData.get("body"), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "Write a note before posting." };

  const supabase = await createServerSupabaseClient();
  const { data: task } = await supabase
    .from("cohort_tasks")
    .select("id")
    .eq("id", parsed.data.taskId)
    .maybeSingle();

  if (!task) return { status: "error", message: "That task is not available." };

  const { error } = await supabase.from("task_notes").insert({
    author_id: profile.id,
    body: parsed.data.body,
    cohort_task_id: task.id,
    msp_id: profile.msp_id,
  });

  if (error) return { status: "error", message: "Notes are read-only after the cohort ends." };
  revalidatePath("/checklist");
  return { status: "success", message: "Note posted." };
}
