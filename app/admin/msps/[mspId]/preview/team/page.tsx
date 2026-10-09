import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MspPreviewBar } from "@/components/msp-views/preview-bar";
import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "View as MSP · Team" };

export default async function PreviewTeamPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: msp }, { data: members }, { data: invitations }] = await Promise.all([
    supabase.from("msps").select("id, name").eq("id", mspId).maybeSingle(),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .eq("msp_id", mspId)
      .order("role")
      .order("full_name"),
    supabase
      .from("invitations")
      .select("id, email, status")
      .eq("msp_id", mspId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (!msp) notFound();

  return (
    <AppShell activeNav="cohorts" eyebrow={msp.name} profile={profile} title="Your team">
      <MspPreviewBar active="team" mspId={msp.id} mspName={msp.name} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <h2 className="font-serif text-3xl font-bold text-dark-evergreen">Members</h2>
          <div className="mt-6 divide-y divide-line">
            {members?.length ? members.map((member) => (
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4" key={member.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 truncate font-semibold text-dark-evergreen">{member.full_name || member.email}</p>
                    {member.role === "msp_owner" ? (
                      <span className="rounded-full bg-sage px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-dark-evergreen">
                        Main contact
                      </span>
                    ) : null}
                    {!member.active ? (
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">
                        Removed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{member.email}</p>
                </div>
                {member.role === "msp_member" && member.active ? (
                  <button className="min-h-11 rounded-md border border-[#D5A485] px-3 text-sm font-semibold text-[#7A3B18] opacity-60" disabled type="button">
                    Remove
                  </button>
                ) : null}
              </div>
            )) : <p className="py-4 text-sm text-muted">No one has completed account setup yet.</p>}
          </div>

          {invitations?.length ? (
            <div className="mt-8 border-t border-line pt-6">
              <h3 className="font-serif text-2xl font-bold text-dark-evergreen">Pending invitations</h3>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                {invitations.map((invitation) => (
                  <li className="flex justify-between gap-4" key={invitation.id}>
                    <span>{invitation.email}</span>
                    <span className="font-semibold capitalize">{invitation.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Team access</p>
            <span className="rounded-full bg-sage px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-dark-evergreen">Owner action</span>
          </div>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Add a teammate</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            This is where the MSP’s main contact generates a private setup link for each teammate.
          </p>
          <div className="mt-7 space-y-5" aria-label="Read-only teammate invitation preview">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
                <span>Name</span>
                <input className="min-h-12 w-full rounded-md border border-line bg-[#EEE9DF] px-4 text-base font-normal" disabled placeholder="Teammate name" />
              </label>
              <label className="space-y-2 text-sm font-semibold text-dark-evergreen">
                <span>Work email</span>
                <input className="min-h-12 w-full rounded-md border border-line bg-[#EEE9DF] px-4 text-base font-normal" disabled placeholder="teammate@company.com" type="email" />
              </label>
            </div>
            <button className="min-h-12 rounded-md bg-evergreen px-5 font-semibold text-white opacity-70" disabled type="button">
              Generate teammate link
            </button>
            <div className="rounded-md border border-dashed border-evergreen/35 bg-sage/40 px-4 py-3 text-sm leading-6 text-dark-evergreen">
              After generation, the secure 72-hour link and <strong>Copy link</strong> button appear here. The owner can send that link through email, Teams, or another private channel.
            </div>
            <p className="text-xs leading-5 text-muted">Preview only—these controls cannot create or remove access.</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
