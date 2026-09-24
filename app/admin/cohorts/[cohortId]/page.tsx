import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { InviteOwnerForm } from "@/components/invite-owner-form";
import { MspPortalForm } from "@/components/msp-portal-form";
import { LogoUploadForm } from "@/components/logo-upload-form";
import { SessionEditor } from "@/components/session-editor";
import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatForLocalInput(isoDate: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(new Date(isoDate));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

function timezoneLabel(timezone: string) {
  return ({
    "America/New_York": "Eastern",
    "America/Chicago": "Central",
    "America/Denver": "Mountain",
    "America/Los_Angeles": "Pacific",
  } as Record<string, string>)[timezone] ?? timezone;
}

export default async function CohortSetupPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const { cohortId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, start_date, timezone, lead_id")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) notFound();

  const [{ data: sessions }, { data: msps }, { data: invitations }, { data: owners }, { count: taskCount }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, starts_at, join_url, week_number")
      .eq("cohort_id", cohort.id)
      .eq("kind", "group")
      .order("week_number"),
    supabase
      .from("msps")
      .select("id, name, website, logo_path, status")
      .eq("cohort_id", cohort.id)
      .order("name"),
    supabase
      .from("invitations")
      .select("email, msp_id, status, created_at")
      .eq("role", "msp_owner")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("email, full_name, msp_id, active")
      .eq("role", "msp_owner"),
    supabase
      .from("cohort_tasks")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", cohort.id),
  ]);

  const cohortMspIds = new Set((msps ?? []).map((msp) => msp.id));
  const latestInvitation = new Map<string, NonNullable<typeof invitations>[number]>();
  for (const invitation of invitations ?? []) {
    if (cohortMspIds.has(invitation.msp_id) && !latestInvitation.has(invitation.msp_id)) {
      latestInvitation.set(invitation.msp_id, invitation);
    }
  }
  const ownerByMsp = new Map((owners ?? []).filter((owner) => owner.msp_id).map((owner) => [owner.msp_id as string, owner]));
  const portalsAwaitingOwner = (msps ?? [])
    .filter((msp) => !ownerByMsp.has(msp.id) && latestInvitation.get(msp.id)?.status !== "pending")
    .map((msp) => ({ id: msp.id, name: msp.name }));
  const tzLabel = timezoneLabel(cohort.timezone);

  return (
    <AppShell activeNav="cohorts" eyebrow="Admin · Cohort" profile={profile} title={cohort.name}>
      <div className="-mt-5 mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link className="font-semibold text-evergreen hover:underline" href="/admin">← All cohorts</Link>
        <span className="text-line">/</span>
        <span className="text-muted">Starts {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${cohort.start_date}T00:00:00Z`))}</span>
        <span className="text-line">·</span>
        <span className="text-muted">{taskCount ?? 0} checklist items</span>
      </div>

      <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
        <div className="max-w-3xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Step 1 · Weekly sessions</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Confirm the live schedule</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            The four sessions were generated from the cohort cadence. Adjust a title, local time, or meeting link as needed.
          </p>
        </div>
        <div className="mt-7 space-y-4">
          {sessions?.map((session) => (
            <SessionEditor
              cohortId={cohort.id}
              joinUrl={session.join_url ?? ""}
              localStartsAt={formatForLocalInput(session.starts_at, cohort.timezone)}
              sessionId={session.id}
              timezoneLabel={tzLabel}
              title={session.title}
              weekNumber={session.week_number ?? 0}
              key={session.id}
            />
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Step 2 · MSP access</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Create a portal</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            Each MSP gets one portal. Its main contact receives an email invite and can add teammates after signing in.
          </p>
          <div className="mt-7">
            <MspPortalForm cohortId={cohort.id} />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Roster</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">MSP portals</h2>
            </div>
            <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-dark-evergreen">
              {msps?.length ?? 0}
            </span>
          </div>

          <div className="mt-6 divide-y divide-line">
            {msps?.length ? (
              msps.map((msp) => {
                const owner = ownerByMsp.get(msp.id);
                const invitation = latestInvitation.get(msp.id);
                return (
                  <div className="py-5 first:pt-0" key={msp.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-serif text-xl font-bold text-dark-evergreen">{msp.name}</h3>
                        {msp.website ? (
                          <a className="mt-1 block truncate text-sm text-evergreen hover:underline" href={msp.website} target="_blank" rel="noreferrer">
                            {msp.website.replace(/^https?:\/\//, "")}
                          </a>
                        ) : null}
                      </div>
                      <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">
                        {msp.status}
                      </span>
                    </div>
                    <div className="mt-4 rounded-md bg-background px-4 py-3 text-sm">
                      <p className="font-semibold text-dark-evergreen">{owner?.full_name || invitation?.email || "Main contact"}</p>
                      <p className="mt-1 text-muted">{owner?.email ?? invitation?.email ?? "No invite sent"}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-accent-orange">
                        {owner?.active && invitation?.status === "accepted"
                          ? "Access active"
                          : invitation
                            ? `Invite ${invitation.status}`
                            : "Setup needed"}
                      </p>
                    </div>
                    <LogoUploadForm hasLogo={Boolean(msp.logo_path)} mspId={msp.id} />
                    <Link className="mt-4 inline-flex text-sm font-semibold text-evergreen hover:underline" href={`/admin/msps/${msp.id}`}>
                      Open MSP dashboard →
                    </Link>
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-base text-muted">
                No MSP portals yet. Create the first one to send its main contact invite.
              </div>
            )}
          </div>
        </section>
      </div>

      {portalsAwaitingOwner.length ? (
        <section className="mt-8 rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Access can come later</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Invite a main contact</h2>
            <p className="mt-3 text-base leading-7 text-muted">
              Add the portal first, then send access when the contact and email setup are ready.
            </p>
          </div>
          <div className="mt-7 max-w-3xl">
            <InviteOwnerForm msps={portalsAwaitingOwner} />
          </div>
        </section>
      ) : null}
    </AppShell>
  );
}
