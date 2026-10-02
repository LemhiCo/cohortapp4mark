import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-line bg-paper p-7 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Account recovery</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-dark-evergreen">Reset your password</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Enter the email associated with your Lemhi portal. We will send a secure reset link if the account is active.
        </p>
        <ForgotPasswordForm />
        <Link className="mt-6 inline-flex text-sm font-semibold text-evergreen hover:underline" href="/sign-in">
          ← Back to sign in
        </Link>
      </section>
    </main>
  );
}
