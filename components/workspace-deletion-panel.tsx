"use client";

import { useActionState } from "react";

import {
  deleteCohort,
  deleteMspPortal,
  type DeleteWorkspaceState,
} from "@/app/admin/delete-actions";

const initialState: DeleteWorkspaceState = { status: "idle", message: "" };
const fieldClass = "min-h-11 w-full rounded-md border border-[#C88B74] bg-white px-3 text-base text-forest-ink shadow-sm focus:border-[#8A431C] focus:outline-none";

type WorkspaceDeletionPanelProps = {
  entityId: string;
  entityName: string;
  managerEmail: string;
  type: "cohort" | "msp";
};

export function WorkspaceDeletionPanel({ entityId, entityName, managerEmail, type }: WorkspaceDeletionPanelProps) {
  const action = type === "cohort" ? deleteCohort : deleteMspPortal;
  const [state, formAction, pending] = useActionState(action, initialState);
  const noun = type === "cohort" ? "cohort" : "MSP portal";

  return (
    <section className="mt-8 rounded-xl border border-[#C88B74] bg-[#FFF8F3] p-6 sm:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#8A431C]">Danger zone</p>
      <h2 className="mt-3 font-serif text-2xl font-bold text-dark-evergreen">Delete this {noun}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        This permanently removes the {noun}, its access, activity, and linked content. The reason, accountable manager, target, and result are retained in the deletion audit.
      </p>

      <details className="mt-5 rounded-lg border border-[#D9A48E] bg-white p-4">
        <summary className="cursor-pointer font-semibold text-[#8A431C]">Open permanent deletion controls</summary>
        <form
          action={formAction}
          className="mt-5 space-y-4 border-t border-[#E8C6B8] pt-5"
          onSubmit={(event) => {
            if (!window.confirm(`Permanently delete ${entityName}? This cannot be undone.`)) event.preventDefault();
          }}
        >
          <input name={type === "cohort" ? "cohortId" : "mspId"} type="hidden" value={entityId} />

          <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
            <span>Reason for deletion</span>
            <textarea className={`${fieldClass} min-h-24 py-3`} maxLength={500} minLength={10} name="reason" placeholder="Explain why this workspace should be permanently removed." required />
          </label>

          <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
            <span>Accountable manager email</span>
            <input autoComplete="off" className={fieldClass} name="ownerEmail" placeholder={managerEmail} required type="email" />
            <span className="block font-normal text-muted">For protection, type your signed-in email exactly: {managerEmail}</span>
          </label>

          <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
            <span>Confirm the exact {noun} name</span>
            <input autoComplete="off" className={fieldClass} name="confirmationName" placeholder={entityName} required />
            <span className="block font-normal text-muted">Type “{entityName}” exactly.</span>
          </label>

          <label className="flex items-start gap-3 rounded-md bg-[#FFF1E8] p-3 text-sm font-semibold text-[#6B3216]">
            <input className="mt-1 size-4" name="acknowledgement" required type="checkbox" />
            <span>I understand this permanently deletes the {noun} and cannot be undone.</span>
          </label>

          <button
            className="min-h-11 rounded-md bg-[#8A431C] px-5 text-sm font-bold text-white transition hover:bg-[#6B3216] disabled:cursor-wait disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "Deleting permanently…" : `Permanently delete ${noun}`}
          </button>

          {state.message ? <p className="rounded-md bg-[#F7E4D6] px-4 py-3 text-sm text-[#6B3216]" role="status">{state.message}</p> : null}
        </form>
      </details>
    </section>
  );
}
