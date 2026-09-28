import { AppShell } from "@/components/app-shell";
import { SessionPackageForm } from "@/components/session-package-form";
import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session recordings" };

function timezoneLabel(timezone: string) {
  return ({
    "America/Chicago": "Central",
    "America/Denver": "Mountain",
    "America/Los_Angeles": "Pacific",
    "America/New_York": "Eastern",
  } as Record<string, string>)[timezone] ?? timezone;
}

export default async function RecordingsPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session: requestedSessionId } = await searchParams;
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: cohorts }, { data: sessions }, { data: weeks }, { data: msps }, { data: recent }] = await Promise.all([
    supabase.from("cohorts").select("id, name, timezone"),
    supabase.from("sessions").select("id, cohort_id, title, starts_at, week_number").eq("kind", "group").order("starts_at", { ascending: false }),
    supabase.from("cohort_weeks").select("id, cohort_id, week_number"),
    supabase.from("msps").select("id, name, cohort_id").eq("status", "active").order("name"),
    supabase
      .from("assets")
      .select("id, title, category, status, scope, created_at")
      .not("session_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const cohortById = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort]));
  const weekIds = new Map((weeks ?? []).map((week) => [`${week.cohort_id}:${week.week_number}`, week.id]));

  const groupSessions = (sessions ?? []).map((session) => {
    const cohort = cohortById.get(session.cohort_id);
    const when = new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      timeZone: cohort?.timezone ?? "America/New_York",
    }).format(new Date(session.starts_at));
    return {
      cohortId: session.cohort_id,
      cohortWeekId: weekIds.get(`${session.cohort_id}:${session.week_number}`) ?? null,
      id: session.id,
      label: `${cohort?.name ?? "Cohort"} · ${session.title} · ${when}`,
      startsAt: session.starts_at,
      title: session.title,
    };
  });

  const now = new Date();
  const defaultSessionId = groupSessions.find((session) => session.id === requestedSessionId)?.id
    ?? groupSessions.find((session) => new Date(session.startsAt) <= now)?.id
    ?? groupSessions.at(-1)?.id
    ?? "";

  const mspOptions = (msps ?? []).map((msp) => {
    const cohort = cohortById.get(msp.cohort_id);
    return {
      id: msp.id,
      label: `${msp.name} · ${cohort?.name ?? "Cohort"} (${timezoneLabel(cohort?.timezone ?? "America/New_York")})`,
      name: msp.name,
    };
  });

  return (
    <AppShell activeNav="admin-recordings" eyebrow="Admin" profile={profile} title="Session recordings">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">After a session</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Upload session package</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Pick the session, then add the recording, transcript, and summary. Group sessions go to every MSP in that cohort; a 1:1 goes only to that MSP.
          </p>
          <div className="mt-7">
            <SessionPackageForm defaultSessionId={defaultSessionId} groupSessions={groupSessions} msps={mspOptions} />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Latest</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Recent session uploads</h2>
          <div className="mt-6 divide-y divide-line">
            {recent?.length ? recent.map((asset) => (
              <div className="flex items-start justify-between gap-4 py-3 first:pt-0" key={asset.id}>
                <div className="min-w-0">
                  <p className="font-semibold text-dark-evergreen">{asset.title}</p>
                  <p className="mt-1 text-sm text-muted">{asset.scope === "msp" ? "One MSP" : "Whole cohort"}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${asset.status === "ready" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}>{asset.status}</span>
              </div>
            )) : <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">Nothing uploaded from a session yet.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
