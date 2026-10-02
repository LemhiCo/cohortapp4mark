"use client";

import { useActionState } from "react";

import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { status: "idle", message: "" };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Work email</span>
        <input
          autoComplete="email"
          className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base text-forest-ink shadow-sm focus:border-evergreen focus:outline-none"
          name="email"
          placeholder="you@company.com"
          required
          type="email"
        />
      </label>
      <button
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Sending reset link…" : "Send password-reset link"}
      </button>
      {state.message ? (
        <p
          className={`rounded-md px-4 py-3 text-sm leading-6 ${state.status === "success" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
