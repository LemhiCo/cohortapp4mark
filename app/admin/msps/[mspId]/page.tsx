import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTaskButton, AdminTaskNoteForm } from "@/components/admin-task-controls";
import { AppShell } from "@/components/app-shell";
import { requireAdminProfile } from "@/lib/auth";
import type { Tables } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function canAdminComplete(task: Tables<"cohort_tasks">) {
  return task.owner_type === "lemhi" || task.kind === "checkpoint";
}

export default async function AdminMspPage({ params }: { params: Promise<{ mspId: string }> }) {
  const { mspId } = await params;
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();
  const { data: msp } = await supabase
    .from("msps")
    .select("id, name, website, status, cohort_id")
    .eq("id", mspId)
    .maybeSingle();

  if (!msp) notFound();

  const [
    { data: cohort },
    { data: weeks },
    { data: tasks },
    { data: completions },
    { data: notes },
    { data: people },
    { data: invitations },
    { data: progress },
    { data: assets },
  ] = await Promise.all([
    supabase.from("cohorts").select("id, name").eq("id", msp.cohort_id).single(),
    supabase.from("cohort_weeks").select("*").eq("cohort_id", msp.cohort_id).order("week_number"),
    supabase.from("cohort_tasks").select("*").eq("cohort_id", msp.cohort_id).is("archived_at", null).order("position"),
    supabase.from("task_completions").select("*").eq("msp_id", msp.id),
    supabase.from("task_notes").select("*").eq("msp_id", msp.id).order("created_at"),
    supabase.from("profiles").select("id, email, full_name, role, active").eq("msp_id", msp.id).order("role"),
    supabase.from("invitations").select("id, email, role, status, created_at").eq("msp_id", msp.id).order("created_at", { ascending: false }),
    supabase.from("msp_progress").select("*").eq("msp_id", msp.id).order("week_number"),
    supabase.from("assets").select("id, title, category, kind, scope, external_url, cohort_id, msp_id, status").eq("status", "ready").order("created_at", { ascending: false }),
  ]);

  if (!cohort) notFound();

  const visibleTasks = (tasks ?? []).filter((task) => task.msp_id === null || task.msp_id === msp.id);
  const completionByTask = new Map((completions ?? []).map((completion) => [completion.cohort_task_id, completion]));
  const personNames = new Map((people ?? []).map((person) => [person.id, person.full_name || person.email]));
  personNames.set(profile.id, profile.full_name || profile.email);
  const notesByTask = new Map<string, NonNullable<typeof notes>>();
  for (const note of notes ?? []) {
    const thread = notesByTask.get(note.cohort_task_id) ?? [];
    thread.push(note);
    notesByTask.set(note.cohort_task_id, thread);
  }
  const visibleAssets = (assets ?? []).filter((asset) =>
    asset.scope === "program" ||
    (asset.scope === "cohort" && asset.cohort_id === msp.cohort_id) ||
    (asset.scope === "msp" && asset.msp_id === msp.id),
  );
  const overall = progress?.[0];

  return (
    <AppShell activeNav="cohorts" eyebrow="Admin · MSP" profile={profile} title={msp.name}>
      <div className="-mt-5 mb-8 flex flex-wrap items-center gap-3 text-sm">
        <Link className="font-semibold text-evergreen hover:underline" href={`/admin/cohorts/${msp.cohort_id}`}>← {cohort.name}</Link>
        <span className="text-line">/</span>
        <span className="capitalize text-muted">{msp.status}</span>
        {msp.website ? <><span className="text-line">·</span><a className="text-evergreen hover:underline" href={msp.website} rel="noreferrer" target="_blank">Website ↗</a></> : null}
      </div>

      <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Overall progress</p>
            <div className="mt-3 flex flex-wrap items-baseline gap-4">
              <p className="font-serif text-5xl font-bold text-dark-evergreen">{overall?.overall_percent ?? 0}%</p>
              <p className="text-muted">{overall?.overall_completed_tasks ?? 0} of {overall?.overall_total_tasks ?? 0} tasks complete</p>
            </div>
            <div className="mt-5 h-3 max-w-3xl overflow-hidden rounded-full bg-sage">
              <div className="h-full rounded-full bg-evergreen" style={{ width: `${overall?.overall_percent ?? 0}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {progress?.map((week) => <span className="rounded-full bg-sage px-3 py-1.5 font-semibold text-dark-evergreen" key={week.week_number}>W{week.week_number} · {week.week_percent}%</span>)}
          </div>
        </div>
        {overall?.is_behind ? <p className="mt-5 rounded-md bg-[#F7E4D6] px-4 py-3 text-sm font-semibold text-[#6B3216]">This MSP has open work from a previous week.</p> : null}
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <section className="space-y-5">
          {weeks?.map((week) => {
            const weekTasks = visibleTasks.filter((task) => task.cohort_week_id === week.id);
            const weekProgress = progress?.find((item) => item.week_number === week.week_number);
            return (
              <details className="group overflow-hidden rounded-xl border border-line bg-paper" key={week.id} open={week.week_number === (overall?.current_week || 1)}>
                <summary className="flex cursor-pointer list-none items-center gap-4 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
                  <div className="grid size-11 shrink-0 place-items-center rounded-full bg-sage font-serif text-xl font-bold text-dark-evergreen">{week.week_number}</div>
                  <div className="min-w-0 flex-1"><h2 className="font-serif text-2xl font-bold text-dark-evergreen">{week.title}</h2><p className="mt-1 text-sm text-muted">{week.subtitle}</p></div>
                  <span className="text-sm font-semibold text-muted">{weekProgress?.week_completed_tasks ?? 0}/{weekProgress?.week_total_tasks ?? 0}</span>
                  <span className="text-xl text-evergreen transition group-open:rotate-45">+</span>
                </summary>
                <div className="space-y-4 border-t border-line bg-background/45 p-5 sm:p-6">
                  {weekTasks.map((task) => {
                    const completion = completionByTask.get(task.id);
                    const taskNotes = notesByTask.get(task.id) ?? [];
                    return (
                      <article className={`rounded-lg border p-4 sm:p-5 ${completion ? "border-evergreen/25 bg-sage/45" : "border-line bg-white"}`} key={task.id}>
                        <div className="flex items-start gap-4">
                          {canAdminComplete(task) ? <AdminTaskButton completed={Boolean(completion)} mspId={msp.id} taskId={task.id} /> : <div className={`grid size-8 shrink-0 place-items-center rounded-md border-2 text-sm font-bold ${completion ? "border-evergreen bg-evergreen text-white" : "border-line text-transparent"}`}>✓</div>}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-bold text-dark-evergreen">{task.title}</h3><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${task.owner_type === "lemhi" ? "bg-[#F7E4D6] text-[#6B3216]" : "bg-sage text-dark-evergreen"}`}>{task.owner_type === "lemhi" ? "Lemhi" : "MSP"}</span></div>
                            <p className="mt-2 text-sm leading-6 text-muted">{task.description}</p>
                            <p className="mt-3 text-sm text-muted">Owner: <strong className="text-dark-evergreen">{task.owner_label}</strong>{completion ? ` · Completed ${formatDate(completion.completed_at)} by ${personNames.get(completion.completed_by) ?? "Lemhi team"}` : " · Open"}</p>
                          </div>
                        </div>
                        <details className="mt-4 border-t border-line pt-4">
                          <summary className="cursor-pointer text-sm font-semibold text-evergreen">Notes{taskNotes.length ? ` (${taskNotes.length})` : ""}</summary>
                          <div className="mt-4 space-y-3">
                            {taskNotes.length ? taskNotes.map((note) => <div className="rounded-md bg-background px-4 py-3" key={note.id}><div className="flex justify-between gap-3 text-sm"><strong className="text-dark-evergreen">{personNames.get(note.author_id) ?? "Lemhi team"}</strong><span className="text-muted">{formatDate(note.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{note.body}</p></div>) : <p className="text-sm text-muted">No notes yet.</p>}
                          </div>
                          <AdminTaskNoteForm mspId={msp.id} taskId={task.id} />
                        </details>
                      </article>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </section>

        <aside className="space-y-8">
          <section className="rounded-xl border border-line bg-paper p-6">
            <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Access</p><h2 className="mt-2 font-serif text-2xl font-bold text-dark-evergreen">People</h2></div><span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-dark-evergreen">{people?.filter((person) => person.active).length ?? 0}</span></div>
            <div className="mt-5 divide-y divide-line">
              {people?.length ? people.map((person) => <div className="py-3 first:pt-0" key={person.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-dark-evergreen">{person.full_name || person.email}</p><span className="text-xs font-bold uppercase text-muted">{person.role === "msp_owner" ? "Main contact" : person.active ? "Member" : "Removed"}</span></div><p className="mt-1 break-all text-sm text-muted">{person.email}</p></div>) : <p className="text-sm text-muted">No one has accepted an invitation yet.</p>}
            </div>
            {invitations?.some((invite) => invite.status === "pending") ? <div className="mt-5 border-t border-line pt-5"><h3 className="font-semibold text-dark-evergreen">Pending invitations</h3>{invitations.filter((invite) => invite.status === "pending").map((invite) => <p className="mt-2 break-all text-sm text-muted" key={invite.id}>{invite.email}</p>)}</div> : null}
          </section>

          <section className="rounded-xl border border-line bg-paper p-6">
            <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Visible content</p><h2 className="mt-2 font-serif text-2xl font-bold text-dark-evergreen">Library</h2></div><span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-dark-evergreen">{visibleAssets.length}</span></div>
            <div className="mt-5 divide-y divide-line">
              {visibleAssets.length ? visibleAssets.map((asset) => <div className="py-3 first:pt-0" key={asset.id}><p className="font-semibold text-dark-evergreen">{asset.title}</p><p className="mt-1 text-sm capitalize text-muted">{asset.category.replaceAll("_", " ")} · {asset.scope}</p>{asset.kind === "link" && asset.external_url ? <a className="mt-2 inline-block text-sm font-semibold text-evergreen hover:underline" href={asset.external_url} rel="noreferrer" target="_blank">Open link ↗</a> : <a className="mt-2 inline-block text-sm font-semibold text-evergreen hover:underline" href={`/api/assets/${asset.id}`} target="_blank">Open file ↗</a>}</div>) : <p className="text-sm text-muted">No assets are visible to this MSP yet.</p>}
            </div>
            <Link className="mt-5 inline-flex rounded-md bg-evergreen px-4 py-2.5 text-sm font-semibold text-white" href="/admin/library">Manage library</Link>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
