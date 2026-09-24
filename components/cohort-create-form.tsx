"use client";

import { useActionState } from "react";

import { createCohort, type AdminActionState } from "@/app/admin/actions";

const initialState: AdminActionState = { status: "idle", message: "" };

type CohortCreateFormProps = {
  admins: Array<{ id: string; full_name: string; email: string }>;
  defaultLeadId: string;
  defaultStartDate: string;
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const timezones = [
  ["America/New_York", "Eastern"],
  ["America/Chicago", "Central"],
  ["America/Denver", "Mountain"],
  ["America/Los_Angeles", "Pacific"],
] as const;

const fieldClass =
  "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none";

export function CohortCreateForm({ admins, defaultLeadId, defaultStartDate }: CohortCreateFormProps) {
  const [state, action, pending] = useActionState(createCohort, initialState);

  return (
    <form action={action} className="space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Cohort name</span>
        <input className={fieldClass} name="name" required placeholder="Fall 2026 MSP Cohort" />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Program starts</span>
          <input className={fieldClass} name="startDate" type="date" required defaultValue={defaultStartDate} />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Lemhi lead</span>
          <select className={fieldClass} name="leadId" required defaultValue={defaultLeadId}>
            {admins.map((admin) => (
              <option value={admin.id} key={admin.id}>
                {admin.full_name || admin.email}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Session day</span>
          <select className={fieldClass} name="sessionWeekday" defaultValue="1">
            {weekdays.map((day, index) => (
              <option value={index} key={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Session time</span>
          <input className={fieldClass} name="sessionTime" type="time" required defaultValue="11:00" />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Time zone</span>
          <select className={fieldClass} name="timezone" defaultValue="America/New_York">
            {timezones.map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm leading-6 text-muted">
        Creating the cohort also makes its four weeks, 30 checklist items, and four weekly sessions.
      </p>

      <button
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-not-allowed disabled:opacity-50"
        disabled={pending || admins.length === 0}
        type="submit"
      >
        {pending ? "Creating cohort…" : "Create cohort"}
      </button>

      {state.message ? (
        <p role="status" className="rounded-md bg-[#F7E4D6] px-4 py-3 text-sm text-[#6B3216]">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
