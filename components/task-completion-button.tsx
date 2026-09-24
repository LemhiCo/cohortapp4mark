"use client";

import { useActionState } from "react";

import { toggleTaskCompletion, type ChecklistActionState } from "@/app/checklist/actions";

export function TaskCompletionButton({ completed, taskId }: { completed: boolean; taskId: string }) {
  const initialState: ChecklistActionState = { status: "idle", message: "", completed };
  const [state, action, pending] = useActionState(toggleTaskCompletion, initialState);
  const isCompleted = state.completed ?? completed;

  return (
    <form action={action}>
      <input name="taskId" type="hidden" value={taskId} />
      <button
        aria-label={isCompleted ? "Mark task as not done" : "Mark task as done"}
        aria-pressed={isCompleted}
        className={`grid size-8 shrink-0 place-items-center rounded-md border-2 text-sm font-bold transition ${
          isCompleted
            ? "border-evergreen bg-evergreen text-white"
            : "border-line bg-white text-transparent hover:border-evergreen"
        } disabled:cursor-wait disabled:opacity-60`}
        disabled={pending}
        title={state.status === "error" ? state.message : isCompleted ? "Mark as not done" : "Mark as done"}
        type="submit"
      >
        ✓
      </button>
    </form>
  );
}
