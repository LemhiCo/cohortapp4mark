"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProgramActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

const weekSchema = z.object({
  goal: z.string().trim().min(2).max(1000),
  subtitle: z.string().trim().min(2).max(300),
  title: z.string().trim().min(2).max(120),
  weekId: z.uuid(),
});

const taskFields = {
  description: z.string().trim().max(2000),
  kind: z.enum(["task", "checkpoint"]),
  ownerLabel: z.string().trim().min(2).max(120),
  ownerType: z.enum(["msp", "lemhi"]),
  title: z.string().trim().min(2).max(200),
};
const taskUpdateSchema = z.object({ ...taskFields, taskId: z.uuid() });
const taskCreateSchema = z.object({ ...taskFields, weekId: z.uuid() });
const archiveSchema = z.object({ archived: z.enum(["true", "false"]), taskId: z.uuid() });

function taskInput(formData: FormData) {
  return {
    description: formData.get("description") ?? "",
    kind: formData.get("kind"),
    ownerLabel: formData.get("ownerLabel"),
    ownerType: formData.get("ownerType"),
    title: formData.get("title"),
  };
}

// Program changes reach every cohort that hasn't ended through database
// triggers, so every admin and MSP page that shows the checklist can change.
function revalidateChecklists() {
  revalidatePath("/admin/program");
  revalidatePath("/admin");
  revalidatePath("/admin/msps/[mspId]", "page");
  revalidatePath("/checklist");
  revalidatePath("/cohort");
}

export async function updateProgramWeek(_previous: ProgramActionState, formData: FormData): Promise<ProgramActionState> {
  await requireAdminProfile();
  const parsed = weekSchema.safeParse({
    goal: formData.get("goal"),
    subtitle: formData.get("subtitle"),
    title: formData.get("title"),
    weekId: formData.get("weekId"),
  });
  if (!parsed.success) return { status: "error", message: "Enter a title, subtitle, and goal." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("program_weeks")
    .update({ goal: parsed.data.goal, subtitle: parsed.data.subtitle, title: parsed.data.title })
    .eq("id", parsed.data.weekId)
    .select("id");
  if (error || !data?.length) {
    console.error("Program week update failed", error);
    return { status: "error", message: "The week could not be saved." };
  }

  revalidateChecklists();
  return { status: "success", message: "Week saved." };
}

export async function updateProgramTask(_previous: ProgramActionState, formData: FormData): Promise<ProgramActionState> {
  await requireAdminProfile();
  const parsed = taskUpdateSchema.safeParse({ ...taskInput(formData), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "Enter a title and who owns the task." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("program_tasks")
    .update({
      description: parsed.data.description,
      kind: parsed.data.kind,
      owner_label: parsed.data.ownerLabel,
      owner_type: parsed.data.ownerType,
      title: parsed.data.title,
    })
    .eq("id", parsed.data.taskId)
    .select("id");
  if (error || !data?.length) {
    console.error("Program task update failed", error);
    return { status: "error", message: "The task could not be saved." };
  }

  revalidateChecklists();
  return { status: "success", message: "Task saved." };
}

export async function addProgramTask(_previous: ProgramActionState, formData: FormData): Promise<ProgramActionState> {
  await requireAdminProfile();
  const parsed = taskCreateSchema.safeParse({ ...taskInput(formData), weekId: formData.get("weekId") });
  if (!parsed.success) return { status: "error", message: "Enter a title and who owns the task." };

  const supabase = await createServerSupabaseClient();
  const { data: week } = await supabase.from("program_weeks").select("id, program_id").eq("id", parsed.data.weekId).maybeSingle();
  if (!week) return { status: "error", message: "That week could not be found." };

  // Counting archived tasks too means a restored task never collides with a
  // newer one for the same position.
  const { data: last } = await supabase
    .from("program_tasks")
    .select("position")
    .eq("week_id", week.id)
    .order("position", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("program_tasks").insert({
    description: parsed.data.description,
    kind: parsed.data.kind,
    owner_label: parsed.data.ownerLabel,
    owner_type: parsed.data.ownerType,
    position: (last?.[0]?.position ?? 0) + 1,
    program_id: week.program_id,
    title: parsed.data.title,
    week_id: week.id,
  });
  if (error) {
    console.error("Program task creation failed", error);
    return { status: "error", message: "The task could not be added." };
  }

  revalidateChecklists();
  return { status: "success", message: "Task added to every running cohort." };
}

export async function setProgramTaskArchived(_previous: ProgramActionState, formData: FormData): Promise<ProgramActionState> {
  await requireAdminProfile();
  const parsed = archiveSchema.safeParse({ archived: formData.get("archived"), taskId: formData.get("taskId") });
  if (!parsed.success) return { status: "error", message: "That task could not be found." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("program_tasks")
    .update({ archived_at: parsed.data.archived === "true" ? new Date().toISOString() : null })
    .eq("id", parsed.data.taskId)
    .select("id");
  if (error || !data?.length) {
    console.error("Program task archive change failed", error);
    return { status: "error", message: "The task could not be updated." };
  }

  revalidateChecklists();
  return { status: "success", message: parsed.data.archived === "true" ? "Task archived." : "Task restored." };
}
