"use client";

import { useActionState, useEffect, useRef } from "react";

import { addAdminTaskNote, toggleAdminTask, type AdminMspActionState } from "@/app/admin/msps/actions";

export function AdminTaskButton({ completed, mspId, taskId }: { completed: boolean; mspId: string; taskId: string }) {
  const [state, action, pending] = useActionState(toggleAdminTask, { status: "idle", message: "", completed } satisfies AdminMspActionState);
  const isCompleted = state.completed ?? completed;
  return (
    <form action={action}>
      <input name="mspId" type="hidden" value={mspId} />
      <input name="taskId" type="hidden" value={taskId} />
      <button
        aria-label={isCompleted ? "Reopen Lemhi task" : "Complete Lemhi task"}
        aria-pressed={isCompleted}
        className={`grid size-8 place-items-center rounded-md border-2 text-sm font-bold ${isCompleted ? "border-evergreen bg-evergreen text-white" : "border-accent-orange bg-white text-transparent hover:bg-[#F7E4D6]"} disabled:opacity-50`}
        disabled={pending}
        title={state.status === "error" ? state.message : undefined}
        type="submit"
      >✓</button>
    </form>
  );
}

export function AdminTaskNoteForm({ mspId, taskId }: { mspId: string; taskId: string }) {
  const [state, action, pending] = useActionState(addAdminTaskNote, { status: "idle", message: "" } satisfies AdminMspActionState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.status === "success") formRef.current?.reset(); }, [state.status]);
  return (
    <form action={action} className="mt-3" ref={formRef}>
      <input name="mspId" type="hidden" value={mspId} />
      <input name="taskId" type="hidden" value={taskId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea className="min-h-20 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm" maxLength={5000} name="body" placeholder="Reply to this MSP" required />
        <button className="min-h-10 self-end rounded-md bg-evergreen px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Posting…" : "Reply"}</button>
      </div>
      {state.message ? <p className={`mt-2 text-sm ${state.status === "error" ? "text-[#8B3F1C]" : "text-evergreen"}`} role="status">{state.message}</p> : null}
    </form>
  );
}
