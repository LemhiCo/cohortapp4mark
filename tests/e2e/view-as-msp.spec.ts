import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

// Creates its own admin, cohort, MSPs, owner, assets and task changes, so it
// only ever runs against a local Supabase stack and a local app.
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

const programId = "10000000-0000-4000-8000-000000000001";
const suffix = randomBytes(4).toString("hex");
const password = () => randomBytes(18).toString("base64url");
type Account = { email: string; password: string; userId?: string };
const adminAccount: Account = { email: `preview-admin-${suffix}@lemhi.com`, password: password() };
const ownerA: Account = { email: `preview-a-${suffix}@example.test`, password: password() };
const names = {
  cohort: `Preview cohort ${suffix}`,
  extraForB: `Only for B ${suffix}`,
  mspA: `Preview A ${suffix}`,
  mspB: `Preview B ${suffix}`,
  privateA: `Private to A ${suffix}`,
  privateB: `Private to B ${suffix}`,
  shared: `Shared with cohort ${suffix}`,
};

let admin: SupabaseClient | undefined;
const created: { cohortId?: string; mspA?: string; mspB?: string; hiddenTitle?: string } = {};

async function signIn(page: Page, account: Account, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function checklistTitles(page: Page) {
  return (await page.locator("article h3").allInnerTexts()).sort();
}

async function libraryTitles(page: Page) {
  return (await page.locator("article h2").allInnerTexts()).filter((title) => title.includes(suffix)).sort();
}

test.describe("view as MSP", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const adminUser = await admin.auth.admin.createUser({ email: adminAccount.email, password: adminAccount.password, email_confirm: true, user_metadata: { full_name: `Preview Lead ${suffix}` } });
    if (adminUser.error) throw adminUser.error;
    adminAccount.userId = adminUser.data.user!.id;
    await admin.from("profiles").update({ title: "Head of Success" }).eq("id", adminAccount.userId);

    const cohort = await admin.from("cohorts").insert({
      program_id: programId,
      name: names.cohort,
      start_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
      lead_id: adminAccount.userId,
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    for (const key of ["mspA", "mspB"] as const) {
      const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: names[key] }).select("id").single();
      if (msp.error) throw msp.error;
      created[key] = msp.data.id;
    }
    const invite = await admin.from("invitations").insert({
      email: ownerA.email,
      role: "msp_owner",
      msp_id: created.mspA,
      invited_by: adminAccount.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (invite.error) throw invite.error;
    const owner = await admin.auth.admin.createUser({ email: ownerA.email, password: ownerA.password, email_confirm: true });
    if (owner.error) throw owner.error;
    ownerA.userId = owner.data.user!.id;

    const assets = await admin.from("assets").insert([
      { title: names.shared, category: "documentation", kind: "link", status: "ready", external_url: "https://example.test/shared", scope: "cohort", cohort_id: cohort.data.id },
      { title: names.privateA, category: "documentation", kind: "link", status: "ready", external_url: "https://example.test/a", scope: "msp", msp_id: created.mspA },
      { title: names.privateB, category: "documentation", kind: "link", status: "ready", external_url: "https://example.test/b", scope: "msp", msp_id: created.mspB },
    ]);
    if (assets.error) throw assets.error;

    const { data: weekOne } = await admin
      .from("cohort_tasks")
      .select("id, title, cohort_week_id, position, cohort_weeks!inner(week_number)")
      .eq("cohort_id", cohort.data.id)
      .eq("cohort_weeks.week_number", 1)
      .order("position");
    const hiddenTask = weekOne!.find((task) => task.position === 3)!;
    created.hiddenTitle = hiddenTask.title;
    const hide = await admin.from("msp_hidden_tasks").insert({ msp_id: created.mspA, cohort_task_id: hiddenTask.id, hidden_by: adminAccount.userId });
    if (hide.error) throw hide.error;
    const extra = await admin.from("cohort_tasks").insert({
      cohort_id: cohort.data.id,
      cohort_week_id: weekOne![0].cohort_week_id,
      msp_id: created.mspB,
      position: 20,
      title: names.extraForB,
      owner_label: "MSP IT admin",
      owner_type: "msp",
    });
    if (extra.error) throw extra.error;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (ownerA.userId) await admin.auth.admin.deleteUser(ownerA.userId);
    const msps = [created.mspA, created.mspB].filter((id): id is string => Boolean(id));
    if (msps.length) await admin.from("msps").delete().in("id", msps);
    if (created.cohortId) {
      await admin.from("assets").delete().eq("cohort_id", created.cohortId);
      await admin.from("cohorts").delete().eq("id", created.cohortId);
    }
    if (adminAccount.userId) await admin.auth.admin.deleteUser(adminAccount.userId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("the preview shows exactly what the MSP sees, read-only", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto(`/admin/msps/${created.mspA}`);
    await page.getByRole("link", { name: "View as MSP" }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/msps/${created.mspA}/preview/cohort$`));

    await expect(page.getByText(`Viewing as ${names.mspA}.`)).toBeVisible();
    await expect(page.getByRole("heading", { name: names.cohort, exact: true })).toBeVisible();
    const leadCard = page.locator("section").filter({ hasText: "Your Lemhi lead" });
    await expect(leadCard).toContainText(`Preview Lead ${suffix}`);
    await expect(leadCard).toContainText("Head of Success");
    const peers = page.locator("section").filter({ hasText: "Peer companies" });
    await expect(peers).toContainText(names.mspB);
    await expect(peers).not.toContainText(names.mspA);

    await page.getByRole("navigation", { name: "MSP preview" }).getByRole("link", { name: "Checklist" }).click();
    await expect(page).toHaveURL(/\/preview\/checklist$/);
    const previewTasks = await checklistTitles(page);
    expect(previewTasks).not.toContain(created.hiddenTitle);
    expect(previewTasks).not.toContain(names.extraForB);
    await expect(page.getByRole("button", { name: /Mark task as/ })).toHaveCount(0);
    await expect(page.getByPlaceholder("Share an update or question with your Lemhi team")).toHaveCount(0);

    await page.getByRole("navigation", { name: "MSP preview" }).getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/preview\/library$/);
    await expect(page.getByRole("heading", { name: names.shared, exact: true })).toBeVisible();
    const previewLibrary = await libraryTitles(page);
    expect(previewLibrary).toEqual([names.privateA, names.shared].sort());

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, ownerA, /\/cohort$/);
    await ownerPage.goto("/checklist");
    expect(await checklistTitles(ownerPage)).toEqual(previewTasks);
    await ownerPage.goto("/library");
    expect(await libraryTitles(ownerPage)).toEqual(previewLibrary);

    await ownerPage.goto(`/admin/msps/${created.mspA}/preview/library`);
    await expect(ownerPage).toHaveURL(/\/cohort$/);
    await ownerContext.close();
  });

  test("a malformed MSP id in the preview URL is a 404", async ({ page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    const response = await page.goto(`/admin/msps/${encodeURIComponent("not-a-uuid),or(id.neq.0")}/preview/library`);
    expect(response?.status()).toBe(404);
  });
});
