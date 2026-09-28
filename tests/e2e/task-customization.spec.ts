import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Browser, expect, type Page, test } from "@playwright/test";

// Creates its own admin, cohort, two MSPs and owners, so it only ever runs
// against a local Supabase stack and a local app. It never touches production.
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
const password = () => randomBytes(18).toString("base64url");
type Account = { email: string; password: string; userId?: string };
const adminAccount: Account = { email: `custom-admin-${suffix}@lemhi.com`, password: password() };
const ownerA: Account = { email: `custom-a-${suffix}@example.test`, password: password() };
const ownerB: Account = { email: `custom-b-${suffix}@example.test`, password: password() };
const extraTitle = `Extra check-in ${suffix}`;

let admin: SupabaseClient | undefined;
const created: { cohortId?: string; mspA?: string; mspB?: string; hiddenTitle?: string } = {};

async function signIn(page: Page, account: Account, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function checklistAs(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, account, /\/cohort$/);
  await page.goto("/checklist");
  return { context, page };
}

function taskCard(page: Page, title: string) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test.describe("per-MSP checklist changes", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const adminUser = await admin.auth.admin.createUser({ email: adminAccount.email, password: adminAccount.password, email_confirm: true });
    if (adminUser.error) throw adminUser.error;
    adminAccount.userId = adminUser.data.user!.id;

    const cohort = await admin.from("cohorts").insert({
      program_id: "10000000-0000-4000-8000-000000000001",
      name: `Custom cohort ${suffix}`,
      start_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    for (const [key, owner] of [["mspA", ownerA], ["mspB", ownerB]] as const) {
      const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: `Custom ${key} ${suffix}` }).select("id").single();
      if (msp.error) throw msp.error;
      created[key] = msp.data.id;
      const invite = await admin.from("invitations").insert({
        email: owner.email,
        role: "msp_owner",
        msp_id: msp.data.id,
        invited_by: adminAccount.userId,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      if (invite.error) throw invite.error;
      const user = await admin.auth.admin.createUser({ email: owner.email, password: owner.password, email_confirm: true });
      if (user.error) throw user.error;
      owner.userId = user.data.user!.id;
    }

    const { data: task } = await admin
      .from("cohort_tasks")
      .select("title, cohort_weeks!inner(week_number)")
      .eq("cohort_id", cohort.data.id)
      .eq("cohort_weeks.week_number", 1)
      .eq("position", 2)
      .single();
    created.hiddenTitle = task!.title;
  });

  test.afterAll(async () => {
    if (!admin) return;
    for (const owner of [ownerA, ownerB]) if (owner.userId) await admin.auth.admin.deleteUser(owner.userId);
    const msps = [created.mspA, created.mspB].filter((id): id is string => Boolean(id));
    if (msps.length) await admin.from("msps").delete().in("id", msps);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    if (adminAccount.userId) await admin.auth.admin.deleteUser(adminAccount.userId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("an admin hides a program task for one MSP and adds an extra task for it", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto(`/admin/msps/${created.mspA}`);

    await taskCard(page, created.hiddenTitle!).getByRole("button", { name: "Hide for this MSP" }).click();
    await expect(taskCard(page, created.hiddenTitle!).getByText("Hidden for this MSP")).toBeVisible();

    await page.getByText("Add a Week 1 task for this MSP").click();
    const form = page.locator("details").filter({ hasText: "Add a Week 1 task for this MSP" });
    await form.getByLabel("Task title").fill(extraTitle);
    await form.getByLabel("Owner").fill("vCIO / Practice Lead");
    await form.getByRole("button", { name: "Add task" }).click();
    await expect(taskCard(page, extraTitle).getByText("Only this MSP")).toBeVisible();

    const a = await checklistAs(browser, ownerA);
    await expect(a.page.getByRole("heading", { name: created.hiddenTitle!, exact: true })).toHaveCount(0);
    await expect(a.page.getByRole("heading", { name: extraTitle, exact: true })).toBeVisible();
    await expect(a.page.getByText("0 of 30 tasks complete")).toBeVisible();
    await a.context.close();

    const b = await checklistAs(browser, ownerB);
    await expect(b.page.getByRole("heading", { name: created.hiddenTitle!, exact: true })).toBeVisible();
    await expect(b.page.getByRole("heading", { name: extraTitle, exact: true })).toHaveCount(0);
    await b.context.close();
  });

  test("an admin removes the extra task and shows the hidden task again", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto(`/admin/msps/${created.mspA}`);

    await taskCard(page, extraTitle).getByRole("button", { name: "Remove" }).click();
    await taskCard(page, extraTitle).getByRole("button", { name: "Remove task" }).click();
    await expect(page.getByRole("heading", { name: extraTitle, exact: true })).toHaveCount(0);

    await taskCard(page, created.hiddenTitle!).getByRole("button", { name: "Show again" }).click();
    await expect(taskCard(page, created.hiddenTitle!).getByRole("button", { name: "Hide for this MSP" })).toBeVisible();

    const a = await checklistAs(browser, ownerA);
    await expect(a.page.getByRole("heading", { name: created.hiddenTitle!, exact: true })).toBeVisible();
    await expect(a.page.getByRole("heading", { name: extraTitle, exact: true })).toHaveCount(0);
    await expect(a.page.getByText("0 of 30 tasks complete")).toBeVisible();
    await a.context.close();

    const { data: archived } = await admin!.from("cohort_tasks").select("archived_at").eq("title", extraTitle).single();
    expect(archived?.archived_at).not.toBeNull();
  });
});
