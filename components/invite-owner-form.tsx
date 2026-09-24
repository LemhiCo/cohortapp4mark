"use client";

import { useActionState } from "react";

import { inviteMspOwner, type InviteActionState } from "@/app/admin/actions";

const initialState: InviteActionState = { status: "idle", message: "" };

type InviteOwnerFormProps = {
  msps: Array<{ id: string; name: string }>;
};

export function InviteOwnerForm({ msps }: InviteOwnerFormProps) {
  const [state, action, pending] = useActionState(inviteMspOwner, initialState);
  const disabled = pending || msps.length === 0;

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Contact name</span>
          <input
            name="fullName"
            required
            autoComplete="name"
            className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none"
          />
        </label>
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Work email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none"
          />
        </label>
      </div>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>MSP portal</span>
        <select
          name="mspId"
          required
          disabled={msps.length === 0}
          defaultValue=""
          className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base font-normal shadow-sm focus:border-evergreen focus:outline-none disabled:bg-[#EEE9DF]"
        >
          <option value="" disabled>
            {msps.length ? "Select an MSP" : "Create an MSP portal first"}
          </option>
          {msps.map((msp) => (
            <option value={msp.id} key={msp.id}>
              {msp.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={disabled}
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending invitation…" : "Invite main contact"}
      </button>
      {state.message ? (
        <p
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
