import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminAddTeammateForm,
  AdminReplacementTeammateLink,
} from "@/components/admin-teammate-access-controls";
import { AppShell } from "@/components/app-shell";
import { requireAdminProfile } from "@/lib/auth";
import { invitationHasExpired } from "@/lib/invitations";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage MSP team access" };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminMspTeamPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: msp }, { data: people }, { data: invitations }] = await Promise.all([
    supabase.from("msps").select("id, name, status").eq("id", mspId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, email, full_name, role, active, password_setup_required, last_seen_at")
      .eq("msp_id", mspId)
      .order("role")
      .order("full_name"),
    supabase
      .from("invitations")
      .select("id, email, full_name, role, status, expires_at, last_sent_at, auth_user_id")
      .eq("msp_id", mspId)
      .eq("role", "msp_member")
      .order("created_at", { ascending: false }),
  ]);

  if (!msp) notFound();

  const pendingByEmail = new Map(
    (invitations ?? [])
      .filter((invitation) => invitation.status === "pending")
      .map((invitation) => [invitation.email.toLowerCase(), invitation]),
  );
  const teammateRows = new Map<string, {
    active: boolean;
    email: string;
    fullName: string;
    invitation: (NonNullable<typeof invitations>)[number] | null;
    lastSeenAt: string | null;
    passwordSetupRequired: boolean;
  }>();

  for (const person of (people ?? []).filter((item) => item.role === "msp_member")) {
    const email = person.email.toLowerCase();
    teammateRows.set(email, {
      active: person.active,
      email: person.email,
      fullName: person.full_name || pendingByEmail.get(email)?.full_name || person.email.split("@")[0],
      invitation: pendingByEmail.get(email) ?? null,
      lastSeenAt: person.last_seen_at,
      passwordSetupRequired: person.password_setup_required,
    });
  }

  for (const invitation of pendingByEmail.values()) {
    const email = invitation.email.toLowerCase();
    if (!teammateRows.has(email)) {
      teammateRows.set(email, {
        active: true,
        email: invitation.email,
        fullName: invitation.full_name || invitation.email.split("@")[0],
        invitation,
        lastSeenAt: null,
        passwordSetupRequired: true,
      });
    }
  }

  const teammates = [...teammateRows.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  const completedCount = teammates.filter((teammate) => teammate.active && !teammate.passwordSetupRequired).length;
  const pendingCount = teammates.filter((teammate) => teammate.active && teammate.passwordSetupRequired).length;

  return (
    <AppShell activeNav="cohorts" eyebrow="Admin · Access" profile={profile} title={`${msp.name} team`}>
      <div className="-mt-5 mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link className="font-semibold text-evergreen hover:underline" href={`/admin/msps/${msp.id}`}>← Back to MSP admin</Link>
        <span className="text-line">/</span>
        <Link className="font-semibold text-evergreen hover:underline" href={`/admin/msps/${msp.id}/preview/team`}>View the MSP’s Team page</Link>
      </div>

      {msp.status !== "active" ? (
        <div className="mb-8 rounded-xl border border-[#D5A485] bg-[#F7E4D6] px-5 py-4 text-sm font-semibold text-[#6B3216]">
          This MSP portal is inactive. Reactivate it before generating access links.
        </div>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Lemhi-managed onboarding</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-dark-evergreen">Team access</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                Generate and copy individual setup links on the MSP’s behalf. Lemhi never chooses or sees the teammate’s password.
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="rounded-full bg-sage px-3 py-1.5 font-semibold text-dark-evergreen">{completedCount} set up</span>
              <span className="rounded-full border border-line px-3 py-1.5 font-semibold text-muted">{pendingCount} pending</span>
            </div>
          </div>

          <div className="mt-7 divide-y divide-line">
            {teammates.length ? teammates.map((teammate) => {
              const needsSetup = teammate.active && teammate.passwordSetupRequired;
              const expired = teammate.invitation ? invitationHasExpired(teammate.invitation.expires_at) : false;
              return (
                <article className="py-5 first:pt-0" key={teammate.email}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-dark-evergreen">{teammate.fullName}</p>
                      <p className="mt-1 break-all text-sm text-muted">{teammate.email}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${!teammate.active ? "border border-line text-muted" : needsSetup ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>
                      {!teammate.active ? "Removed" : needsSetup ? expired ? "Link expired" : "Setup pending" : "Setup complete"}
                    </span>
                  </div>
                  {!teammate.active ? (
                    <p className="mt-3 text-sm text-muted">This account is inactive. Reactivation remains a separate protected action.</p>
                  ) : needsSetup ? (
                    <>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        {teammate.invitation
                          ? `Current link ${expired ? "expired" : `expires ${formatDateTime(teammate.invitation.expires_at)}`}. A replacement keeps this same account and MSP workspace.`
                          : "This account has not completed password setup. Generate a fresh link without recreating it."}
                      </p>
                      {msp.status === "active" ? (
                        <AdminReplacementTeammateLink
                          email={teammate.email}
                          fullName={teammate.fullName}
                          mspId={msp.id}
                          mspName={msp.name}
                        />
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-3 text-sm text-muted">
                      {teammate.lastSeenAt ? `Last entered the portal ${formatDateTime(teammate.lastSeenAt)}.` : "Account setup is complete; no portal activity has been recorded yet."}
                    </p>
                  )}
                </article>
              );
            }) : (
              <p className="py-5 text-sm text-muted">No teammates have been added yet.</p>
            )}
          </div>
        </section>

        <section className="h-fit rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Add someone</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Generate a teammate link</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Enter the person’s own email. Copy the resulting private link and send it directly through email or Teams.
          </p>
          {msp.status === "active" ? <AdminAddTeammateForm mspId={msp.id} mspName={msp.name} /> : null}
        </section>
      </div>
    </AppShell>
  );
}
