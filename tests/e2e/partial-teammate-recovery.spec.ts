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

test.describe("Interrupted teammate setup recovery", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");
  test.setTimeout(90_000);

  test("lets a Lemhi admin replace a legacy 24-hour link without duplicating or moving the teammate", async ({ browser, page }) => {
    const suffix = randomBytes(4).toString("hex");
    const adminAccount = {
      email: `partial-recovery-admin-${suffix}@lemhi.com`,
      password: randomBytes(18).toString("base64url"),
    };
    const ownerAccount = {
      email: `partial-recovery-owner-${suffix}@example.test`,
      name: `Recovery Owner ${suffix}`,
      password: randomBytes(18).toString("base64url"),
    };
    const teammateAccount = {
      email: `partial-recovery-member-${suffix}@example.test`,
      name: `Recovery Member ${suffix}`,
      password: randomBytes(18).toString("base64url"),
    };
    const newTeammateAccount = {
      email: `partial-recovery-new-member-${suffix}@example.test`,
      name: `New Recovery Member ${suffix}`,
    };
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    let adminUserId = "";
    let ownerUserId = "";
    let teammateUserId = "";
    let cohortId = "";
    let mspId = "";

    try {
      await admin.from("admin_allowlist").upsert({ active: true, email: adminAccount.email });
      const adminUser = await admin.auth.admin.createUser({
        email: adminAccount.email,
        email_confirm: true,
        password: adminAccount.password,
        user_metadata: { full_name: "Partial Recovery Admin" },
      });
      if (adminUser.error) throw adminUser.error;
      adminUserId = adminUser.data.user.id;

      const cohort = await admin.from("cohorts").insert({
        lead_id: adminUserId,
        name: `Partial recovery cohort ${suffix}`,
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
        name: `Partial recovery MSP ${suffix}`,
        primary_contact_email: ownerAccount.email,
        primary_contact_name: ownerAccount.name,
      }).select("id").single();
      if (msp.error) throw msp.error;
      mspId = msp.data.id;

      const ownerInvitation = await admin.from("invitations").insert({
        email: ownerAccount.email,
        expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString(),
        full_name: ownerAccount.name,
        invited_by: adminUserId,
        msp_id: mspId,
        role: "msp_owner",
      });
      if (ownerInvitation.error) throw ownerInvitation.error;

      const ownerUser = await admin.auth.admin.createUser({
        email: ownerAccount.email,
        email_confirm: true,
        password: ownerAccount.password,
        user_metadata: { full_name: ownerAccount.name },
      });
      if (ownerUser.error) throw ownerUser.error;
      ownerUserId = ownerUser.data.user.id;

      await page.goto("/sign-in");
      await page.getByLabel("Work email").fill(ownerAccount.email);
      await page.getByLabel("Password", { exact: true }).fill(ownerAccount.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/cohort$/);
      await page.goto("/team");

      await page.getByLabel("Name").fill(teammateAccount.name);
      await page.getByLabel("Work email").fill(teammateAccount.email);
      await page.getByRole("button", { name: "Generate teammate link" }).click();
      await expect(page.getByRole("status")).toContainText("reusable 72-hour setup link");
      const originalSetupUrl = await page.getByLabel("Secure teammate setup link").inputValue();

      // Reproduce the production failure: the old handoff created the auth/profile
      // records, but the person left before creating a password.
      const interruptedContext = await browser.newContext();
      const interruptedPage = await interruptedContext.newPage();
      await interruptedPage.goto(originalSetupUrl);
      await interruptedPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(interruptedPage).toHaveURL(/\/set-password$/);
      await interruptedContext.close();

      const { data: partialProfile, error: partialProfileError } = await admin
        .from("profiles")
        .select("id, msp_id, role, password_setup_required")
        .eq("email", teammateAccount.email)
        .single();
      if (partialProfileError) throw partialProfileError;
      teammateUserId = partialProfile.id;
      expect(partialProfile).toMatchObject({
        msp_id: mspId,
        password_setup_required: true,
        role: "msp_member",
      });

      const legacyExpiry = new Date(Date.now() + 24 * 3_600_000).toISOString();
      const { data: legacyInvitation, error: legacyInvitationError } = await admin
        .from("invitations")
        .update({ expires_at: legacyExpiry, full_name: "", last_sent_at: new Date().toISOString() })
        .eq("email", teammateAccount.email)
        .eq("status", "pending")
        .select("id, auth_user_id")
        .single();
      if (legacyInvitationError) throw legacyInvitationError;
      expect(legacyInvitation.auth_user_id).toBe(teammateUserId);

      // An MSP user cannot enter Lemhi's management screen.
      await page.goto(`/admin/msps/${mspId}/team`);
      await expect(page).toHaveURL(/\/cohort$/);

      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      await adminPage.goto("/sign-in");
      await adminPage.getByLabel("Work email").fill(adminAccount.email);
      await adminPage.getByLabel("Password", { exact: true }).fill(adminAccount.password);
      await adminPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(adminPage).toHaveURL(/\/admin$/);
      await adminPage.goto(`/admin/msps/${mspId}/team`);
      await expect(adminPage.getByRole("heading", { name: `Partial recovery MSP ${suffix} team` })).toBeVisible();

      const teammateCard = adminPage.locator("article").filter({ hasText: teammateAccount.email });
      await expect(teammateCard.getByText("Setup pending")).toBeVisible();
      adminPage.once("dialog", (dialog) => dialog.accept());
      await teammateCard.getByRole("button", { name: "Generate replacement link" }).click();
      await expect(teammateCard.getByRole("status")).toContainText("reusable 72-hour setup link");
      const replacementSetupUrl = await teammateCard.getByLabel("Secure setup link").inputValue();
      expect(replacementSetupUrl).not.toBe(originalSetupUrl);

      const [{ data: invitations, error: invitationsError }, { data: profiles, error: profilesError }] = await Promise.all([
        admin
          .from("invitations")
          .select("id, auth_user_id, expires_at, full_name, status")
          .eq("email", teammateAccount.email),
        admin
          .from("profiles")
          .select("id, msp_id, role, password_setup_required")
          .eq("email", teammateAccount.email),
      ]);
      if (invitationsError || profilesError) throw invitationsError ?? profilesError;
      expect(invitations).toHaveLength(1);
      expect(profiles).toHaveLength(1);
      expect(invitations![0].id).toBe(legacyInvitation.id);
      expect(invitations![0].auth_user_id).toBe(teammateUserId);
      expect(invitations![0].full_name).toBe(teammateAccount.name);
      expect(invitations![0].status).toBe("pending");
      const validityHours = (Date.parse(invitations![0].expires_at) - Date.now()) / 3_600_000;
      expect(validityHours).toBeGreaterThan(71.9);
      expect(validityHours).toBeLessThanOrEqual(72);

      const addTeammate = adminPage.locator("section").filter({
        has: adminPage.getByRole("heading", { name: "Generate a teammate link" }),
      });
      await addTeammate.getByLabel("Name").fill(newTeammateAccount.name);
      await addTeammate.getByLabel("Work email").fill(newTeammateAccount.email);
      adminPage.once("dialog", (dialog) => dialog.accept());
      await addTeammate.getByRole("button", { name: "Generate teammate link" }).click();
      await expect(addTeammate.getByRole("status")).toContainText("reusable 72-hour setup link");
      expect(await addTeammate.getByLabel("Secure setup link").inputValue()).toContain("/setup#token=");
      const { data: newInvitation, error: newInvitationError } = await admin
        .from("invitations")
        .select("msp_id, role, status, expires_at")
        .eq("email", newTeammateAccount.email)
        .single();
      if (newInvitationError) throw newInvitationError;
      expect(newInvitation).toMatchObject({ msp_id: mspId, role: "msp_member", status: "pending" });
      const newInviteValidityHours = (Date.parse(newInvitation.expires_at) - Date.now()) / 3_600_000;
      expect(newInviteValidityHours).toBeGreaterThan(71.9);
      expect(newInviteValidityHours).toBeLessThanOrEqual(72);
      await adminContext.close();

      const oldLinkContext = await browser.newContext();
      const oldLinkPage = await oldLinkContext.newPage();
      await oldLinkPage.goto(originalSetupUrl);
      await oldLinkPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(oldLinkPage.getByRole("status")).toContainText("invalid, expired, or has been replaced");
      await oldLinkContext.close();

      const setupContext = await browser.newContext();
      const setupPage = await setupContext.newPage();
      await setupPage.goto(replacementSetupUrl);
      await setupPage.reload();
      await setupPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(setupPage).toHaveURL(/\/set-password$/);
      await setupPage.getByLabel("New password", { exact: true }).fill(teammateAccount.password);
      await setupPage.getByLabel("Confirm new password").fill(teammateAccount.password);
      await setupPage.getByRole("button", { name: "Save password and continue" }).click();
      await expect(setupPage).toHaveURL(/\/cohort$/);
      await expect(setupPage.getByText(`Partial recovery MSP ${suffix}`, { exact: true }).first()).toBeVisible();
      await setupContext.close();

      const [{ data: completedProfile }, { data: completedInvitation }] = await Promise.all([
        admin
          .from("profiles")
          .select("id, msp_id, role, password_setup_required")
          .eq("email", teammateAccount.email)
          .single(),
        admin
          .from("invitations")
          .select("id, status, accepted_at")
          .eq("email", teammateAccount.email)
          .single(),
      ]);
      expect(completedProfile).toMatchObject({
        id: teammateUserId,
        msp_id: mspId,
        password_setup_required: false,
        role: "msp_member",
      });
      expect(completedInvitation).toMatchObject({ id: legacyInvitation.id, status: "accepted" });
      expect(completedInvitation!.accepted_at).toBeTruthy();

      const loginContext = await browser.newContext();
      const loginPage = await loginContext.newPage();
      await loginPage.goto("/sign-in");
      await loginPage.getByLabel("Work email").fill(teammateAccount.email);
      await loginPage.getByLabel("Password", { exact: true }).fill(teammateAccount.password);
      await loginPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(loginPage).toHaveURL(/\/cohort$/);
      await expect(loginPage.getByText(`Partial recovery MSP ${suffix}`, { exact: true }).first()).toBeVisible();
      await loginContext.close();
    } finally {
      if (mspId) await admin.from("invitations").delete().eq("msp_id", mspId);
      if (mspId) await admin.from("profiles").delete().eq("msp_id", mspId);
      if (mspId) await admin.from("msps").delete().eq("id", mspId);
      if (teammateUserId) await admin.auth.admin.deleteUser(teammateUserId);
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
      if (cohortId) await admin.from("cohorts").delete().eq("id", cohortId);
      if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
      await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
    }
  });
});
