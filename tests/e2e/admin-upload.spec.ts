import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

// Creates its own admin and assets, so it only ever runs against a local
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
const adminEmail = `upload-admin-${suffix}@lemhi.com`;
const adminPassword = randomBytes(18).toString("base64url");
const titlePrefix = `Upload check ${suffix}`;
let admin: SupabaseClient | undefined;
let adminUserId: string | undefined;

async function signInAsAdmin(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(adminEmail);
  await page.getByLabel(/^Password/).fill(adminPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("admin library uploads", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: adminEmail, active: true });
    const { data, error } = await admin.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true });
    if (error) throw error;
    adminUserId = data.user!.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    const { data: assets } = await admin.from("assets").select("id, storage_path").like("title", `${titlePrefix}%`);
    const paths = (assets ?? []).map((asset) => asset.storage_path).filter((path): path is string => Boolean(path));
    if (paths.length) await admin.storage.from("portal-assets").remove(paths);
    if (assets?.length) await admin.from("assets").delete().in("id", assets.map((asset) => asset.id));
    if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
    await admin.from("admin_allowlist").delete().eq("email", adminEmail);
  });

  test("a file uploaded from the library form is ready and stored", async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto("/admin/library");

    const title = `${titlePrefix} file`;
    await page.getByLabel("Title").fill(title);
    await page.locator('input[type="file"][name="file"]').setInputFiles({ name: "check.txt", mimeType: "text/plain", buffer: Buffer.from("upload check") });
    await page.getByRole("button", { name: "Upload to library" }).click();
    await expect(page.getByText("Asset added to the library.")).toBeVisible({ timeout: 20_000 });

    const { data: asset } = await admin!.from("assets").select("status, storage_path").eq("title", title).single();
    expect(asset?.status).toBe("ready");
    const { data: stored } = await admin!.storage.from("portal-assets").exists(asset!.storage_path!);
    expect(stored).toBe(true);
  });

  test("an asset cannot be marked ready when its file never arrived", async ({ page }) => {
    await signInAsAdmin(page);

    const { data: programs } = await admin!.from("programs").select("id").limit(1);
    const created = await page.request.post("/api/admin/assets", {
      data: {
        attachment: null,
        category: "documentation",
        fileName: "never-uploaded.txt",
        kind: "file",
        mimeType: "text/plain",
        scope: "program",
        scopeId: programs![0].id,
        sizeBytes: 12,
        title: `${titlePrefix} missing`,
      },
    });
    expect(created.ok()).toBe(true);
    const { assetId } = await created.json();

    const ready = await page.request.patch(`/api/admin/assets/${assetId}`, { data: { status: "ready" } });
    expect(ready.status()).toBe(409);

    const { data: asset } = await admin!.from("assets").select("status").eq("id", assetId).single();
    expect(asset?.status).toBe("failed");
  });
});
