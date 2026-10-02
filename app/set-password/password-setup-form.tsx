"use client";

import { useActionState } from "react";

import { setPassword, type PasswordSetupState } from "./actions";

const initialState: PasswordSetupState = { status: "idle", message: "" };
const fieldClass =
  "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base text-forest-ink shadow-sm focus:border-evergreen focus:outline-none";

export function PasswordSetupForm() {
  const [state, action, pending] = useActionState(setPassword, initialState);

  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>New password</span>
        <input
          autoComplete="new-password"
          className={fieldClass}
          minLength={12}
          name="password"
          required
          type="password"
        />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Confirm new password</span>
        <input
          autoComplete="new-password"
          className={fieldClass}
          minLength={12}
          name="confirmPassword"
          required
          type="password"
        />
      </label>
      <p className="text-sm leading-6 text-muted">Use at least 12 characters and do not reuse a password from another service.</p>
      <button
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving password…" : "Save password and continue"}
      </button>
      {state.message ? (
        <p className="rounded-md bg-[#F7E4D6] px-4 py-3 text-sm leading-6 text-[#6B3216]" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
