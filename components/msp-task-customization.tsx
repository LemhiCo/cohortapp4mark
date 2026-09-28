"use client";

import { useActionState, useRef, useState } from "react";

import {
  addExtraTask,
  type AdminMspActionState,
  removeExtraTask,
  setTaskHiddenForMsp,
} from "@/app/admin/msps/actions";

const initialState: AdminMspActionState = { status: "idle", message: "" };
const quietButton = "min-h-9 rounded-md border border-line px-3 text-sm font-semibold text-evergreen hover:border-evergreen disabled:opacity-60";
const fieldClass = "min-h-10 w-full rounded-md border border-line bg-white px-3 text-sm font-normal shadow-sm focus:border-evergreen focus:outline-none";

function ErrorMessage({ state }: { state: AdminMspActionState }) {
  return state.status === "error" ? <p className="mt-2 text-sm font-semibold text-[#6B3216]" role="alert">{state.message}</p> : null;
}

export function HideTaskToggle({ hidden, mspId, taskId }: { hidden: boolean; mspId: string; taskId: string }) {
  const [state, action, pending] = useActionState(setTaskHiddenForMsp, initialState);
  return (
    <form action={action}>
      <input name="mspId" type="hidden" value={mspId} />
      <input name="taskId" type="hidden" value={taskId} />
      <input name="hidden" type="hidden" value={hidden ? "false" : "true"} />
      <button className={quietButton} disabled={pending} type="submit">
        {pending ? "Saving…" : hidden ? "Show again" : "Hide for this MSP"}
      </button>
      <ErrorMessage state={state} />
    </form>
  );
}

export function RemoveExtraTaskButton({ mspId, taskId, title }: { mspId: string; taskId: string; title: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeExtraTask, initialState);

  if (!confirming) {
    return <button className={quietButton} onClick={() => setConfirming(true)} type="button">Remove</button>;
  }

  return (
    <form action={action} className="rounded-md bg-[#F7E4D6] px-3 py-2">
      <input name="mspId" type="hidden" value={mspId} />
      <input name="taskId" type="hidden" value={taskId} />
      <p className="text-sm font-semibold text-[#6B3216]">Remove “{title}” from this MSP’s checklist?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button className="min-h-9 rounded-md bg-[#6B3216] px-3 text-sm font-semibold text-white disabled:opacity-60" disabled={pending} type="submit">
          {pending ? "Removing…" : "Remove task"}
        </button>
        <button className={quietButton} disabled={pending} onClick={() => setConfirming(false)} type="button">Keep it</button>
      </div>
      <ErrorMessage state={state} />
    </form>
  );
}

export function ExtraTaskForm({ cohortWeekId, mspId, weekNumber }: { cohortWeekId: string; mspId: string; weekNumber: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (previous: AdminMspActionState, formData: FormData) => {
    const result = await addExtraTask(previous, formData);
    if (result.status === "success") formRef.current?.reset();
    return result;
  }, initialState);

  return (
    <details className="rounded-lg border border-dashed border-line bg-white/60 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-evergreen">Add a Week {weekNumber} task for this MSP</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2" ref={formRef}>
        <input name="mspId" type="hidden" value={mspId} />
        <input name="cohortWeekId" type="hidden" value={cohortWeekId} />
        <label className="space-y-1 text-sm font-semibold text-dark-evergreen sm:col-span-2">
          <span>Task title</span>
          <input className={fieldClass} maxLength={200} minLength={2} name="title" required />
        </label>
        <label className="space-y-1 text-sm font-semibold text-dark-evergreen sm:col-span-2">
          <span>Description <span className="font-normal text-muted">(optional)</span></span>
          <textarea className={`${fieldClass} min-h-20 py-2`} maxLength={2000} name="description" />
        </label>
        <label className="space-y-1 text-sm font-semibold text-dark-evergreen">
          <span>Owner</span>
          <input className={fieldClass} maxLength={120} minLength={2} name="ownerLabel" placeholder="vCIO / Practice Lead" required />
        </label>
        <label className="space-y-1 text-sm font-semibold text-dark-evergreen">
          <span>Who checks it off</span>
          <select className={fieldClass} defaultValue="msp" name="ownerType">
            <option value="msp">The MSP</option>
            <option value="lemhi">Lemhi</option>
          </select>
        </label>
        <label className="space-y-1 text-sm font-semibold text-dark-evergreen">
          <span>Type</span>
          <select className={fieldClass} defaultValue="task" name="kind">
            <option value="task">Task</option>
            <option value="checkpoint">Checkpoint</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="min-h-10 rounded-md bg-evergreen px-4 text-sm font-semibold text-white hover:bg-dark-evergreen disabled:opacity-60" disabled={pending} type="submit">
            {pending ? "Adding…" : "Add task"}
          </button>
        </div>
        <div className="sm:col-span-2">
          {state.status === "success" ? <p className="text-sm font-semibold text-dark-evergreen" role="status">{state.message}</p> : null}
          <ErrorMessage state={state} />
        </div>
      </form>
    </details>
  );
}
