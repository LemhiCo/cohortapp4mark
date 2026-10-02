import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { PasswordSetupForm } from "./password-setup-form";

export const metadata = { title: "Set your password" };
export const dynamic = "force-dynamic";

export default async function SetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in?error=invalid_link");

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <section className="w-full max-w-lg rounded-xl border border-line bg-paper p-7 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-accent-orange">Secure your account</p>
        <h1 className="mt-4 font-serif text-4xl font-bold leading-tight text-dark-evergreen">Create your portal password</h1>
        <p className="mt-4 text-base leading-7 text-muted">
          Choose a password only you know. Lemhi administrators cannot see it.
        </p>
        <PasswordSetupForm />
      </section>
    </main>
  );
}
