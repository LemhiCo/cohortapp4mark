import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { CohortLeadForm } from "@/components/cohort-lead-form";
import { MspInvitationControl } from "@/components/msp-invitation-control";
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
    .select("id, name, start_date, timezone, lead_id, workspace_type")
    .eq("id", cohortId)
    .maybeSingle();

  if (!cohort) notFound();

  const [{ data: sessions }, { data: msps }, { data: invitations }, { data: owners }, { count: taskCount }, { data: admins }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, starts_at, join_url, week_number")
      .eq("cohort_id", cohort.id)
      .eq("kind", "group")
      .order("week_number"),
    supabase
      .from("msps")
      .select("id, name, website, logo_path, status, primary_contact_email, primary_contact_name")
      .eq("cohort_id", cohort.id)
      .order("name"),
    supabase
      .from("invitations")
      .select("email, msp_id, status, created_at, expires_at, last_sent_at")
      .eq("role", "msp_owner")
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("email, full_name, msp_id, active, password_setup_required")
      .eq("role", "msp_owner"),
    supabase
      .from("cohort_tasks")
      .select("id", { count: "exact", head: true })
      .eq("cohort_id", cohort.id),
    supabase
      .from("profiles")
      .select("id, full_name, email, title")
      .eq("role", "lemhi_admin")
      .eq("active", true)
      .order("full_name"),
  ]);
  const leadOptions = (admins ?? []).map((admin) => ({
    id: admin.id,
    label: `${admin.full_name || admin.email}${admin.title ? ` · ${admin.title}` : ""}`,
  }));

  if (cohort.workspace_type === "individual") {
    const individualMsp = msps?.[0];
    if (individualMsp) redirect(`/admin/msps/${individualMsp.id}`);
    redirect("/admin?view=individual");
  }

  const cohortMspIds = new Set((msps ?? []).map((msp) => msp.id));
  const latestInvitation = new Map<string, NonNullable<typeof invitations>[number]>();
  for (const invitation of invitations ?? []) {
    if (cohortMspIds.has(invitation.msp_id) && !latestInvitation.has(invitation.msp_id)) {
      latestInvitation.set(invitation.msp_id, invitation);
    }
  }
  const ownerByMsp = new Map((owners ?? []).filter((owner) => owner.msp_id).map((owner) => [owner.msp_id as string, owner]));
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

      <section className="mb-8 rounded-xl border border-line bg-paper p-6 sm:p-8">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Lemhi lead</p>
        <p className="mt-2 max-w-3xl text-base leading-7 text-muted">
          MSPs see this person on their Cohort page as their Lemhi contact. Any active Lemhi admin can lead a cohort.
        </p>
        <div className="mt-5">
          <CohortLeadForm cohortId={cohort.id} leadId={cohort.lead_id} leads={leadOptions} />
        </div>
      </section>

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
            <div key={session.id}>
              <SessionEditor
                cohortId={cohort.id}
                joinUrl={session.join_url ?? ""}
                localStartsAt={formatForLocalInput(session.starts_at, cohort.timezone)}
                sessionId={session.id}
                timezoneLabel={tzLabel}
                title={session.title}
                weekNumber={session.week_number ?? 0}
              />
              <Link className="mt-2 inline-flex text-sm font-semibold text-evergreen hover:underline" href={`/admin/recordings?session=${session.id}`}>
                Upload this session’s recording →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Step 2 · MSP access</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Create a portal</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            Add every MSP and review the cohort first. No email is sent until you choose Send setup link in the roster.
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
                const accessState = owner?.active && !owner.password_setup_required
                  ? "active"
                  : invitation?.status === "pending"
                    ? "invited"
                    : msp.primary_contact_email && msp.primary_contact_name
                      ? "ready"
                      : "draft";
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
                      <p className="font-semibold text-dark-evergreen">{owner?.full_name || msp.primary_contact_name || "Main contact not added"}</p>
                      <p className="mt-1 text-muted">{owner?.email ?? msp.primary_contact_email ?? "Add a name and email before sending access"}</p>
                      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-accent-orange">
                        {accessState === "active"
                          ? "Access active"
                          : accessState === "invited"
                            ? "Setup link sent"
                            : accessState === "ready"
                              ? "Ready to invite"
                              : "Draft"}
                      </p>
                      <MspInvitationControl
                        contactEmail={msp.primary_contact_email}
                        contactName={msp.primary_contact_name}
                        mspId={msp.id}
                        mspName={msp.name}
                        state={accessState}
                      />
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
                No MSP portals yet. Create the first one, finish the roster, then send access individually.
              </div>
            )}
          </div>
        </section>
      </div>

    </AppShell>
  );
}
