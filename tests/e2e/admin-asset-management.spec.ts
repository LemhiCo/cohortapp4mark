import { randomBytes, randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

// Creates its own admin, cohort, MSP owner and asset, so it only ever runs
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

const bucket = "portal-assets";
const suffix = randomBytes(4).toString("hex");
const password = () => randomBytes(18).toString("base64url");
const adminAccount = { email: `asset-admin-${suffix}@lemhi.com`, password: password() };
const ownerAccount = { email: `asset-owner-${suffix}@example.test`, password: password() };
const originalTitle = `Managed asset ${suffix}`;
const renamedTitle = `Managed asset ${suffix} (corrected)`;
const assetId = randomUUID();
const assetPath = `program/10000000-0000-4000-8000-000000000001/${assetId}/managed.txt`;

let admin: SupabaseClient | undefined;
const created: { adminUserId?: string; ownerUserId?: string; cohortId?: string; mspId?: string } = {};

async function signIn(page: Page, account: { email: string; password: string }, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

test.describe("admin asset management", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });

    await admin.from("admin_allowlist").upsert({ email: adminAccount.email, active: true });
    const adminUser = await admin.auth.admin.createUser({ ...adminAccount, email_confirm: true });
    if (adminUser.error) throw adminUser.error;
    created.adminUserId = adminUser.data.user!.id;

    const cohort = await admin.from("cohorts").insert({
      program_id: "10000000-0000-4000-8000-000000000001",
      name: `Asset management ${suffix}`,
      start_date: new Date().toISOString().slice(0, 10),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: `Asset MSP ${suffix}` }).select("id").single();
    if (msp.error) throw msp.error;
    created.mspId = msp.data.id;

    const invitation = await admin.from("invitations").insert({
      email: ownerAccount.email,
      role: "msp_owner",
      msp_id: msp.data.id,
      invited_by: created.adminUserId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (invitation.error) throw invitation.error;
    const owner = await admin.auth.admin.createUser({ ...ownerAccount, email_confirm: true });
    if (owner.error) throw owner.error;
    created.ownerUserId = owner.data.user!.id;

    const upload = await admin.storage.from(bucket).upload(assetPath, new Blob(["managed"], { type: "text/plain" }));
    if (upload.error) throw upload.error;
    const asset = await admin.from("assets").insert({
      id: assetId,
      title: originalTitle,
      category: "documentation",
      kind: "file",
      status: "ready",
      scope: "program",
      program_id: "10000000-0000-4000-8000-000000000001",
      storage_path: assetPath,
      mime_type: "text/plain",
    });
    if (asset.error) throw asset.error;
  });

  test.afterAll(async () => {
    if (!admin) return;
    await admin.storage.from(bucket).remove([assetPath]);
    await admin.from("assets").delete().eq("id", assetId);
    if (created.ownerUserId) await admin.auth.admin.deleteUser(created.ownerUserId);
    if (created.mspId) await admin.from("msps").delete().eq("id", created.mspId);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    if (created.adminUserId) await admin.auth.admin.deleteUser(created.adminUserId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("an admin can rename and recategorize an asset", async ({ page }) => {
    await signIn(page, adminAccount, /\/admin$/);
    await page.goto("/admin/library");

    const row = page.locator("div.py-4").filter({ has: page.getByRole("heading", { name: originalTitle, exact: true }) });
    await row.getByRole("button", { name: "Edit" }).click();
    await row.getByLabel("Title").fill(renamedTitle);
    await row.getByLabel("Category").selectOption("recording");
    await row.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("heading", { name: renamedTitle, exact: true })).toBeVisible();
    const { data } = await admin!.from("assets").select("title, category").eq("id", assetId).single();
    expect(data).toEqual({ title: renamedTitle, category: "recording" });
  });

  test("deleting an asset removes it for MSPs and removes the stored file", async ({ browser, page }) => {
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, ownerAccount, /\/cohort$/);
    await ownerPage.goto("/library");
    await expect(ownerPage.getByText(renamedTitle, { exact: true })).toBeVisible();

    await signIn(page, adminAccount, /\/admin$/);
    await page.goto("/admin/library");
    const row = page.locator("div.py-4").filter({ has: page.getByRole("heading", { name: renamedTitle, exact: true }) });
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(row.getByText("MSPs lose access immediately")).toBeVisible();
    await row.getByRole("button", { name: "Delete permanently" }).click();
    await expect(page.getByRole("heading", { name: renamedTitle, exact: true })).toHaveCount(0);

    const { data: rows } = await admin!.from("assets").select("id").eq("id", assetId);
    expect(rows).toEqual([]);
    const { data: stored } = await admin!.storage.from(bucket).exists(assetPath);
    expect(stored).toBe(false);

    await ownerPage.goto("/library");
    await expect(ownerPage.getByText(renamedTitle, { exact: true })).toHaveCount(0);
    const fileRoute = await ownerPage.request.get(`/api/assets/${assetId}`, { maxRedirects: 0 });
    expect(fileRoute.status()).toBe(404);
    await ownerContext.close();
  });
});
