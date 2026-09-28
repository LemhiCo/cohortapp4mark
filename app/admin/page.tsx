import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CohortCreateForm } from "@/components/cohort-create-form";
import { SessionTime } from "@/components/session-time";
import { requireAdminProfile } from "@/lib/auth";
import type { Enums } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cohort setup" };

function nextMonday() {
  const date = new Date();
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return date.toISOString().slice(0, 10);
}

const statusStyles: Record<Enums<"cohort_status">, string> = {
  active: "bg-sage text-dark-evergreen",
  ended: "bg-[#EAE5DC] text-muted",
  upcoming: "bg-[#F7E4D6] text-[#6B3216]",
};

export default async function AdminPage() {
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

  const [
    { data: cohorts },
    { data: admins },
    { data: msps },
    { data: owners },
    { data: progress },
    { data: upcomingSessions },
    { data: stuckTasks },
  ] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id, name, start_date, timezone, lead_id, status_override")
      .order("start_date", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("role", "lemhi_admin")
      .eq("active", true)
      .order("full_name"),
    supabase.from("msps").select("id, name, cohort_id, status").order("name"),
    supabase
      .from("profiles")
      .select("id, msp_id, full_name, email, last_seen_at")
      .eq("role", "msp_owner")
      .eq("active", true),
    supabase
      .from("msp_progress")
      .select("msp_id, current_week, overall_completed_tasks, overall_total_tasks, overall_percent, is_behind")
      .order("week_number"),
    supabase
      .from("sessions")
      .select("id, cohort_id, title, starts_at, join_url")
      .eq("kind", "group")
      .gte("starts_at", now.toISOString())
      .order("starts_at")
      .limit(5),
    supabase
      .from("cohort_stuck_tasks")
      .select("cohort_task_id, cohort_id, week_number, title, owner_type, kind, eligible_msps, open_msps")
      .order("open_msps", { ascending: false })
      .order("week_number")
      .limit(40),
  ]);

  // Status and week follow each cohort's own time zone, so ask the database
  // rather than recomputing them here in the server's UTC.
  const cohortTimes = new Map(await Promise.all((cohorts ?? []).map(async (cohort) => {
    const [{ data: status }, { data: week }] = await Promise.all([
      supabase.rpc("effective_cohort_status", { target_cohort_id: cohort.id }),
      supabase.rpc("cohort_current_week", { target_cohort_id: cohort.id }),
    ]);
    return [cohort.id, { status: status ?? "upcoming", week: week ?? 0 }] as const;
  })));
  const adminNames = new Map((admins ?? []).map((admin) => [admin.id, admin.full_name || admin.email]));
  const cohortNames = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));
  const mspCounts = new Map<string, number>();
  for (const msp of msps ?? []) {
    if (msp.status === "active") mspCounts.set(msp.cohort_id, (mspCounts.get(msp.cohort_id) ?? 0) + 1);
  }
  const activeMsps = (msps ?? []).filter((msp) => msp.status === "active");
  const ownerByMsp = new Map((owners ?? []).filter((owner) => owner.msp_id).map((owner) => [owner.msp_id as string, owner]));
  const progressByMsp = new Map<string, NonNullable<typeof progress>[number]>();
  for (const item of progress ?? []) {
    if (item.msp_id && !progressByMsp.has(item.msp_id)) progressByMsp.set(item.msp_id, item);
  }
  const behindCount = activeMsps.filter((msp) => progressByMsp.get(msp.id)?.is_behind).length;
  const neverSignedIn = activeMsps.filter((msp) => !ownerByMsp.get(msp.id)?.last_seen_at).length;
  const inactiveSevenDays = activeMsps.filter((msp) => {
    const lastSeen = ownerByMsp.get(msp.id)?.last_seen_at;
    return Boolean(lastSeen && new Date(lastSeen) < sevenDaysAgo);
  }).length;
  const stuck = (stuckTasks ?? [])
    .filter((task) => task.cohort_id && cohortTimes.get(task.cohort_id)?.status === "active")
    .slice(0, 6);
  const cohortCards = (cohorts ?? [])
    .filter((cohort) => cohortTimes.get(cohort.id)?.status !== "ended")
    .map((cohort) => {
      const cohortMsps = activeMsps.filter((msp) => msp.cohort_id === cohort.id);
      const done = cohortMsps.reduce((sum, msp) => sum + (progressByMsp.get(msp.id)?.overall_completed_tasks ?? 0), 0);
      const total = cohortMsps.reduce((sum, msp) => sum + (progressByMsp.get(msp.id)?.overall_total_tasks ?? 0), 0);
      const week = cohortTimes.get(cohort.id)?.week ?? 0;
      return {
        behind: cohortMsps.filter((msp) => progressByMsp.get(msp.id)?.is_behind).length,
        id: cohort.id,
        msps: cohortMsps.length,
        name: cohort.name,
        percent: total ? Math.round((done / total) * 100) : 0,
        weekLabel: week === 0
          ? `Starts ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${cohort.start_date}T00:00:00Z`))}`
          : week > 4 ? "All four weeks done" : `Week ${week} of 4`,
      };
    });
  const sortedMsps = [...activeMsps].sort((left, right) => {
    const leftProgress = progressByMsp.get(left.id);
    const rightProgress = progressByMsp.get(right.id);
    return Number(Boolean(rightProgress?.is_behind)) - Number(Boolean(leftProgress?.is_behind))
      || (leftProgress?.overall_percent ?? 0) - (rightProgress?.overall_percent ?? 0)
      || left.name.localeCompare(right.name);
  });

  return (
    <AppShell activeNav="cohorts" eyebrow="Admin" profile={profile} title="Cohort setup">
      <section className="mb-8 rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Cohort pulse</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">What needs attention</h2>
          </div>
          <p className="text-sm text-muted">All active MSPs across every cohort</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Active MSPs", activeMsps.length],
            ["Behind schedule", behindCount],
            ["Never signed in", neverSignedIn],
            ["No activity in 7 days", inactiveSevenDays],
          ].map(([label, value]) => (
            <div className="rounded-lg border border-line bg-white/65 p-4" key={label}>
              <p className="text-sm font-semibold text-muted">{label}</p>
              <p className="mt-2 font-serif text-3xl font-bold text-dark-evergreen">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div>
            <h3 className="font-serif text-2xl font-bold text-dark-evergreen">MSP progress</h3>
            <div className="mt-4 divide-y divide-line">
              {sortedMsps.length ? sortedMsps.map((msp) => {
                const owner = ownerByMsp.get(msp.id);
                const mspProgress = progressByMsp.get(msp.id);
                return (
                  <Link className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center" href={`/admin/msps/${msp.id}`} key={msp.id}>
                    <div className="min-w-0">
                      <p className="font-semibold text-dark-evergreen hover:text-evergreen">{msp.name}</p>
                      <p className="mt-1 truncate text-sm text-muted">{cohortNames.get(msp.cohort_id) ?? "Cohort"} · {owner?.full_name || owner?.email || "No owner account"}</p>
                    </div>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${mspProgress?.is_behind ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>
                      {mspProgress?.is_behind ? "Behind" : `Week ${mspProgress?.current_week ?? 0}`}
                    </span>
                    <span className="text-sm font-semibold text-evergreen">{mspProgress?.overall_percent ?? 0}% →</span>
                  </Link>
                );
              }) : <p className="text-sm text-muted">No active MSP portals yet.</p>}
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <h3 className="font-serif text-2xl font-bold text-dark-evergreen">Stuck tasks</h3>
              <p className="mt-1 text-sm text-muted">From weeks that have passed, most MSPs open first.</p>
              <ol className="mt-4 space-y-3">
                {stuck.length ? stuck.map((task) => (
                  <li className="rounded-lg border border-line bg-white/65 p-4" key={task.cohort_task_id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-dark-evergreen">{task.title}</p>
                      <span className="shrink-0 rounded-full bg-[#F7E4D6] px-2.5 py-1 text-xs font-bold text-[#6B3216]">
                        {task.open_msps} of {task.eligible_msps} MSPs
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      Week {task.week_number} · {cohortNames.get(task.cohort_id ?? "") ?? "Cohort"}
                      {task.owner_type === "lemhi" || task.kind === "checkpoint" ? " · Lemhi to complete" : ""}
                    </p>
                  </li>
                )) : <li className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">Nothing is stuck from past weeks.</li>}
              </ol>
            </div>

            <div>
            <h3 className="font-serif text-2xl font-bold text-dark-evergreen">Upcoming sessions</h3>
            <div className="mt-4 space-y-3">
              {upcomingSessions?.length ? upcomingSessions.map((session) => (
                <div className="rounded-lg border border-line bg-white/65 p-4" key={session.id}>
                  <p className="font-semibold text-dark-evergreen">{session.title}</p>
                  <p className="mt-1 text-sm text-muted">{cohortNames.get(session.cohort_id) ?? "Cohort"}</p>
                  <p className="mt-2 text-sm font-semibold text-evergreen">
                    <SessionTime startsAt={session.starts_at} />
                  </p>
                  {!session.join_url ? <p className="mt-2 text-xs font-bold uppercase tracking-wide text-accent-orange">Link coming this week</p> : null}
                </div>
              )) : <p className="rounded-lg border border-dashed border-line p-4 text-sm text-muted">No upcoming sessions.</p>}
            </div>
            </div>
          </div>
        </div>

        {cohortCards.length ? (
          <div className="mt-8">
            <h3 className="font-serif text-2xl font-bold text-dark-evergreen">Every cohort</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cohortCards.map((card) => (
                <Link className="rounded-lg border border-line bg-white/65 p-4 transition hover:border-evergreen" href={`/admin/cohorts/${card.id}`} key={card.id}>
                  <p className="font-semibold text-dark-evergreen">{card.name}</p>
                  <p className="mt-1 text-sm text-muted">{card.weekLabel} · {card.msps} MSP{card.msps === 1 ? "" : "s"}</p>
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <span className="font-serif text-3xl font-bold text-dark-evergreen">{card.percent}%</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${card.behind ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>
                      {card.behind} behind
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sage">
                    <div className="h-full rounded-full bg-evergreen" style={{ width: `${card.percent}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.92fr)_minmax(460px,1.08fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">New cohort</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Set the program cadence</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            Start with the schedule. The portal generates the full four-week program, then takes you straight to session and MSP setup.
          </p>
          <div className="mt-7">
            <CohortCreateForm admins={admins ?? []} defaultLeadId={profile.id} defaultStartDate={nextMonday()} />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Workspace</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Cohorts</h2>
            </div>
            <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-dark-evergreen">
              {cohorts?.length ?? 0} total
            </span>
          </div>

          <div className="mt-6 space-y-3">
            {cohorts?.length ? (
              cohorts.map((cohort) => {
                const status = cohortTimes.get(cohort.id)?.status ?? "upcoming";
                return (
                  <Link
                    className="group block rounded-lg border border-line bg-white/70 p-5 transition hover:-translate-y-0.5 hover:border-evergreen hover:shadow-[0_14px_30px_rgba(18,19,15,0.07)]"
                    href={`/admin/cohorts/${cohort.id}`}
                    key={cohort.id}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-serif text-2xl font-bold text-dark-evergreen group-hover:text-evergreen">
                          {cohort.name}
                        </h3>
                        <p className="mt-2 text-sm text-muted">
                          Starts {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${cohort.start_date}T00:00:00Z`))}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusStyles[status]}`}>
                        {status}
                      </span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-4 text-sm text-muted">
                      <span><strong className="text-dark-evergreen">{mspCounts.get(cohort.id) ?? 0}</strong> MSP portals</span>
                      <span>Lead: <strong className="text-dark-evergreen">{cohort.lead_id ? adminNames.get(cohort.lead_id) ?? "Unassigned" : "Unassigned"}</strong></span>
                      <span className="ml-auto font-semibold text-evergreen">Open setup →</span>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center">
                <p className="font-serif text-2xl font-bold text-dark-evergreen">No cohorts yet</p>
                <p className="mt-2 text-base text-muted">Create the first cohort to generate its schedule and checklist.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
