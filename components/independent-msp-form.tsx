"use client";

import { useActionState, useEffect, useRef } from "react";

import { createIndependentMsp, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };
const fieldClass =
  "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none";

const timezones = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
] as const;

type IndependentMspFormProps = {
  admins: Array<{ id: string; full_name: string; email: string }>;
  defaultLeadId: string;
  defaultStartDate: string;
};

export function IndependentMspForm({ admins, defaultLeadId, defaultStartDate }: IndependentMspFormProps) {
  const [state, action, pending] = useActionState(createIndependentMsp, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form action={action} className="space-y-5" ref={formRef}>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>MSP name</span>
          <input className={fieldClass} name="mspName" required placeholder="Independent MSP" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Website <span className="font-normal text-muted">(optional)</span></span>
          <input className={fieldClass} name="website" type="url" placeholder="https://example.com" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Program starts</span>
          <input className={fieldClass} defaultValue={defaultStartDate} name="startDate" required type="date" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Time zone</span>
          <select className={fieldClass} defaultValue="America/New_York" name="timezone">
            {timezones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Lemhi lead</span>
          <select className={fieldClass} defaultValue={defaultLeadId} name="leadId" required>
            {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.full_name || admin.email}</option>)}
          </select>
        </label>
        <div className="hidden sm:block" />
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Main contact <span className="font-normal text-muted">(optional)</span></span>
          <input autoComplete="name" className={fieldClass} name="contactName" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Work email <span className="font-normal text-muted">(optional)</span></span>
          <input autoComplete="email" className={fieldClass} name="contactEmail" type="email" />
        </label>
      </div>

      <p className="text-sm leading-6 text-muted">
        This creates a private one-company workspace with the full roadmap and no cohort sessions or peer list.
      </p>

      <button
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || admins.length === 0}
        type="submit"
      >
        {pending ? "Creating workspace…" : "Add non-cohort member"}
      </button>

      {state.message ? (
        <p className={`rounded-md px-4 py-3 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`} role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
