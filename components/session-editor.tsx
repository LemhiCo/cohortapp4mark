"use client";

import { useActionState } from "react";

import { updateGroupSession, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };
const fieldClass =
  "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-normal shadow-sm focus:border-evergreen focus:outline-none";

type SessionEditorProps = {
  cohortId: string;
  joinUrl: string;
  localStartsAt: string;
  sessionId: string;
  timezoneLabel: string;
  title: string;
  weekNumber: number;
};

export function SessionEditor({
  cohortId,
  joinUrl,
  localStartsAt,
  sessionId,
  timezoneLabel,
  title,
  weekNumber,
}: SessionEditorProps) {
  const [state, action, pending] = useActionState(updateGroupSession, initialState);

  return (
    <form action={action} className="rounded-lg border border-line bg-white/70 p-4 sm:p-5">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-orange">Week {weekNumber}</p>
        <button
          className="min-h-9 rounded-md border border-evergreen px-3 text-sm font-semibold text-evergreen transition hover:bg-sage disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr_1fr]">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Session title</span>
          <input className={fieldClass} name="title" required defaultValue={title} />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Date & time <span className="font-normal text-muted">({timezoneLabel})</span></span>
          <input className={fieldClass} name="localStartsAt" type="datetime-local" required defaultValue={localStartsAt} />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Join link <span className="font-normal text-muted">(optional)</span></span>
          <input className={fieldClass} name="joinUrl" type="url" defaultValue={joinUrl} placeholder="https://zoom.us/j/…" />
        </label>
      </div>
      {state.message ? (
        <p
          role="status"
          className={`mt-4 rounded-md px-3 py-2 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
