import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// Creates its own admin, cohort and MSPs, so it only ever runs against a local
// Supabase stack and a local app. It never touches production.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Without a local env file the guard below skips the whole file.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isLocal = (value: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(value);
const canRun = Boolean(secretKey) && isLocal(supabaseUrl) && isLocal(baseUrl);

const suffix = randomBytes(4).toString("hex");
const adminAccount = { email: `dashboard-admin-${suffix}@lemhi.com`, password: randomBytes(18).toString("base64url") };
const cohortName = `Dashboard cohort ${suffix}`;
let admin: SupabaseClient | undefined;
const created: { adminUserId?: string; cohortId?: string; mspIds: string[]; taskTitles: Record<number, string> } = { mspIds: [], taskTitles: {} };

function easternDateDaysAgo(days: number) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

test.describe("admin dashboard", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const user = await admin.auth.admin.createUser({ ...adminAccount, email_confirm: true });
    if (user.error) throw user.error;
    created.adminUserId = user.data.user!.id;

    // Eight Eastern days in: Week 1 has passed and Week 2 is current.
    const cohort = await admin.from("cohorts").insert({
      program_id: "10000000-0000-4000-8000-000000000001",
      name: cohortName,
      start_date: easternDateDaysAgo(8),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    for (const label of ["A", "B"]) {
      const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: `Dashboard MSP ${label} ${suffix}` }).select("id").single();
      if (msp.error) throw msp.error;
      created.mspIds.push(msp.data.id);
    }

    const { data: weekOne } = await admin
      .from("cohort_tasks")
      .select("id, position, title, cohort_weeks!inner(week_number)")
      .eq("cohort_id", cohort.data.id)
      .eq("cohort_weeks.week_number", 1);
    for (const task of weekOne ?? []) created.taskTitles[task.position] = task.title;

    // A leaves the seventh Week 1 task open; B leaves the sixth and seventh.
    const completions = (weekOne ?? []).flatMap((task) => [
      ...(task.position <= 6 ? [{ msp_id: created.mspIds[0], cohort_task_id: task.id, completed_by: created.adminUserId }] : []),
      ...(task.position <= 5 ? [{ msp_id: created.mspIds[1], cohort_task_id: task.id, completed_by: created.adminUserId }] : []),
    ]);
    const inserted = await admin.from("task_completions").insert(completions);
    if (inserted.error) throw inserted.error;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (created.mspIds.length) await admin.from("msps").delete().in("id", created.mspIds);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    if (created.adminUserId) await admin.auth.admin.deleteUser(created.adminUserId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("the pulse ranks stuck tasks and summarizes each cohort", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Work email").fill(adminAccount.email);
    await page.getByLabel(/^Password/).fill(adminAccount.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const stuckList = page.locator("ol").filter({ has: page.getByText(created.taskTitles[7], { exact: true }) });
    const seventh = stuckList.locator("li").filter({ has: page.getByText(created.taskTitles[7], { exact: true }) });
    const sixth = stuckList.locator("li").filter({ has: page.getByText(created.taskTitles[6], { exact: true }) });
    await expect(seventh).toContainText("2 of 2 MSPs");
    await expect(sixth).toContainText("1 of 2 MSPs");
    await expect(seventh).toContainText(`Week 1 · ${cohortName}`);

    const items = await stuckList.locator("li").allInnerTexts();
    const seventhIndex = items.findIndex((text) => text.includes(created.taskTitles[7]));
    const sixthIndex = items.findIndex((text) => text.includes(created.taskTitles[6]));
    expect(seventhIndex).toBeLessThan(sixthIndex);

    const card = page.getByRole("link").filter({ has: page.getByText(cohortName, { exact: true }) }).filter({ hasText: "behind" });
    await expect(card).toContainText("Week 2 of 4");
    await expect(card).toContainText("2 MSPs");
    await expect(card).toContainText("18%");
    await expect(card).toContainText("2 behind");
  });
});
