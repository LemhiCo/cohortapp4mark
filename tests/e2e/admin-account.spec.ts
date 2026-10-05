import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

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
const account = {
  email: `account-admin-${suffix}@lemhi.com`,
  password: randomBytes(18).toString("base64url"),
  replacementPassword: randomBytes(18).toString("base64url"),
};

test.describe("Admin account settings", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");

  test("a manager can change their password and sign in with the new one", async ({ page }) => {
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ active: true, email: account.email });
    const created = await admin.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      password: account.password,
      user_metadata: { full_name: "Account Settings Test" },
    });
    if (created.error) throw created.error;

    try {
      await page.goto("/sign-in");
      await page.getByLabel("Work email").fill(account.email);
      await page.getByLabel("Password", { exact: true }).fill(account.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);

      await page.goto("/admin/account");
      await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
      await page.getByLabel("Current password").fill(account.password);
      await page.getByLabel(/^New password/).fill(account.replacementPassword);
      await page.getByLabel("Confirm new password").fill(account.replacementPassword);
      await page.getByRole("button", { name: "Change password", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Password changed");

      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/sign-in$/);
      await page.getByLabel("Work email").fill(account.email);
      await page.getByLabel("Password", { exact: true }).fill(account.replacementPassword);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
    } finally {
      await admin.auth.admin.deleteUser(created.data.user!.id);
      await admin.from("admin_allowlist").delete().eq("email", account.email);
    }
  });
});
