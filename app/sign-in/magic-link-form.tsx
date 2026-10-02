"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { status: "idle", message: "" };

export function SignInForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

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

      <div className="space-y-2">
        <label htmlFor="password" className="block text-sm font-semibold text-dark-evergreen">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="min-h-12 w-full rounded-md border border-line bg-white px-4 text-base text-forest-ink shadow-sm placeholder:text-muted/70 focus:border-evergreen focus:outline-none"
        />
        <div className="text-right">
          <Link className="text-sm font-semibold text-evergreen hover:underline" href="/forgot-password">
            Forgot your password?
          </Link>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center rounded-md bg-evergreen px-5 text-base font-semibold text-white transition hover:bg-dark-evergreen disabled:cursor-wait disabled:opacity-65"
      >
        {pending ? "Signing in…" : "Sign in"}
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
