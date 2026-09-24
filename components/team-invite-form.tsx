"use client";

import { useActionState } from "react";

import { inviteTeamMember, type TeamActionState } from "@/app/team/actions";

const initialState: TeamActionState = { status: "idle", message: "" };

export function TeamInviteForm() {
  const [state, action, pending] = useActionState(inviteTeamMember, initialState);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
          <span>Name</span>
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
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Sending invitation…" : "Invite teammate"}
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
