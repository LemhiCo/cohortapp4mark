import { AppShell } from "@/components/app-shell";
import { RemoveTeamMemberButton } from "@/components/remove-team-member-button";
import { TeamInviteForm } from "@/components/team-invite-form";
import { requireMspProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage() {
  const profile = await requireMspProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: members }, { data: invitations }, { data: msp }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, active")
      .eq("msp_id", profile.msp_id)
      .order("role")
      .order("full_name"),
    supabase
      .from("invitations")
      .select("id, email, status")
      .eq("msp_id", profile.msp_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase.from("msps").select("name").eq("id", profile.msp_id).single(),
  ]);

  const isOwner = profile.role === "msp_owner";

  return (
    <AppShell activeNav="team" eyebrow={msp?.name ?? "Your MSP"} profile={profile} title="Your team">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <h2 className="font-serif text-3xl font-bold text-dark-evergreen">Members</h2>
          <div className="mt-6 divide-y divide-line">
            {members?.map((member) => (
              <div className="flex items-center justify-between gap-4 py-4" key={member.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-dark-evergreen">{member.full_name || member.email}</p>
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
                {isOwner && member.role === "msp_member" && member.active ? (
                  <RemoveTeamMemberButton userId={member.id} />
                ) : null}
              </div>
            ))}
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
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Team access</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">
            {isOwner ? "Invite a teammate" : "Your main contact manages access"}
          </h2>
          <p className="mt-3 text-base leading-7 text-muted">
            {isOwner
              ? "Teammates can view your cohort, complete MSP tasks, and join task note threads."
              : "Ask your MSP’s main contact if someone needs to be added or removed."}
          </p>
          {isOwner ? <div className="mt-7"><TeamInviteForm /></div> : null}
        </section>
      </div>
    </AppShell>
  );
}
