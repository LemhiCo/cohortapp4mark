"use client";

import { useActionState } from "react";

import { updateCohortLead, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };
const fieldClass =
  "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm font-normal shadow-sm focus:border-evergreen focus:outline-none";

type CohortLeadFormProps = {
  cohortId: string;
  leadId: string | null;
  leads: Array<{ id: string; label: string }>;
};

export function CohortLeadForm({ cohortId, leadId, leads }: CohortLeadFormProps) {
  const [state, action, pending] = useActionState(updateCohortLead, initialState);
  // A lead who is no longer an active admin isn't in the list; ask for a new one.
  const current = leads.some((lead) => lead.id === leadId) ? leadId! : "";

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <label className="min-w-64 flex-1 space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Cohort lead</span>
        <select className={fieldClass} defaultValue={current} name="leadId" required>
          {current ? null : <option disabled value="">Choose a lead</option>}
          {leads.map((lead) => (
            <option key={lead.id} value={lead.id}>{lead.label}</option>
          ))}
        </select>
      </label>
      <button
        className="min-h-11 rounded-md border border-evergreen px-4 text-sm font-semibold text-evergreen transition hover:bg-sage disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save lead"}
      </button>
      {state.message ? (
        <p
          role="status"
          className={`basis-full rounded-md px-3 py-2 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
