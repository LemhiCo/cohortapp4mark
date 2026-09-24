"use client";

import { useActionState, useEffect, useRef } from "react";

import { addTaskNote, type ChecklistActionState } from "@/app/checklist/actions";

const initialState: ChecklistActionState = { status: "idle", message: "" };

export function TaskNoteForm({ taskId }: { taskId: string }) {
  const [state, action, pending] = useActionState(addTaskNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form action={action} className="mt-4" ref={formRef}>
      <input name="taskId" type="hidden" value={taskId} />
      <label className="block text-sm font-semibold text-dark-evergreen" htmlFor={`note-${taskId}`}>
        Add a note
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea
          className="min-h-20 flex-1 resize-y rounded-md border border-line bg-white px-3 py-2 text-base shadow-sm focus:border-evergreen focus:outline-none"
          id={`note-${taskId}`}
          maxLength={5000}
          name="body"
          placeholder="Share an update or question with your Lemhi team"
          required
        />
        <button
          className="min-h-11 self-end rounded-md bg-evergreen px-4 font-semibold text-white transition hover:bg-dark-evergreen disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Posting…" : "Post note"}
        </button>
      </div>
      {state.message ? (
        <p className={`mt-2 text-sm ${state.status === "success" ? "text-evergreen" : "text-[#8B3F1C]"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
