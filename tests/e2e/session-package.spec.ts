import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { type Browser, expect, type Page, test } from "@playwright/test";

// Creates its own admin, two cohorts, three MSP owners and session uploads, so
// it only ever runs against a local Supabase stack and a local app.
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
const adminAccount: Account = { email: `package-admin-${suffix}@lemhi.com`, password: password() };
const owners: Record<"a" | "b" | "c", Account & { mspName: string }> = {
  a: { email: `package-a-${suffix}@example.test`, mspName: `Package A ${suffix}`, password: password() },
  b: { email: `package-b-${suffix}@example.test`, mspName: `Package B ${suffix}`, password: password() },
  c: { email: `package-c-${suffix}@example.test`, mspName: `Package C ${suffix}`, password: password() },
};

let admin: SupabaseClient | undefined;
const created: { cohortIds: string[]; mspIds: Record<string, string>; weekOneSessionId?: string } = { cohortIds: [], mspIds: {} };

async function signIn(page: Page, account: Account, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function libraryAs(browser: Browser, account: Account) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page, account, /\/cohort$/);
  await page.goto("/library");
  return { context, page };
}

test.describe("session package upload", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const adminUser = await admin.auth.admin.createUser({ email: adminAccount.email, password: adminAccount.password, email_confirm: true });
    if (adminUser.error) throw adminUser.error;
    adminAccount.userId = adminUser.data.user!.id;

    const createCohort = async (label: string) => {
      const { data, error } = await admin!.from("cohorts").insert({
        program_id: programId,
        name: `Package ${label} ${suffix}`,
        start_date: new Date().toISOString().slice(0, 10),
        timezone: "America/New_York",
        session_weekday: 1,
        session_time: "11:00",
      }).select("id").single();
      if (error) throw error;
      created.cohortIds.push(data.id);
      return data.id as string;
    };
    const cohortX = await createCohort("X");
    const cohortY = await createCohort("Y");

    const { data: session } = await admin.from("sessions").select("id").eq("cohort_id", cohortX).eq("week_number", 1).single();
    created.weekOneSessionId = session!.id;

    for (const [key, cohortId] of [["a", cohortX], ["b", cohortX], ["c", cohortY]] as const) {
      const owner = owners[key];
      const { data: msp, error } = await admin.from("msps").insert({ cohort_id: cohortId, name: owner.mspName }).select("id").single();
      if (error) throw error;
      created.mspIds[key] = msp.id;
      const invite = await admin.from("invitations").insert({
        email: owner.email,
        role: "msp_owner",
        msp_id: msp.id,
        invited_by: adminAccount.userId,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      });
      if (invite.error) throw invite.error;
      const user = await admin.auth.admin.createUser({ email: owner.email, password: owner.password, email_confirm: true });
      if (user.error) throw user.error;
      owner.userId = user.data.user!.id;
    }
  });

  test.afterAll(async () => {
    if (!admin) return;
    const cohortIds = created.cohortIds;
    const mspIds = Object.values(created.mspIds);
    if (cohortIds.length || mspIds.length) {
      const { data: assets } = await admin
        .from("assets")
        .select("id, storage_path")
        .or([...cohortIds.map((id) => `cohort_id.eq.${id}`), ...mspIds.map((id) => `msp_id.eq.${id}`)].join(","));
      const paths = (assets ?? []).map((asset) => asset.storage_path).filter((path): path is string => Boolean(path));
      if (paths.length) await admin.storage.from("portal-assets").remove(paths);
      if (assets?.length) await admin.from("assets").delete().in("id", assets.map((asset) => asset.id));
    }
    for (const owner of Object.values(owners)) if (owner.userId) await admin.auth.admin.deleteUser(owner.userId);
    if (mspIds.length) await admin.from("msps").delete().in("id", mspIds);
    if (cohortIds.length) await admin.from("cohorts").delete().in("id", cohortIds);
    if (adminAccount.userId) await admin.auth.admin.deleteUser(adminAccount.userId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("a group session package reaches every MSP in that cohort and no one else", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto(`/admin/recordings?session=${created.weekOneSessionId}`);
    await expect(page.locator('select[name="sessionId"]')).toHaveValue(created.weekOneSessionId!);

    await page.locator('input[name="recording"]').setInputFiles({ name: "week-1.mp4", mimeType: "video/mp4", buffer: Buffer.from("fake video bytes") });
    await page.locator('input[name="transcript"]').setInputFiles({ name: "week-1.txt", mimeType: "text/plain", buffer: Buffer.from("transcript text") });
    await page.getByLabel(/^Summary/).fill("We set up tenants and agreed on owners.");
    await page.getByLabel(/^Action items/).fill("Finish tenant setup\nBring the target list to Week 2");
    await page.getByRole("button", { name: "Upload session package" }).click();
    await expect(page.getByText("Every MSP in the cohort can see it now.")).toBeVisible({ timeout: 20_000 });

    const { data: assets } = await admin!
      .from("assets")
      .select("id, title, category, scope, cohort_id, cohort_week_id, session_id, status, summary, action_items")
      .eq("session_id", created.weekOneSessionId!)
      .order("category");
    expect(assets?.map((asset) => asset.category)).toEqual(["recording", "transcript"]);
    for (const asset of assets ?? []) {
      expect(asset).toMatchObject({ scope: "cohort", cohort_id: created.cohortIds[0], status: "ready" });
      expect(asset.cohort_week_id).not.toBeNull();
    }
    const recording = assets!.find((asset) => asset.category === "recording")!;
    const transcript = assets!.find((asset) => asset.category === "transcript")!;
    expect(recording.summary).toBe("We set up tenants and agreed on owners.");
    expect(recording.action_items).toEqual(["Finish tenant setup", "Bring the target list to Week 2"]);

    const ownerA = await libraryAs(browser, owners.a);
    await expect(ownerA.page.getByText(recording.title, { exact: true })).toBeVisible();
    await expect(ownerA.page.getByText(transcript.title, { exact: true })).toBeVisible();
    await ownerA.page.goto(`/library/${recording.id}`);
    await expect(ownerA.page.getByText("We set up tenants and agreed on owners.")).toBeVisible();
    await expect(ownerA.page.getByText("Bring the target list to Week 2")).toBeVisible();
    await expect(ownerA.page.getByRole("link", { name: transcript.title })).toBeVisible();
    await ownerA.context.close();

    const ownerC = await libraryAs(browser, owners.c);
    await expect(ownerC.page.getByText(recording.title, { exact: true })).toHaveCount(0);
    await ownerC.context.close();
  });

  test("a 1:1 package reaches only that MSP", async ({ browser, page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto("/admin/recordings");
    await page.getByLabel("1:1 with an MSP").check();
    await page.locator('select[name="mspId"]').selectOption(created.mspIds.a);
    await page.locator('input[name="localStartsAt"]').fill("2026-10-06T14:00");
    await page.locator('input[name="transcript"]').setInputFiles({ name: "one-on-one.txt", mimeType: "text/plain", buffer: Buffer.from("1:1 notes") });
    await page.getByRole("button", { name: "Upload session package" }).click();
    await expect(page.getByText("Only that MSP can see it.")).toBeVisible({ timeout: 20_000 });

    const { data: sessions } = await admin!.from("sessions").select("id, kind, msp_id").eq("msp_id", created.mspIds.a);
    expect(sessions).toHaveLength(1);
    expect(sessions![0].kind).toBe("one_on_one");
    const { data: asset } = await admin!.from("assets").select("title, scope, msp_id, status").eq("session_id", sessions![0].id).single();
    expect(asset).toMatchObject({ scope: "msp", msp_id: created.mspIds.a, status: "ready" });
    expect(asset!.title).toContain("1:1 with");

    const ownerA = await libraryAs(browser, owners.a);
    await expect(ownerA.page.getByText(asset!.title, { exact: true })).toBeVisible();
    await ownerA.context.close();

    const ownerB = await libraryAs(browser, owners.b);
    await expect(ownerB.page.getByText(asset!.title, { exact: true })).toHaveCount(0);
    await ownerB.context.close();
  });
});
