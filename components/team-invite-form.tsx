"use client";

import { useActionState, useState } from "react";

import { inviteTeamMember, type TeamActionState } from "@/app/team/actions";

const initialState: TeamActionState = { status: "idle", message: "" };

export function TeamInviteForm() {
  const [state, action, pending] = useActionState(inviteTeamMember, initialState);
  const [copyStatus, setCopyStatus] = useState("");

  return (
    <form action={action} className="space-y-5" onSubmit={() => setCopyStatus("")}>
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
        {pending ? "Generating…" : "Generate teammate link"}
      </button>
      {state.message ? (
        <div
          role="status"
          className={`rounded-md px-4 py-3 text-sm ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
        >
          <p>{state.message}</p>
          {state.setupUrl ? (
            <div className="mt-3">
              <label className="font-semibold" htmlFor="teammate-setup-link">Secure teammate setup link</label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className="min-h-10 min-w-0 flex-1 rounded-md border border-line bg-white px-3 text-sm text-forest-ink"
                  id="teammate-setup-link"
                  onFocus={(event) => event.currentTarget.select()}
                  readOnly
                  type="url"
                  value={state.setupUrl}
                />
                <button
                  className="min-h-10 rounded-md bg-evergreen px-4 font-semibold text-white hover:bg-dark-evergreen"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.setupUrl ?? "");
                      setCopyStatus("Copied to clipboard.");
                    } catch {
                      setCopyStatus("Copy failed. Select the link and copy it manually.");
                    }
                  }}
                  type="button"
                >
                  Copy link
                </button>
              </div>
              <p className="mt-2 text-xs leading-5">
                Send this only to this teammate. It remains valid for 72 hours and can be reopened until password setup is complete.
              </p>
              {copyStatus ? <p className="mt-2 font-semibold" aria-live="polite">{copyStatus}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
