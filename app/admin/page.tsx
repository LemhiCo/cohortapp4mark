import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { CohortCreateForm } from "@/components/cohort-create-form";
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

function effectiveStatus(startDate: string, override: Enums<"cohort_status"> | null): Enums<"cohort_status"> {
  if (override) return override;
  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(`${startDate}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 28);
  if (today < startDate) return "upcoming";
  if (today >= endDate.toISOString().slice(0, 10)) return "ended";
  return "active";
}

const statusStyles: Record<Enums<"cohort_status">, string> = {
  active: "bg-sage text-dark-evergreen",
  ended: "bg-[#EAE5DC] text-muted",
  upcoming: "bg-[#F7E4D6] text-[#6B3216]",
};

export default async function AdminPage() {
  const profile = await requireAdminProfile();
  const supabase = await createServerSupabaseClient();

  const [{ data: cohorts }, { data: admins }, { data: msps }] = await Promise.all([
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
    supabase.from("msps").select("id, cohort_id, status"),
  ]);

  const adminNames = new Map((admins ?? []).map((admin) => [admin.id, admin.full_name || admin.email]));
  const mspCounts = new Map<string, number>();
  for (const msp of msps ?? []) {
    if (msp.status === "active") mspCounts.set(msp.cohort_id, (mspCounts.get(msp.cohort_id) ?? 0) + 1);
  }

  return (
    <AppShell activeNav="cohorts" eyebrow="Admin" profile={profile} title="Cohort setup">
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
                const status = effectiveStatus(cohort.start_date, cohort.status_override);
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
