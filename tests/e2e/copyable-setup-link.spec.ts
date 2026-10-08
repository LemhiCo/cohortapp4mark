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
const adminAccount = {
  email: `copy-link-admin-${suffix}@lemhi.com`,
  password: randomBytes(18).toString("base64url"),
};
const ownerAccount = {
  email: `copy-link-owner-${suffix}@example.test`,
  name: `Copy Link Owner ${suffix}`,
  password: randomBytes(18).toString("base64url"),
};
const cohortName = `Copy link cohort ${suffix}`;
const mspName = `Copy link MSP ${suffix}`;

test.describe("Reusable copyable setup link", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");
  test.setTimeout(60_000);

  test("lasts 72 hours, survives reopening, and closes after password setup", async ({ browser, page }) => {
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    let adminUserId = "";
    let ownerUserId = "";
    let cohortId = "";
    let mspId = "";

    try {
      await admin.from("admin_allowlist").upsert({ active: true, email: adminAccount.email });
      const adminUser = await admin.auth.admin.createUser({
        email: adminAccount.email,
        email_confirm: true,
        password: adminAccount.password,
        user_metadata: { full_name: "Copy Link Test Admin" },
      });
      if (adminUser.error) throw adminUser.error;
      adminUserId = adminUser.data.user!.id;

      const cohort = await admin.from("cohorts").insert({
        lead_id: adminUserId,
        name: cohortName,
        program_id: "10000000-0000-4000-8000-000000000001",
        session_time: "11:00",
        session_weekday: 1,
        start_date: new Date().toISOString().slice(0, 10),
        timezone: "America/New_York",
      }).select("id").single();
      if (cohort.error) throw cohort.error;
      cohortId = cohort.data.id;

      const msp = await admin.from("msps").insert({
        cohort_id: cohortId,
        name: mspName,
        primary_contact_email: ownerAccount.email,
        primary_contact_name: ownerAccount.name,
      }).select("id").single();
      if (msp.error) throw msp.error;
      mspId = msp.data.id;

      await page.goto("/sign-in");
      await page.getByLabel("Work email").fill(adminAccount.email);
      await page.getByLabel("Password", { exact: true }).fill(adminAccount.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto(`/admin/cohorts/${cohortId}`);

      const card = page.locator("div.py-5").filter({ has: page.getByRole("heading", { name: mspName, exact: true }) });
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Generate copyable link" }).click();
      await expect(card.getByRole("status")).toContainText("reusable 72-hour setup link");
      const setupUrl = await card.getByLabel("Secure setup link").inputValue();
      expect(setupUrl).toContain("/setup#token=");

      const rawToken = new URL(setupUrl).hash.replace("#token=", "");
      expect(rawToken.split(".")).toHaveLength(2);
      const { data: invitationRecord } = await admin
        .from("invitations")
        .select("expires_at, last_sent_at, status")
        .eq("email", ownerAccount.email)
        .single();
      expect(invitationRecord!.status).toBe("pending");
      const validityHours = (new Date(invitationRecord!.expires_at).getTime() - Date.now()) / 3_600_000;
      expect(validityHours).toBeGreaterThan(71.9);
      expect(validityHours).toBeLessThanOrEqual(72);

      const firstContext = await browser.newContext();
      const firstPage = await firstContext.newPage();
      await firstPage.goto(setupUrl);
      await expect(firstPage.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
      await firstPage.reload();
      await firstPage.goto(setupUrl);
      await firstPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(firstPage).toHaveURL(/\/set-password$/);
      await firstContext.close();

      const { data: ownerAfterFirstOpen } = await admin
        .from("profiles")
        .select("id, password_setup_required")
        .eq("email", ownerAccount.email)
        .single();
      ownerUserId = ownerAfterFirstOpen!.id;
      expect(ownerAfterFirstOpen!.password_setup_required).toBe(true);

      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      await secondPage.goto(setupUrl);
      await secondPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(secondPage).toHaveURL(/\/set-password$/);
      await secondPage.getByLabel("New password", { exact: true }).fill(ownerAccount.password);
      await secondPage.getByLabel("Confirm new password").fill(ownerAccount.password);
      await secondPage.getByRole("button", { name: "Save password and continue" }).click();
      await expect(secondPage).toHaveURL(/\/cohort$/);
      await secondContext.close();

      const [{ data: completedProfile }, { data: completedInvitation }] = await Promise.all([
        admin.from("profiles").select("password_setup_required").eq("id", ownerUserId).single(),
        admin.from("invitations").select("status").eq("email", ownerAccount.email).single(),
      ]);
      expect(completedProfile!.password_setup_required).toBe(false);
      expect(completedInvitation!.status).toBe("accepted");

      const completedContext = await browser.newContext();
      const completedPage = await completedContext.newPage();
      await completedPage.goto(setupUrl);
      await completedPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(completedPage.getByRole("status")).toContainText("already complete");
      await completedContext.close();
    } finally {
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
      if (mspId) await admin.from("msps").delete().eq("id", mspId);
      if (cohortId) await admin.from("cohorts").delete().eq("id", cohortId);
      if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
      await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
    }
  });
});
