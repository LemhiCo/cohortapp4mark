import { AppShell } from "@/components/app-shell";
import { AssetUploadForm } from "@/components/asset-upload-form";
import { requireAdminProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin library" };

export default async function AdminLibraryPage() {
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();
  const [
    { data: programs },
    { data: cohorts },
    { data: msps },
    { data: programWeeks },
    { data: programTasks },
    { data: cohortWeeks },
    { data: cohortTasks },
    { data: assets },
  ] = await Promise.all([
    supabase.from("programs").select("id, name").eq("active", true).order("name"),
    supabase.from("cohorts").select("id, name").order("start_date", { ascending: false }),
    supabase.from("msps").select("id, name, cohort_id").eq("status", "active").order("name"),
    supabase.from("program_weeks").select("id, program_id, week_number, title").order("week_number"),
    supabase.from("program_tasks").select("id, program_id, week_id, position, title").is("archived_at", null).order("position"),
    supabase.from("cohort_weeks").select("id, cohort_id, week_number, title").order("week_number"),
    supabase.from("cohort_tasks").select("id, cohort_id, cohort_week_id, msp_id, position, title").is("archived_at", null).order("position"),
    supabase.from("assets").select("id, title, category, kind, scope, program_id, cohort_id, msp_id, status, created_at").order("created_at", { ascending: false }),
  ]);

  const cohortNames = new Map((cohorts ?? []).map((cohort) => [cohort.id, cohort.name]));
  const mspNames = new Map((msps ?? []).map((msp) => [msp.id, msp.name]));
  const programNames = new Map((programs ?? []).map((program) => [program.id, program.name]));
  const programWeekNumbers = new Map((programWeeks ?? []).map((week) => [week.id, week.week_number]));
  const cohortWeekNumbers = new Map((cohortWeeks ?? []).map((week) => [week.id, week.week_number]));

  const attachments = [
    ...(programWeeks ?? []).map((week) => ({
      id: week.id,
      label: `Week ${week.week_number} · ${week.title}`,
      type: "program_week" as const,
    })),
    ...(programTasks ?? []).map((task) => ({
      id: task.id,
      label: `Week ${programWeekNumbers.get(task.week_id) ?? ""} task · ${task.title}`,
      type: "program_task" as const,
    })),
    ...(cohortWeeks ?? []).map((week) => ({
      cohortId: week.cohort_id,
      id: week.id,
      label: `Week ${week.week_number} · ${week.title}`,
      type: "cohort_week" as const,
    })),
    ...(cohortTasks ?? []).map((task) => ({
      cohortId: task.cohort_id,
      id: task.id,
      label: `Week ${cohortWeekNumbers.get(task.cohort_week_id) ?? ""} task · ${task.title}`,
      mspId: task.msp_id ?? undefined,
      type: "cohort_task" as const,
    })),
  ];

  function scopeLabel(asset: NonNullable<typeof assets>[number]) {
    if (asset.scope === "program") return programNames.get(asset.program_id ?? "") ?? "Program";
    if (asset.scope === "cohort") return cohortNames.get(asset.cohort_id ?? "") ?? "Cohort";
    return mspNames.get(asset.msp_id ?? "") ?? "MSP";
  }

  return (
    <AppShell activeNav="admin-library" eyebrow="Admin" profile={profile} title="Library">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <section className="rounded-xl border border-line bg-paper p-6 shadow-[0_18px_50px_rgba(18,19,15,0.06)] sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">Add content</p>
          <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Share an asset</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            Files upload directly to private storage. Choose who can see the asset, then optionally attach it to a week or task.
          </p>
          <div className="mt-7">
            <AssetUploadForm
              attachments={attachments}
              cohorts={(cohorts ?? []).map((cohort) => ({ id: cohort.id, label: cohort.name }))}
              msps={(msps ?? []).map((msp) => ({ cohortId: msp.cohort_id, id: msp.id, label: msp.name }))}
              programs={(programs ?? []).map((program) => ({ id: program.id, label: program.name }))}
            />
          </div>
        </section>

        <section className="rounded-xl border border-line bg-paper p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent-orange">All content</p>
              <h2 className="mt-3 font-serif text-3xl font-bold text-dark-evergreen">Assets</h2>
            </div>
            <span className="rounded-full bg-sage px-3 py-1 text-sm font-semibold text-dark-evergreen">{assets?.length ?? 0}</span>
          </div>
          <div className="mt-6 divide-y divide-line">
            {assets?.length ? assets.map((asset) => (
              <div className="py-4 first:pt-0" key={asset.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-dark-evergreen">{asset.title}</h3>
                    <p className="mt-1 text-sm capitalize text-muted">{asset.category.replace("_", " ")} · {asset.kind} · {scopeLabel(asset)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${asset.status === "ready" ? "bg-sage text-dark-evergreen" : "bg-[#F7E4D6] text-[#6B3216]"}`}>{asset.status}</span>
                </div>
              </div>
            )) : (
              <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-base text-muted">No assets yet.</div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
