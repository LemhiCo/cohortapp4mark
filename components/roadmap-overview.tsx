"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RoadmapWeek = {
  goal: string;
  id: string;
  subtitle: string;
  template_week_id: string | null;
  title: string;
  week_number: number;
};

type RoadmapTask = {
  cohort_week_id: string;
  description: string;
  id: string;
  kind: "checkpoint" | "task";
  owner_label: string;
  owner_type: "lemhi" | "msp";
  position: number;
  template_task_id: string | null;
  title: string;
};

type RoadmapAsset = {
  cohort_task_id: string | null;
  cohort_week_id: string | null;
  external_url: string | null;
  id: string;
  kind: "file" | "link";
  program_task_id: string | null;
  program_week_id: string | null;
  title: string;
};

type WeekProgress = {
  week_completed_tasks: number | null;
  week_number: number | null;
  week_percent: number | null;
  week_total_tasks: number | null;
};

function assetMatchesWeek(asset: RoadmapAsset, week: RoadmapWeek) {
  return asset.cohort_week_id === week.id || Boolean(asset.program_week_id && asset.program_week_id === week.template_week_id);
}

function assetMatchesTask(asset: RoadmapAsset, task: RoadmapTask) {
  return asset.cohort_task_id === task.id || Boolean(asset.program_task_id && asset.program_task_id === task.template_task_id);
}

export function RoadmapOverview({
  assets,
  completedTaskIds,
  currentWeek,
  mode,
  mspId,
  preview,
  progress,
  tasks,
  weeks,
}: {
  assets: RoadmapAsset[];
  completedTaskIds: string[];
  currentWeek: number;
  mode: "cohort" | "individual";
  mspId: string;
  preview: boolean;
  progress: WeekProgress[];
  tasks: RoadmapTask[];
  weeks: RoadmapWeek[];
}) {
  const firstWeek = Math.min(4, Math.max(1, currentWeek));
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(firstWeek);
  const selectedWeek = weeks.find((week) => week.week_number === selectedWeekNumber) ?? weeks[0];
  const selectedProgress = progress.find((item) => item.week_number === selectedWeek?.week_number);
  const completed = useMemo(() => new Set(completedTaskIds), [completedTaskIds]);
  const selectedTasks = tasks.filter((task) => task.cohort_week_id === selectedWeek?.id);
  const selectedAssets = assets.filter((asset) => (
    selectedWeek && (
      assetMatchesWeek(asset, selectedWeek)
      || selectedTasks.some((task) => assetMatchesTask(asset, task))
    )
  ));
  const checklistHref = preview
    ? `/admin/msps/${mspId}/preview/checklist#week-${selectedWeek?.week_number ?? 1}`
    : `/checklist#week-${selectedWeek?.week_number ?? 1}`;

  if (!selectedWeek) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-paper shadow-[0_18px_50px_rgba(18,19,15,0.06)]">
      <div className="border-b border-line px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Your roadmap</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-dark-evergreen sm:text-4xl">The path from foundation to launch</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted">
            {mode === "individual"
              ? "Move through the four stages with your Lemhi lead at the pace that fits your business."
              : "See the full four-week journey. Select a stage to view its requirements and resources."}
          </p>
        </div>

        <div className="relative mt-8 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-0">
          <div aria-hidden="true" className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-1 bg-sage sm:block" />
          {weeks.map((week) => {
            const weekProgress = progress.find((item) => item.week_number === week.week_number);
            const isSelected = week.week_number === selectedWeek.week_number;
            const isComplete = (weekProgress?.week_percent ?? 0) === 100;
            const isCurrent = week.week_number === currentWeek;
            return (
              <button
                aria-pressed={isSelected}
                className="group relative z-10 grid min-h-20 grid-cols-[48px_1fr] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-sage/45 sm:flex sm:min-h-28 sm:flex-col sm:justify-start sm:gap-2 sm:text-center"
                key={week.id}
                onClick={() => setSelectedWeekNumber(week.week_number)}
                type="button"
              >
                <span className={`grid size-12 shrink-0 place-items-center rounded-full border-2 font-serif text-xl font-bold transition ${
                  isSelected
                    ? "border-dark-evergreen bg-dark-evergreen text-white shadow-[0_0_0_5px_rgba(223,232,222,0.95)]"
                    : isComplete
                      ? "border-evergreen bg-evergreen text-white"
                      : "border-line bg-paper text-dark-evergreen"
                }`}>
                  {isComplete ? "✓" : week.week_number}
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-accent-orange">
                    {mode === "individual" ? `Stage ${week.week_number}` : `Week ${week.week_number}`}
                    {isCurrent ? " · Now" : ""}
                  </span>
                  <span className="mt-1 block font-semibold leading-5 text-dark-evergreen">{week.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-background/55 px-6 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-orange">
              {mode === "individual" ? `Stage ${selectedWeek.week_number}` : `Week ${selectedWeek.week_number}`} · {selectedProgress?.week_percent ?? 0}% complete
            </p>
            <h3 className="mt-2 font-serif text-3xl font-bold text-dark-evergreen">{selectedWeek.title}</h3>
            <p className="mt-1 text-base font-semibold text-evergreen">{selectedWeek.subtitle}</p>
            <p className="mt-4 text-base leading-7 text-muted"><strong className="text-dark-evergreen">Outcome:</strong> {selectedWeek.goal}</p>
          </div>
          <Link className="rounded-md border border-evergreen px-4 py-2.5 text-sm font-semibold text-evergreen transition hover:bg-sage" href={checklistHref}>
            Open full checklist →
          </Link>
        </div>

        <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-serif text-2xl font-bold text-dark-evergreen">Requirements</h4>
              <span className="text-sm font-semibold text-muted">
                {selectedProgress?.week_completed_tasks ?? 0} of {selectedProgress?.week_total_tasks ?? selectedTasks.length} done
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {selectedTasks.map((task) => {
                const isDone = completed.has(task.id);
                return (
                  <div className={`rounded-lg border p-4 ${isDone ? "border-evergreen/25 bg-sage/55" : "border-line bg-paper"}`} key={task.id}>
                    <div className="flex items-start gap-3">
                      <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold ${isDone ? "bg-evergreen text-white" : "border border-line bg-white text-muted"}`}>
                        {isDone ? "✓" : task.position}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-5 text-dark-evergreen">{task.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">{task.description}</p>
                        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-accent-orange">
                          {task.owner_type === "msp" ? "Your team" : "Lemhi"} · {task.kind === "checkpoint" ? "Checkpoint" : task.owner_label}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="rounded-lg border border-line bg-paper p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-orange">Resources for this stage</p>
            <h4 className="mt-2 font-serif text-2xl font-bold text-dark-evergreen">Relevant assets</h4>
            <div className="mt-4 space-y-2">
              {selectedAssets.length ? selectedAssets.map((asset) => (
                <a
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-white px-3 py-3 text-sm font-semibold text-evergreen transition hover:border-evergreen"
                  href={asset.kind === "link" && asset.external_url ? asset.external_url : `/api/assets/${asset.id}`}
                  key={asset.id}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{asset.title}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )) : (
                <p className="rounded-md border border-dashed border-line px-3 py-4 text-sm leading-6 text-muted">
                  Resources linked to this stage will appear here.
                </p>
              )}
            </div>
            <Link className="mt-4 inline-flex text-sm font-semibold text-evergreen hover:underline" href={preview ? `/admin/msps/${mspId}/preview/library` : "/library"}>
              Browse the full library →
            </Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
