import { AppShell } from "@/components/app-shell";
import { AddProgramTaskForm, ProgramTaskEditor, WeekEditor } from "@/components/program-editor";
import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Program" };

export default async function ProgramPage() {
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: allPrograms }, { data: weeks }, { data: tasks }, { data: cohorts }] = await Promise.all([
    supabase.from("programs").select("id, name, active").order("active", { ascending: false }).order("name"),
    supabase.from("program_weeks").select("id, program_id, week_number, title, subtitle, goal").order("week_number"),
    supabase.from("program_tasks").select("id, week_id, position, title, description, owner_label, owner_type, kind, archived_at").order("position"),
    supabase.from("cohorts").select("id, program_id"),
  ]);

  // Edits only reach cohorts that haven't ended; say how many that is.
  const statuses = await Promise.all((cohorts ?? []).map(async (cohort) => {
    const { data } = await supabase.rpc("effective_cohort_status", { target_cohort_id: cohort.id });
    return { programId: cohort.program_id, running: data !== "ended" };
  }));
  // The active program is used for new cohorts; an older program stays
  // editable while any cohort still runs on it.
  const programs = (allPrograms ?? []).filter((program) =>
    program.active || statuses.some((status) => status.programId === program.id && status.running));

  return (
    <AppShell activeNav="admin-program" eyebrow="Admin" profile={profile} title="Program">
      <div className="space-y-10">
        {programs.map((program) => {
          const running = statuses.filter((status) => status.programId === program.id && status.running).length;
          const programWeeks = (weeks ?? []).filter((week) => week.program_id === program.id);
          return (
            <section className="space-y-5" key={program.id}>
              <div className="rounded-xl border border-line bg-paper p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Four-week program</p>
                <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">{program.name}</h2>
                {program.active ? null : (
                  <p className="mt-2 text-sm font-semibold text-[#6B3216]">Not used for new cohorts, but still running in existing ones.</p>
                )}
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted">
                  Changes here reach {running === 1 ? "the 1 upcoming or active cohort" : `all ${running} upcoming and active cohorts`} immediately. Ended cohorts keep their checklist as it was.
                </p>
              </div>

              {programWeeks.map((week) => {
                const weekTasks = (tasks ?? []).filter((task) => task.week_id === week.id);
                const activeTasks = weekTasks.filter((task) => !task.archived_at);
                const archivedTasks = weekTasks.filter((task) => task.archived_at);
                return (
                  <div className="rounded-xl border border-line bg-paper p-6 sm:p-8" key={week.id}>
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sage font-serif text-xl font-bold text-dark-evergreen">{week.week_number}</div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-serif text-2xl font-bold text-dark-evergreen">{week.title}</h3>
                        <p className="mt-1 text-sm text-muted">{week.subtitle}</p>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted"><strong className="text-dark-evergreen">Goal:</strong> {week.goal}</p>
                      </div>
                      <span className="text-sm font-semibold text-muted">{activeTasks.length} tasks</span>
                    </div>
                    <div className="mt-4">
                      <WeekEditor goal={week.goal} subtitle={week.subtitle} title={week.title} weekId={week.id} />
                    </div>

                    <ol className="mt-5 space-y-3">
                      {activeTasks.map((task) => (
                        <li className="rounded-lg border border-line bg-white p-4" key={task.id}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <h4 className="font-bold text-dark-evergreen">{task.title}</h4>
                            <div className="flex flex-wrap gap-2">
                              {task.kind === "checkpoint" ? <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-muted">Checkpoint</span> : null}
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${task.owner_type === "lemhi" ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>{task.owner_type === "lemhi" ? "Lemhi" : "MSP"}</span>
                            </div>
                          </div>
                          {task.description ? <p className="mt-2 text-sm leading-6 text-muted">{task.description}</p> : null}
                          <p className="mt-2 text-sm text-muted">Owner: <strong className="text-dark-evergreen">{task.owner_label}</strong></p>
                          <ProgramTaskEditor
                            archived={false}
                            taskId={task.id}
                            values={{ description: task.description, kind: task.kind, ownerLabel: task.owner_label, ownerType: task.owner_type, title: task.title }}
                          />
                        </li>
                      ))}
                    </ol>

                    {archivedTasks.length ? (
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-semibold text-muted">Archived tasks ({archivedTasks.length})</summary>
                        <ul className="mt-3 space-y-3">
                          {archivedTasks.map((task) => (
                            <li className="rounded-lg border border-dashed border-line bg-background/60 p-4" key={task.id}>
                              <p className="font-semibold text-muted line-through">{task.title}</p>
                              <ProgramTaskEditor
                                archived
                                taskId={task.id}
                                values={{ description: task.description, kind: task.kind, ownerLabel: task.owner_label, ownerType: task.owner_type, title: task.title }}
                              />
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}

                    <div className="mt-5">
                      <AddProgramTaskForm weekId={week.id} weekNumber={week.week_number} />
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
