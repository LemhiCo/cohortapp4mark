import { AppShell } from "@/components/app-shell";
import { requireAdminProfile } from "@/lib/auth";

import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account settings" };

export default async function AdminAccountPage() {
  const profile = await requireAdminProfile();

  return (
    <AppShell activeNav="admin-account" eyebrow="Admin" profile={profile} title="Account settings">
      <section className="max-w-xl rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Security</p>
        <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Change your password</h2>
        <p className="mt-3 text-base leading-7 text-muted">
          Confirm your current password, then choose a new one. The new password is never visible to another Lemhi manager.
        </p>
        <ChangePasswordForm />
      </section>
    </AppShell>
  );
}
