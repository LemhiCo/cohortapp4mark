"use client";

import { useActionState, useRef, useState } from "react";

import {
  addProgramTask,
  type ProgramActionState,
  setProgramTaskArchived,
  updateProgramTask,
  updateProgramWeek,
} from "@/app/admin/program/actions";

const initialState: ProgramActionState = { status: "idle", message: "" };
const fieldClass = "min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm font-normal shadow-sm focus:border-evergreen focus:outline-none";
const labelClass = "space-y-1 text-sm font-semibold text-dark-evergreen";
const primaryButton = "min-h-10 rounded-md bg-evergreen px-4 text-sm font-semibold text-white hover:bg-dark-evergreen disabled:opacity-60";
const quietButton = "min-h-9 rounded-md border border-line px-3 text-sm font-semibold text-evergreen hover:border-evergreen disabled:opacity-60";

function Feedback({ state }: { state: ProgramActionState }) {
  if (state.status === "idle") return null;
  return (
    <p className={`text-sm font-semibold ${state.status === "success" ? "text-dark-evergreen" : "text-[#6B3216]"}`} role={state.status === "error" ? "alert" : "status"}>
      {state.message}
    </p>
  );
}

export type ProgramTaskValues = {
  description: string;
  kind: "task" | "checkpoint";
  ownerLabel: string;
  ownerType: "msp" | "lemhi";
  title: string;
};

function TaskFields({ values }: { values?: ProgramTaskValues }) {
  return (
    <>
      <label className={`${labelClass} sm:col-span-2`}>
        <span>Task title</span>
        <input className={fieldClass} defaultValue={values?.title} maxLength={200} minLength={2} name="title" required />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        <span>Description</span>
        <textarea className={`${fieldClass} min-h-20 py-2`} defaultValue={values?.description} maxLength={2000} name="description" />
      </label>
      <label className={labelClass}>
        <span>Owner</span>
        <input className={fieldClass} defaultValue={values?.ownerLabel} maxLength={120} minLength={2} name="ownerLabel" placeholder="vCIO / Practice Lead" required />
      </label>
      <label className={labelClass}>
        <span>Who checks it off</span>
        <select className={fieldClass} defaultValue={values?.ownerType ?? "msp"} name="ownerType">
          <option value="msp">The MSP</option>
          <option value="lemhi">Lemhi</option>
        </select>
      </label>
      <label className={labelClass}>
        <span>Type</span>
        <select className={fieldClass} defaultValue={values?.kind ?? "task"} name="kind">
          <option value="task">Task</option>
          <option value="checkpoint">Checkpoint</option>
        </select>
      </label>
    </>
  );
}

export function WeekEditor({ goal, subtitle, title, weekId }: { goal: string; subtitle: string; title: string; weekId: string }) {
  const [state, action, pending] = useActionState(updateProgramWeek, initialState);
  return (
    <details className="rounded-lg border border-line bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-evergreen">Edit week title, subtitle and goal</summary>
      <form action={action} className="mt-4 grid gap-3">
        <input name="weekId" type="hidden" value={weekId} />
        <label className={labelClass}>
          <span>Week title</span>
          <input className={fieldClass} defaultValue={title} maxLength={120} minLength={2} name="title" required />
        </label>
        <label className={labelClass}>
          <span>Subtitle</span>
          <input className={fieldClass} defaultValue={subtitle} maxLength={300} minLength={2} name="subtitle" required />
        </label>
        <label className={labelClass}>
          <span>Goal</span>
          <textarea className={`${fieldClass} min-h-20 py-2`} defaultValue={goal} maxLength={1000} minLength={2} name="goal" required />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button className={primaryButton} disabled={pending} type="submit">{pending ? "Saving…" : "Save week"}</button>
          <Feedback state={state} />
        </div>
      </form>
    </details>
  );
}

export function ProgramTaskEditor({ archived, taskId, values }: { archived: boolean; taskId: string; values: ProgramTaskValues }) {
  const [confirming, setConfirming] = useState(false);
  const [saveState, saveAction, saving] = useActionState(updateProgramTask, initialState);
  const [archiveState, archiveAction, archiving] = useActionState(async (previous: ProgramActionState, formData: FormData) => {
    const result = await setProgramTaskArchived(previous, formData);
    if (result.status === "success") setConfirming(false);
    return result;
  }, initialState);

  return (
    <div className="mt-3 space-y-3">
      {archived ? null : (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-evergreen">Edit task</summary>
          <form action={saveAction} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input name="taskId" type="hidden" value={taskId} />
            <TaskFields values={values} />
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button className={primaryButton} disabled={saving} type="submit">{saving ? "Saving…" : "Save task"}</button>
              <Feedback state={saveState} />
            </div>
          </form>
        </details>
      )}

      {archived ? (
        <form action={archiveAction} className="flex flex-wrap items-center gap-3">
          <input name="taskId" type="hidden" value={taskId} />
          <input name="archived" type="hidden" value="false" />
          <button className={quietButton} disabled={archiving} type="submit">{archiving ? "Restoring…" : "Restore task"}</button>
          <Feedback state={archiveState} />
        </form>
      ) : confirming ? (
        <form action={archiveAction} className="rounded-md bg-[#F7E4D6] px-3 py-2">
          <input name="taskId" type="hidden" value={taskId} />
          <input name="archived" type="hidden" value="true" />
          <p className="text-sm font-semibold text-[#6B3216]">
            Archive “{values.title}”? It leaves every upcoming and active cohort’s checklist and progress. Past completions are kept.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className="min-h-9 rounded-md bg-[#6B3216] px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={archiving} type="submit">
              {archiving ? "Archiving…" : "Archive task"}
            </button>
            <button className={quietButton} disabled={archiving} onClick={() => setConfirming(false)} type="button">Keep it</button>
          </div>
          <Feedback state={archiveState} />
        </form>
      ) : (
        <button className={quietButton} onClick={() => setConfirming(true)} type="button">Archive</button>
      )}
    </div>
  );
}

export function AddProgramTaskForm({ weekId, weekNumber }: { weekId: string; weekNumber: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (previous: ProgramActionState, formData: FormData) => {
    const result = await addProgramTask(previous, formData);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <details className="rounded-lg border border-dashed border-line bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-evergreen">Add a task to Week {weekNumber}</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2" ref={formRef}>
        <input name="weekId" type="hidden" value={weekId} />
        <TaskFields />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className={primaryButton} disabled={pending} type="submit">{pending ? "Adding…" : "Add task"}</button>
          <Feedback state={state} />
        </div>
      </form>
    </details>
  );
}
