import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

// Uses its own (inactive) program, cohort, MSP and owner, so it never edits
// the program other tests read. Only runs against a local Supabase stack.
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
const adminAccount: Account = { email: `program-admin-${suffix}@lemhi.com`, password: password() };
const owner: Account = { email: `program-owner-${suffix}@example.test`, password: password() };
const text = {
  added: `Added task ${suffix}`,
  archived: `Archived task ${suffix}`,
  edited: `Edited task ${suffix}`,
  original: `Original task ${suffix}`,
  program: `Editor program ${suffix}`,
  subtitle: `Edited subtitle ${suffix}`,
  week: `Editor week ${suffix}`,
};

let admin: SupabaseClient | undefined;
const created: { programId?: string; cohortId?: string; mspId?: string; archivedTaskId?: string } = {};

async function signIn(page: Page, account: Account, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("program editor", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const adminUser = await admin.auth.admin.createUser({ email: adminAccount.email, password: adminAccount.password, email_confirm: true });
    if (adminUser.error) throw adminUser.error;
    adminAccount.userId = adminUser.data.user!.id;

    const program = await admin.from("programs").insert({ name: text.program, active: false }).select("id").single();
    if (program.error) throw program.error;
    created.programId = program.data.id;

    const weeks = await admin.from("program_weeks").insert([1, 2, 3, 4].map((weekNumber) => ({
      program_id: program.data.id,
      week_number: weekNumber,
      title: weekNumber === 1 ? text.week : `Other week ${weekNumber} ${suffix}`,
      subtitle: "Original subtitle",
      goal: "Original goal",
    }))).select("id, week_number");
    if (weeks.error) throw weeks.error;
    const weekOne = weeks.data.find((week) => week.week_number === 1)!;

    const tasks = await admin.from("program_tasks").insert([
      { program_id: program.data.id, week_id: weekOne.id, position: 1, title: text.original, owner_label: "MSP IT admin", owner_type: "msp" },
      { program_id: program.data.id, week_id: weekOne.id, position: 2, title: text.archived, owner_label: "MSP IT admin", owner_type: "msp" },
    ]).select("id, title");
    if (tasks.error) throw tasks.error;
    created.archivedTaskId = tasks.data.find((task) => task.title === text.archived)!.id;

    const cohort = await admin.from("cohorts").insert({
      program_id: program.data.id,
      name: `Editor cohort ${suffix}`,
      start_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: `Editor MSP ${suffix}` }).select("id").single();
    if (msp.error) throw msp.error;
    created.mspId = msp.data.id;
    const invite = await admin.from("invitations").insert({
      email: owner.email,
      role: "msp_owner",
      msp_id: msp.data.id,
      invited_by: adminAccount.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (invite.error) throw invite.error;
    const ownerUser = await admin.auth.admin.createUser({ email: owner.email, password: owner.password, email_confirm: true });
    if (ownerUser.error) throw ownerUser.error;
    owner.userId = ownerUser.data.user!.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (owner.userId) await admin.auth.admin.deleteUser(owner.userId);
    if (created.mspId) await admin.from("msps").delete().eq("id", created.mspId);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    if (created.programId) {
      await admin.from("program_tasks").delete().eq("program_id", created.programId);
      await admin.from("program_weeks").delete().eq("program_id", created.programId);
      await admin.from("programs").delete().eq("id", created.programId);
    }
    if (adminAccount.userId) await admin.auth.admin.deleteUser(adminAccount.userId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("program edits reach the running cohort's checklist", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto("/admin/program");

    const programSection = page.locator("section").filter({ has: page.getByRole("heading", { name: text.program, exact: true }) });
    await expect(programSection).toContainText("the 1 upcoming or active cohort");
    const weekCard = programSection.locator("div.rounded-xl").filter({ has: page.getByRole("heading", { name: text.week, exact: true }) });

    await weekCard.getByText("Edit week title, subtitle and goal").click();
    await weekCard.getByLabel("Subtitle").fill(text.subtitle);
    await weekCard.getByRole("button", { name: "Save week" }).click();
    await expect(weekCard.getByText("Week saved.")).toBeVisible();

    const originalTask = weekCard.locator("li").filter({ has: page.getByRole("heading", { name: text.original, exact: true }) });
    await originalTask.getByText("Edit task").click();
    await originalTask.getByLabel("Task title").fill(text.edited);
    await originalTask.getByRole("button", { name: "Save task" }).click();
    await expect(weekCard.getByRole("heading", { name: text.edited, exact: true })).toBeVisible();

    await weekCard.getByText("Add a task to Week 1").click();
    const addForm = weekCard.locator("details").filter({ hasText: "Add a task to Week 1" });
    await addForm.getByLabel("Task title").fill(text.added);
    await addForm.getByLabel("Owner").fill("Account team");
    await addForm.getByRole("button", { name: "Add task" }).click();
    await expect(weekCard.getByRole("heading", { name: text.added, exact: true })).toBeVisible();

    const archivedTask = weekCard.locator("li").filter({ has: page.getByRole("heading", { name: text.archived, exact: true }) });
    await archivedTask.getByRole("button", { name: "Archive", exact: true }).click();
    await archivedTask.getByRole("button", { name: "Archive task" }).click();
    await expect(weekCard.getByText("Archived tasks (1)")).toBeVisible();

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner, /\/cohort$/);
    await ownerPage.goto("/checklist");
    await expect(ownerPage.getByText(text.subtitle)).toBeVisible();
    await expect(ownerPage.getByRole("heading", { name: text.edited, exact: true })).toBeVisible();
    await expect(ownerPage.getByRole("heading", { name: text.added, exact: true })).toBeVisible();
    await expect(ownerPage.getByRole("heading", { name: text.archived, exact: true })).toHaveCount(0);
    await expect(ownerPage.getByText("0 of 2 tasks complete")).toBeVisible();
    await ownerContext.close();

    await weekCard.getByText("Archived tasks (1)").click();
    await weekCard.getByRole("button", { name: "Restore task" }).click();
    await expect(weekCard.getByRole("heading", { name: text.archived, exact: true })).toBeVisible();
    const { data: restored } = await admin!.from("cohort_tasks").select("archived_at").eq("template_task_id", created.archivedTaskId!).single();
    expect(restored?.archived_at).toBeNull();
  });
});
