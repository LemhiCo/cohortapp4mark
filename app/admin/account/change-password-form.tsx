"use client";

import { useActionState, useEffect, useRef } from "react";

import { changeAdminPassword, type ChangePasswordState } from "./actions";

const initialState: ChangePasswordState = { status: "idle", message: "" };
const fieldClass = "min-h-12 w-full rounded-md border border-line bg-white px-4 text-base text-forest-ink shadow-sm focus:border-evergreen focus:outline-none";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(changeAdminPassword, initialState);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form action={formAction} className="mt-7 space-y-5" ref={formRef}>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Current password</span>
        <input autoComplete="current-password" className={fieldClass} name="currentPassword" required type="password" />
      </label>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>New password</span>
        <input autoComplete="new-password" className={fieldClass} minLength={12} name="newPassword" required type="password" />
        <span className="block font-normal text-muted">Use at least 12 characters.</span>
      </label>
      <label className="block space-y-2 text-sm font-semibold text-dark-evergreen">
        <span>Confirm new password</span>
        <input autoComplete="new-password" className={fieldClass} minLength={12} name="confirmPassword" required type="password" />
      </label>
      <button
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Changing password…" : "Change password"}
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
