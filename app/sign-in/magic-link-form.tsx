"use client";

import { useActionState } from "react";

import { requestMagicLink, type MagicLinkState } from "./actions";

const initialState: MagicLinkState = { status: "idle", message: "" };

export function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(requestMagicLink, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-semibold text-dark-evergreen">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base text-forest-ink shadow-sm placeholder:text-muted/70 focus:border-evergreen focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Sending secure link…" : "Email me a sign-in link"}
      </button>

      {state.message ? (
        <p
          role="status"
          className={`rounded-md px-4 py-3 text-sm leading-6 ${
            state.status === "success"
              ? "bg-sage text-dark-evergreen"
              : "bg-[#F7E4D6] text-[#6B3216]"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
