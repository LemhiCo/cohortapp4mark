import { AppShell } from "@/components/app-shell";
import { TaskCompletionButton } from "@/components/task-completion-button";
import { TaskNoteForm } from "@/components/task-note-form";
import { requireMspProfile } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checklist" };

type Asset = Pick<
  Tables<"assets">,
  "id" | "title" | "kind" | "external_url" | "category" | "program_week_id" | "program_task_id" | "cohort_week_id" | "cohort_task_id"
>;

function formatCompletionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function attachmentMatchesTask(asset: Asset, task: Tables<"cohort_tasks">) {
  return asset.cohort_task_id === task.id || (asset.program_task_id && asset.program_task_id === task.template_task_id);
}

function attachmentMatchesWeek(asset: Asset, week: Tables<"cohort_weeks">) {
  return asset.cohort_week_id === week.id || (asset.program_week_id && asset.program_week_id === week.template_week_id);
}

export default async function ChecklistPage() {
  const profile = await requireMspProfile();
  const supabase = await createServerSupabaseClient();
  const { data: msp } = await supabase
    .from("msps")
    .select("id, name, cohort_id")
    .eq("id", profile.msp_id)
    .single();

  if (!msp) return null;

  const [{ data: cohort }, { data: weeks }, { data: tasks }, { data: completions }, { data: notes }, { data: assets }, { data: progress }, { data: members }, { data: cohortStatus }] = await Promise.all([
    supabase.from("cohorts").select("id, name").eq("id", msp.cohort_id).single(),
    supabase.from("cohort_weeks").select("*").eq("cohort_id", msp.cohort_id).order("week_number"),
    supabase.from("cohort_tasks").select("*").eq("cohort_id", msp.cohort_id).order("position"),
    supabase.from("task_completions").select("*").eq("msp_id", profile.msp_id),
    supabase.from("task_notes").select("*").eq("msp_id", profile.msp_id).order("created_at"),
    supabase
      .from("assets")
      .select("id, title, kind, external_url, category, program_week_id, program_task_id, cohort_week_id, cohort_task_id")
      .eq("status", "ready")
      .order("created_at"),
    supabase.from("msp_progress").select("*").eq("msp_id", profile.msp_id).order("week_number"),
    supabase.from("profiles").select("id, full_name, email").eq("msp_id", profile.msp_id),
    supabase.rpc("effective_cohort_status", { target_cohort_id: msp.cohort_id }),
  ]);

  if (!cohort) return null;

  const currentWeek = progress?.[0]?.current_week ?? 0;
  const displayWeek = Math.min(4, Math.max(1, currentWeek));
  const isReadOnly = cohortStatus === "ended" || currentWeek > 4;
  const overallPercent = progress?.[0]?.overall_percent ?? 0;
  const overallCompleted = progress?.[0]?.overall_completed_tasks ?? 0;
  const overallTotal = progress?.[0]?.overall_total_tasks ?? 0;
  const completionByTask = new Map((completions ?? []).map((completion) => [completion.cohort_task_id, completion]));
  const memberNames = new Map((members ?? []).map((member) => [member.id, member.full_name || member.email]));
  const notesByTask = new Map<string, NonNullable<typeof notes>>();
  for (const note of notes ?? []) {
    const taskNotes = notesByTask.get(note.cohort_task_id) ?? [];
    taskNotes.push(note);
    notesByTask.set(note.cohort_task_id, taskNotes);
  }

  return (
    <AppShell activeNav="checklist" eyebrow={msp.name} profile={profile} title="Checklist">
      <div className="-mt-5 mb-8 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>{cohort.name}</span>
        <span className="text-line">·</span>
        <span>{isReadOnly ? "Read-only" : currentWeek === 0 ? "Starts soon" : `Week ${currentWeek} of 4`}</span>
      </div>

      <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <p className="font-serif text-5xl font-bold text-dark-evergreen">{overallPercent}%</p>
              <p className="text-base text-muted">{overallCompleted} of {overallTotal} tasks complete</p>
            </div>
            <div className="mt-5 h-3 max-w-3xl overflow-hidden rounded-full bg-sage">
              <div className="h-full rounded-full bg-evergreen transition-[width]" style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {progress?.map((item) => (
              <span
                className={`rounded-full px-3 py-1.5 font-semibold ${item.week_number === displayWeek ? "bg-dark-evergreen text-white" : "bg-sage text-dark-evergreen"}`}
                key={item.week_number}
              >
                W{item.week_number} · {item.week_percent}%
              </span>
            ))}
          </div>
        </div>
        {progress?.[0]?.is_behind ? (
          <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm font-semibold text-[#6B3216]">
            A previous week still has open work. You can catch up below.
          </p>
        ) : null}
        {isReadOnly ? (
          <p className="mt-5 rounded-md bg-sage px-4 py-3 text-sm font-semibold text-dark-evergreen">
            This cohort has ended. Your checklist and notes remain available to review.
          </p>
        ) : null}
      </section>

      <div className="mt-8 space-y-5">
        {weeks?.map((week) => {
          const weekProgress = progress?.find((item) => item.week_number === week.week_number);
          const weekTasks = (tasks ?? []).filter((task) => task.cohort_week_id === week.id);
          const weekAssets = (assets ?? []).filter((asset) => attachmentMatchesWeek(asset, week));
          const isPastWithOpenWork = week.week_number < currentWeek && (weekProgress?.week_percent ?? 0) < 100;
          const isCurrent = week.week_number === displayWeek;

          return (
            <details className="group overflow-hidden rounded-xl border border-line bg-paper" key={week.id} open={isCurrent}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
                <div className={`grid size-12 shrink-0 place-items-center rounded-full font-serif text-xl font-bold ${isCurrent ? "bg-evergreen text-white" : "bg-sage text-dark-evergreen"}`}>
                  {week.week_number}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-serif text-2xl font-bold text-dark-evergreen">{week.title}</h2>
                    {isCurrent && currentWeek <= 4 ? <span className="rounded-full bg-[#F7E4D6] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#6B3216]">Current week</span> : null}
                    {isPastWithOpenWork ? <span className="rounded-full bg-[#F7E4D6] px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-[#6B3216]">Catch up</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">{week.subtitle}</p>
                </div>
                <div className="ml-auto flex items-center gap-4">
                  <span className="text-sm font-semibold text-muted">{weekProgress?.week_completed_tasks ?? 0}/{weekProgress?.week_total_tasks ?? 0}</span>
                  <span aria-hidden="true" className="text-xl text-evergreen transition group-open:rotate-45">+</span>
                </div>
              </summary>

              <div className="border-t border-line bg-background/45 p-5 sm:p-6">
                <p className="max-w-3xl text-base leading-7 text-muted"><strong className="text-dark-evergreen">Goal:</strong> {week.goal}</p>
                {weekAssets.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {weekAssets.map((asset) => asset.kind === "link" && asset.external_url ? (
                      <a className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-evergreen hover:border-evergreen" href={asset.external_url} key={asset.id} target="_blank" rel="noreferrer">
                        {asset.title} ↗
                      </a>
                    ) : (
                      <span className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-muted" key={asset.id}>{asset.title} · Library</span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-6 space-y-4">
                  {weekTasks.map((task) => {
                    const completion = completionByTask.get(task.id);
                    const taskNotes = notesByTask.get(task.id) ?? [];
                    const taskAssets = (assets ?? []).filter((asset) => attachmentMatchesTask(asset, task));
                    const canCheck = !isReadOnly && task.owner_type === "msp" && task.kind === "task";
                    const completedBy = completion
                      ? memberNames.get(completion.completed_by) ?? (task.owner_type === "lemhi" ? "Lemhi team" : "Your team")
                      : null;

                    return (
                      <article className={`rounded-lg border p-4 sm:p-5 ${completion ? "border-evergreen/25 bg-sage/45" : "border-line bg-white"}`} key={task.id}>
                        <div className="flex items-start gap-4">
                          {canCheck ? (
                            <TaskCompletionButton completed={Boolean(completion)} taskId={task.id} />
                          ) : (
                            <div aria-label={completion ? "Complete" : "Not complete"} className={`grid size-8 shrink-0 place-items-center rounded-md border-2 text-sm font-bold ${completion ? "border-evergreen bg-evergreen text-white" : "border-line bg-background text-transparent"}`}>✓</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <h3 className={`text-base font-bold ${completion ? "text-evergreen" : "text-dark-evergreen"}`}>{task.title}</h3>
                                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{task.description}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {task.kind === "checkpoint" ? <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">Checkpoint</span> : null}
                                <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${task.owner_type === "msp" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}>
                                  {task.owner_type === "msp" ? "Your team" : "Lemhi"}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                              <span>Owner: <strong className="text-dark-evergreen">{task.owner_label}</strong></span>
                              {completion ? <span>Done by {completedBy} · {formatCompletionDate(completion.completed_at)}</span> : <span>Open</span>}
                            </div>
                            {taskAssets.length ? (
                              <div className="mt-4 flex flex-wrap gap-2">
                                {taskAssets.map((asset) => asset.kind === "link" && asset.external_url ? (
                                  <a className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-evergreen hover:border-evergreen" href={asset.external_url} key={asset.id} target="_blank" rel="noreferrer">{asset.title} ↗</a>
                                ) : <span className="rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-muted" key={asset.id}>{asset.title} · Library</span>)}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <details className="mt-4 border-t border-line pt-4">
                          <summary className="cursor-pointer text-sm font-semibold text-evergreen">
                            Notes{taskNotes.length ? ` (${taskNotes.length})` : ""}
                          </summary>
                          <div className="mt-4 space-y-3">
                            {taskNotes.length ? taskNotes.map((note) => (
                              <div className="rounded-md bg-background px-4 py-3" key={note.id}>
                                <div className="flex flex-wrap justify-between gap-2 text-sm">
                                  <strong className="text-dark-evergreen">{memberNames.get(note.author_id) ?? "Lemhi team"}</strong>
                                  <span className="text-muted">{formatCompletionDate(note.created_at)}</span>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{note.body}</p>
                              </div>
                            )) : <p className="text-sm text-muted">No notes yet.</p>}
                          </div>
                          {!isReadOnly ? <TaskNoteForm taskId={task.id} /> : null}
                        </details>
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </AppShell>
  );
}
