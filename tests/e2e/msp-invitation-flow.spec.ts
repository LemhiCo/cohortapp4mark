import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
const mailpitUrl = supabaseUrl ? `${new URL(supabaseUrl).protocol}//${new URL(supabaseUrl).hostname}:${Number(new URL(supabaseUrl).port) + 3}` : "";

const suffix = randomBytes(4).toString("hex");
const adminAccount = {
  email: `invite-admin-${suffix}@lemhi.com`,
  password: randomBytes(18).toString("base64url"),
};
const ownerAccount = {
  email: `owner-${suffix}@example.test`,
  name: `Owner ${suffix}`,
  password: randomBytes(18).toString("base64url"),
};
const cohortName = `Invitation cohort ${suffix}`;
const mspName = `Invitation MSP ${suffix}`;

let admin: SupabaseClient | undefined;
const created: { adminUserId?: string; cohortId?: string; mspId?: string; ownerUserId?: string } = {};

async function authLinkFor(email: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const list = await fetch(`${mailpitUrl}/api/v1/messages`).then((response) => response.json()) as {
      messages?: Array<{ ID: string; To?: Array<{ Address?: string }> }>;
    };
    const message = list.messages?.find((item) => item.To?.some((recipient) => recipient.Address?.toLowerCase() === email));
    if (message) {
      const detail = await fetch(`${mailpitUrl}/api/v1/message/${message.ID}`).then((response) => response.json()) as {
        HTML?: string;
        Text?: string;
      };
      const body = `${detail.Text ?? ""}\n${detail.HTML ?? ""}`;
      const links = body.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
      const match = links.find((link) => link.includes("/auth/v1/verify") || link.includes("/auth/confirm"));
      if (match) return match.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No setup email arrived for ${email}`);
}

test.describe("MSP invitation and password setup", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");
  test.setTimeout(60_000);

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ active: true, email: adminAccount.email });
    const user = await admin.auth.admin.createUser({
      email: adminAccount.email,
      email_confirm: true,
      password: adminAccount.password,
      user_metadata: { full_name: `Invitation Admin ${suffix}` },
    });
    if (user.error) throw user.error;
    created.adminUserId = user.data.user!.id;

    const cohort = await admin.from("cohorts").insert({
      lead_id: created.adminUserId,
      name: cohortName,
      program_id: "10000000-0000-4000-8000-000000000001",
      session_time: "11:00",
      session_weekday: 1,
      start_date: new Date().toISOString().slice(0, 10),
      timezone: "America/New_York",
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (created.ownerUserId) await admin.auth.admin.deleteUser(created.ownerUserId);
    if (created.mspId) await admin.from("msps").delete().eq("id", created.mspId);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    if (created.adminUserId) await admin.auth.admin.deleteUser(created.adminUserId);
    await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
  });

  test("Mark can prepare an MSP, send access later, and require password setup", async ({ browser, page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Work email").fill(adminAccount.email);
    await page.getByLabel("Password", { exact: true }).fill(adminAccount.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto(`/admin/cohorts/${created.cohortId}`);
    await page.getByLabel("MSP name").fill(mspName);
    await page.getByLabel(/^Main contact/).fill(ownerAccount.name);
    await page.getByLabel(/^Work email/).fill(ownerAccount.email);
    await page.getByRole("button", { name: "Create portal" }).click();
    await expect(page.getByRole("status")).toContainText("Review the roster");

    const { data: msp } = await admin!.from("msps").select("id").eq("name", mspName).single();
    created.mspId = msp!.id;
    const card = page.locator("div.py-5").filter({ has: page.getByRole("heading", { name: mspName, exact: true }) });
    await expect(card.getByText("Ready to invite")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await card.getByRole("button", { name: "Send setup link" }).click();
    await expect(card.getByRole("status")).toContainText(`Account setup link sent to ${ownerAccount.email}`);

    const { data: owner } = await admin!.from("profiles")
      .select("id, password_setup_required")
      .eq("email", ownerAccount.email)
      .single();
    created.ownerUserId = owner!.id;
    expect(owner!.password_setup_required).toBe(true);

    const setupLink = await authLinkFor(ownerAccount.email);
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(setupLink);
    const continueButton = ownerPage.getByRole("button", { name: "Continue securely" });
    if (await continueButton.isVisible()) await continueButton.click();
    await expect(ownerPage).toHaveURL(/\/set-password$/);

    await ownerPage.goto("/cohort");
    await expect(ownerPage).toHaveURL(/\/set-password$/);
    await ownerPage.getByLabel("New password", { exact: true }).fill(ownerAccount.password);
    await ownerPage.getByLabel("Confirm new password").fill(ownerAccount.password);
    await ownerPage.getByRole("button", { name: "Save password and continue" }).click();
    await expect(ownerPage).toHaveURL(/\/cohort$/);
    await expect(ownerPage.getByText(mspName, { exact: true }).first()).toBeVisible();

    const { data: completedProfile } = await admin!.from("profiles")
      .select("password_setup_required")
      .eq("id", created.ownerUserId)
      .single();
    const { data: acceptedInvite } = await admin!.from("invitations")
      .select("status")
      .eq("auth_user_id", created.ownerUserId)
      .single();
    expect(completedProfile!.password_setup_required).toBe(false);
    expect(acceptedInvite!.status).toBe("accepted");
    await ownerContext.close();
  });

  test("an existing user can finish a password reset from a scanner-safe link", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Work email").fill(adminAccount.email);
    await page.getByRole("button", { name: "Send password-reset link" }).click();
    await expect(page.getByRole("status")).toContainText("password-reset link is on its way");

    const recoveryLink = await authLinkFor(adminAccount.email);
    await page.goto(recoveryLink);
    await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();

    // Merely opening the email URL must not consume its one-time token. The
    // person explicitly confirms before the server exchanges it for a session.
    await page.reload();
    await page.getByRole("button", { name: "Continue securely" }).click();
    await expect(page).toHaveURL(/\/set-password$/);

    const replacementPassword = randomBytes(18).toString("base64url");
    await page.getByLabel("New password", { exact: true }).fill(replacementPassword);
    await page.getByLabel("Confirm new password").fill(replacementPassword);
    await page.getByRole("button", { name: "Save password and continue" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});
