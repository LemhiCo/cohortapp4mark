import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MspPreviewBar } from "@/components/msp-views/preview-bar";
import { RoadmapOverview } from "@/components/roadmap-overview";
import { SessionTime } from "@/components/session-time";
import type { CurrentProfile } from "@/lib/auth";
import { isUuid, mspTasksFilter, visibleAssetsFilter } from "@/lib/msp-visibility";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatDateRange(startDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 27);
  const format = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${format.format(start)} – ${format.format(end)}`;
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type CohortViewProps = {
  mspId: string;
  /** An admin's read-only "View as MSP" preview rather than the MSP's own page. */
  preview: boolean;
  profile: CurrentProfile;
};

export async function CohortView({ mspId, preview, profile }: CohortViewProps) {
  if (!isUuid(mspId)) notFound();
  const supabase = await createServerSupabaseClient();
  const { data: msp } = await supabase
    .from("msps")
    .select("id, name, cohort_id")
    .eq("id", mspId)
    .maybeSingle();

  if (!msp) notFound();

  // MSPs read the lead and their peers through the restricted views, which
  // only answer for the signed-in MSP. An admin previewing reads the same
  // columns directly.
  const leadQuery = preview
    ? supabase.from("cohorts").select("lead:profiles!cohorts_lead_id_fkey(full_name, email, title, photo_path, role, active)").eq("id", msp.cohort_id).maybeSingle()
    : supabase.from("cohort_leads").select("full_name, email, title, photo_path").eq("cohort_id", msp.cohort_id).maybeSingle();
  const peersQuery = preview
    ? supabase.from("msps").select("id, name, website, logo_path").eq("cohort_id", msp.cohort_id).eq("status", "active").neq("id", msp.id).order("name")
    : supabase.from("cohort_peers").select("id, name, website, logo_path").order("name");

  const [{ data: cohort }, { data: weeks }, { data: sessions }, { data: progress }, { data: leadRow }, { data: peers }, { data: tasks }, { data: hidden }, { data: completions }, { data: assets }, { data: cohortStatus }] = await Promise.all([
    supabase.from("cohorts").select("id, name, start_date, timezone, workspace_type").eq("id", msp.cohort_id).single(),
    supabase.from("cohort_weeks").select("id, week_number, title, subtitle, goal, template_week_id").eq("cohort_id", msp.cohort_id).order("week_number"),
    supabase.from("sessions").select("id, title, starts_at, join_url, week_number").eq("cohort_id", msp.cohort_id).eq("kind", "group").order("starts_at"),
    supabase.from("msp_progress").select("*").eq("msp_id", msp.id).order("week_number"),
    leadQuery,
    peersQuery,
    supabase.from("cohort_tasks").select("id, cohort_week_id, template_task_id, position, title, description, owner_label, owner_type, kind").eq("cohort_id", msp.cohort_id).is("archived_at", null).or(mspTasksFilter(msp.id)).order("position"),
    supabase.from("msp_hidden_tasks").select("cohort_task_id").eq("msp_id", msp.id),
    supabase.from("task_completions").select("cohort_task_id").eq("msp_id", msp.id),
    supabase
      .from("assets")
      .select("id, title, kind, external_url, program_week_id, program_task_id, cohort_week_id, cohort_task_id")
      .eq("status", "ready")
      .or(visibleAssetsFilter(msp.cohort_id, msp.id))
      .order("created_at"),
    supabase.rpc("effective_cohort_status", { target_cohort_id: msp.cohort_id }),
  ]);

  if (!cohort) notFound();

  const lead = leadRow && "lead" in leadRow
    ? (leadRow.lead && leadRow.lead.role === "lemhi_admin" && leadRow.lead.active ? leadRow.lead : null)
    : leadRow;
  const hiddenIds = new Set((hidden ?? []).map((row) => row.cohort_task_id));
  const visibleTasks = (tasks ?? []).filter((task) => !hiddenIds.has(task.id));

  const currentWeek = progress?.[0]?.current_week ?? 0;
  const isEnded = cohortStatus === "ended";
  const displayWeek = Math.min(4, Math.max(1, currentWeek));
  const week = weeks?.find((item) => item.week_number === displayWeek);
  const weekTaskIds = new Set(visibleTasks.filter((task) => task.cohort_week_id === week?.id).map((task) => task.id));
  const completedIds = new Set((completions ?? []).map((completion) => completion.cohort_task_id));
  const openThisWeek = [...weekTaskIds].filter((taskId) => !completedIds.has(taskId)).length;
  const nextSession = isEnded || currentWeek > 4
    ? undefined
    : sessions?.find((session) => (session.week_number ?? 0) >= displayWeek);
  const overallPercent = progress?.[0]?.overall_percent ?? 0;
  const isIndividual = cohort.workspace_type === "individual";

  return (
    <AppShell activeNav={preview ? "cohorts" : "cohort"} eyebrow={msp.name} profile={profile} title={isIndividual ? "Your growth roadmap" : cohort.name}>
      {preview ? <MspPreviewBar active="cohort" mspId={msp.id} mspName={msp.name} /> : null}
      <div className={`${preview ? "" : "-mt-5 "}mb-8 flex flex-wrap items-center gap-3 text-sm text-muted`}>
        <span>{isIndividual ? `Independent program · Started ${new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${cohort.start_date}T00:00:00Z`))}` : formatDateRange(cohort.start_date)}</span>
        <span className="text-line">·</span>
        <span>{isEnded || currentWeek > 4 ? "Program complete" : currentWeek === 0 ? "Starts soon" : `${isIndividual ? "Stage" : "Week"} ${currentWeek} of 4`}</span>
      </div>

      <RoadmapOverview
        assets={assets ?? []}
        completedTaskIds={(completions ?? []).map((completion) => completion.cohort_task_id)}
        currentWeek={currentWeek}
        mode={isIndividual ? "individual" : "cohort"}
        mspId={msp.id}
        preview={preview}
        progress={progress ?? []}
        tasks={visibleTasks}
        weeks={weeks ?? []}
      />

      <section className="mt-8 overflow-hidden rounded-xl bg-dark-evergreen text-white shadow-[0_22px_60px_rgba(15,36,24,0.17)]">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="p-6 sm:p-8 lg:p-10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#E7A16D]">
              {isEnded || currentWeek > 4 ? "Program complete" : currentWeek === 0 ? "First up" : `Current focus · ${isIndividual ? "Stage" : "Week"} ${currentWeek}`}
            </p>
            <h2 className="mt-4 font-serif text-4xl font-bold">{week?.title ?? "Your cohort program"}</h2>
            <p className="mt-2 text-lg text-white/75">{week?.subtitle}</p>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/85">{week?.goal}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="min-h-11 rounded-md bg-white px-5 py-3 font-semibold text-dark-evergreen transition hover:bg-sage" href={preview ? `/admin/msps/${msp.id}/preview/checklist` : "/checklist"}>
                Open checklist
              </Link>
              <span className="flex min-h-11 items-center rounded-md border border-white/20 px-4 text-sm text-white/75">
                {openThisWeek} open this week
              </span>
            </div>
          </div>
          <div className="border-t border-white/10 bg-white/5 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-white/70">Overall progress</span>
              <span className="font-serif text-3xl font-bold">{overallPercent}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#E7A16D]" style={{ width: `${overallPercent}%` }} />
            </div>
            <div className="mt-8 border-t border-white/10 pt-7">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#E7A16D]">{isIndividual ? "How it works" : "Next session"}</p>
              {isIndividual ? (
                <>
                  <h3 className="mt-3 font-serif text-2xl font-bold">Move at your pace</h3>
                  <p className="mt-2 leading-6 text-white/75">Use the roadmap above and work directly with your Lemhi lead. There are no cohort sessions or peer-company visibility.</p>
                </>
              ) : nextSession ? (
                <>
                  <h3 className="mt-3 font-serif text-2xl font-bold">{nextSession.title}</h3>
                  <p className="mt-2 text-white/75"><SessionTime startsAt={nextSession.starts_at} /></p>
                  {nextSession.join_url ? (
                    <a className="mt-5 inline-flex min-h-11 items-center rounded-md border border-white/30 px-4 font-semibold hover:bg-white/10" href={nextSession.join_url} target="_blank" rel="noreferrer">
                      Join session ↗
                    </a>
                  ) : <p className="mt-4 text-sm text-white/55">Link coming this week</p>}
                </>
              ) : <p className="mt-3 text-white/65">All scheduled sessions are complete.</p>}
            </div>
          </div>
        </div>
      </section>

      <div className={`mt-8 grid gap-8 ${isIndividual ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]"}`}>
        {!isIndividual ? <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Four-week schedule</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Sessions</h2>
            </div>
            <span className="text-sm text-muted">Times shown for your device</span>
          </div>
          <div className="mt-6 divide-y divide-line">
            {sessions?.map((session) => {
              const sessionProgress = progress?.find((item) => item.week_number === session.week_number);
              return (
                <div className="grid gap-3 py-5 first:pt-0 sm:grid-cols-[72px_1fr_auto] sm:items-center" key={session.id}>
                  <span className="text-sm font-bold uppercase tracking-wide text-accent-orange">Week {session.week_number}</span>
                  <div>
                    <h3 className="font-semibold text-dark-evergreen">{session.title}</h3>
                    <p className="mt-1 text-sm text-muted"><SessionTime startsAt={session.starts_at} /></p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-muted">{sessionProgress?.week_percent ?? 0}% done</span>
                    {session.join_url ? (
                      <a className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-evergreen hover:border-evergreen" href={session.join_url} target="_blank" rel="noreferrer">Join ↗</a>
                    ) : (
                      <span className="text-sm font-semibold text-muted">Link coming this week</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section> : null}

        <div className={`space-y-8 ${isIndividual ? "max-w-2xl" : ""}`}>
          <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Your Lemhi lead</p>
            {lead ? (
              <div className="mt-5 flex items-center gap-4">
                <div className="grid size-14 shrink-0 place-items-center rounded-full bg-evergreen font-serif text-xl font-bold text-white">
                  {initials(lead.full_name || "Lemhi")}
                </div>
                <div className="min-w-0">
                  <h2 className="font-serif text-2xl font-bold text-dark-evergreen">{lead.full_name || "Your Lemhi lead"}</h2>
                  <p className="mt-1 text-sm text-muted">{lead.title || "Cohort lead"}</p>
                  {lead.email ? <a className="mt-2 block truncate text-sm font-semibold text-evergreen hover:underline" href={`mailto:${lead.email}`}>{lead.email}</a> : null}
                </div>
              </div>
            ) : <p className="mt-4 text-base text-muted">Your cohort lead will appear here once assigned.</p>}
          </section>

          {!isIndividual ? <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">In your cohort</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Peer companies</h2>
            <div className="mt-5 space-y-3">
              {peers?.length ? peers.map((peer) => (
                <div className="flex items-center gap-3 rounded-lg border border-line bg-white/60 p-3" key={peer.id}>
                  {peer.logo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`${peer.name ?? "MSP"} logo`} className="size-10 shrink-0 rounded-md border border-line bg-white object-contain p-1" src={`/api/logos/${peer.id}`} />
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-sage font-serif font-bold text-dark-evergreen">{initials(peer.name ?? "MSP")}</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-dark-evergreen">{peer.name ?? "Cohort company"}</p>
                    {peer.website ? <a className="block truncate text-sm text-evergreen hover:underline" href={peer.website} target="_blank" rel="noreferrer">{peer.website.replace(/^https?:\/\//, "")}</a> : null}
                  </div>
                </div>
              )) : <p className="text-base text-muted">Other cohort companies will appear here as they join.</p>}
            </div>
          </section> : null}
        </div>
      </div>
    </AppShell>
  );
}
