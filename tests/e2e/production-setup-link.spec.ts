import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
const enabled = process.env.RUN_PRODUCTION_SMOKE === "1"
  && baseUrl === "https://orientation.lemhi.ai"
  && Boolean(supabaseUrl && publishableKey && secretKey);

const suffix = randomBytes(5).toString("hex");
const ownerAccount = {
  email: `production-smoke-owner-${suffix}@example.test`,
  name: `Production Smoke Owner ${suffix}`,
  password: randomBytes(24).toString("base64url"),
};
const teammateAccount = {
  email: `production-smoke-teammate-${suffix}@example.test`,
  name: `Production Smoke Teammate ${suffix}`,
  password: randomBytes(24).toString("base64url"),
};
const testCohortName = "Cohort test 2";
const mspName = `[E2E] Client workspace ${suffix}`;
const otherMspName = `[E2E] Isolated workspace ${suffix}`;

test.describe("Production client setup smoke test", () => {
  test.skip(!enabled, "Requires the explicit production smoke-test command and production environment file.");
  test.setTimeout(90_000);

  test("a client can reuse the 72-hour link, create a password, sign in, and access only its MSP", async ({ browser, page }) => {
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    let ownerUserId = "";
    let teammateUserId = "";
    let cohortId = "";
    let mspId = "";
    let otherMspId = "";

    try {
      const { data: cohort, error: cohortError } = await admin
        .from("cohorts")
        .select("id, name")
        .eq("name", testCohortName)
        .single();
      if (cohortError || cohort.name !== testCohortName) throw cohortError ?? new Error("Cohort test 2 was not found.");
      cohortId = cohort.id;

      const otherMsp = await admin.from("msps").insert({
        cohort_id: cohortId,
        name: otherMspName,
      }).select("id").single();
      if (otherMsp.error) throw otherMsp.error;
      otherMspId = otherMsp.data.id;

      // Create a one-time, non-emailed admin session for Mark. This does not
      // create another admin or modify his password.
      const adminAccess = await admin.auth.admin.generateLink({
        email: "mark.creighton@lemhi.com",
        options: { redirectTo: `${baseUrl}/auth/confirm?next=/admin` },
        type: "magiclink",
      });
      if (adminAccess.error || !adminAccess.data.properties?.hashed_token) {
        throw adminAccess.error ?? new Error("Could not open the existing test administrator account.");
      }
      await page.goto(`/auth/confirm?token_hash=${adminAccess.data.properties.hashed_token}&type=magiclink&next=/admin`);
      await page.getByRole("button", { name: "Continue securely" }).click();
      await expect(page).toHaveURL(/\/admin$/);

      await page.goto(`/admin/cohorts/${cohortId}`);
      await page.getByLabel("MSP name").fill(mspName);
      await page.getByLabel(/^Main contact/).fill(ownerAccount.name);
      await page.getByLabel(/^Work email/).fill(ownerAccount.email);
      await page.getByRole("button", { name: "Create portal" }).click();
      await expect(page.getByRole("status")).toContainText("Review the roster");

      const { data: msp, error: mspError } = await admin
        .from("msps")
        .select("id")
        .eq("name", mspName)
        .single();
      if (mspError) throw mspError;
      mspId = msp.id;

      const card = page.locator("div.py-5").filter({
        has: page.getByRole("heading", { name: mspName, exact: true }),
      });
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Generate copyable link" }).click();
      await expect(card.getByRole("status")).toContainText("reusable 72-hour setup link");
      const firstSetupUrl = await card.getByLabel("Secure setup link").inputValue();
      expect(firstSetupUrl).toMatch(/^https:\/\/orientation\.lemhi\.ai\/setup#token=/);

      // A deliberate replacement must invalidate the older copied link while
      // leaving the newly generated link reusable for the full setup flow.
      page.once("dialog", (dialog) => dialog.accept());
      await card.getByRole("button", { name: "Generate copyable link" }).click();
      await expect.poll(() => card.getByLabel("Secure setup link").inputValue()).not.toBe(firstSetupUrl);
      const setupUrl = await card.getByLabel("Secure setup link").inputValue();
      expect(setupUrl).toMatch(/^https:\/\/orientation\.lemhi\.ai\/setup#token=/);

      const replacedContext = await browser.newContext();
      const replacedPage = await replacedContext.newPage();
      await replacedPage.goto(firstSetupUrl);
      await replacedPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(replacedPage.getByRole("status")).toContainText("invalid, expired, or has been replaced");
      await replacedContext.close();

      const { data: invitation, error: invitationError } = await admin
        .from("invitations")
        .select("expires_at, status")
        .eq("email", ownerAccount.email)
        .single();
      if (invitationError) throw invitationError;
      const validityHours = (Date.parse(invitation.expires_at) - Date.now()) / 3_600_000;
      expect(invitation.status).toBe("pending");
      expect(validityHours).toBeGreaterThan(71.9);
      expect(validityHours).toBeLessThanOrEqual(72);

      // Simulate an email scanner and a person previewing/reopening the page.
      const previewContext = await browser.newContext();
      const previewPage = await previewContext.newPage();
      await previewPage.goto(setupUrl);
      await expect(previewPage.getByRole("heading", { name: "Set up your workspace" })).toBeVisible();
      await previewPage.reload();
      await previewPage.goto(setupUrl);
      await previewPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(previewPage).toHaveURL(/\/set-password$/);
      await previewContext.close();

      // The same original link must still work in a fresh browser until setup finishes.
      const setupContext = await browser.newContext();
      const setupPage = await setupContext.newPage();
      await setupPage.goto(setupUrl);
      await setupPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(setupPage).toHaveURL(/\/set-password$/);
      await setupPage.getByLabel("New password", { exact: true }).fill(ownerAccount.password);
      await setupPage.getByLabel("Confirm new password").fill(ownerAccount.password);
      await setupPage.getByRole("button", { name: "Save password and continue" }).click();
      await expect(setupPage).toHaveURL(/\/cohort$/);
      await expect(setupPage.getByText(mspName, { exact: true }).first()).toBeVisible();
      await setupContext.close();

      const { data: ownerProfile, error: ownerError } = await admin
        .from("profiles")
        .select("id, msp_id, password_setup_required")
        .eq("email", ownerAccount.email)
        .single();
      if (ownerError) throw ownerError;
      ownerUserId = ownerProfile.id;
      expect(ownerProfile.msp_id).toBe(mspId);
      expect(ownerProfile.password_setup_required).toBe(false);

      const partner = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
      const signIn = await partner.auth.signInWithPassword({
        email: ownerAccount.email,
        password: ownerAccount.password,
      });
      if (signIn.error) throw signIn.error;
      const [{ data: ownMsp }, { data: forbiddenMsp }, { data: forbiddenInvites }] = await Promise.all([
        partner.from("msps").select("id").eq("id", mspId).maybeSingle(),
        partner.from("msps").select("id").eq("id", otherMspId).maybeSingle(),
        partner.from("invitations").select("id").eq("msp_id", otherMspId),
      ]);
      expect(ownMsp?.id).toBe(mspId);
      expect(forbiddenMsp).toBeNull();
      expect(forbiddenInvites).toEqual([]);
      await partner.auth.signOut();

      const loginContext = await browser.newContext();
      const loginPage = await loginContext.newPage();
      await loginPage.goto("/sign-in");
      await loginPage.getByLabel("Work email").fill(ownerAccount.email);
      await loginPage.getByLabel("Password", { exact: true }).fill(ownerAccount.password);
      await loginPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(loginPage).toHaveURL(/\/cohort$/);
      await loginPage.goto("/admin");
      await expect(loginPage).toHaveURL(/\/cohort$/);

      await loginPage.goto("/team");
      await loginPage.getByLabel("Name").fill(teammateAccount.name);
      await loginPage.getByLabel("Work email").fill(teammateAccount.email);
      await loginPage.getByRole("button", { name: "Generate teammate link" }).click();
      await expect(loginPage.getByRole("status")).toContainText("reusable 72-hour setup link");
      const teammateSetupUrl = await loginPage.getByLabel("Secure teammate setup link").inputValue();
      expect(teammateSetupUrl).toMatch(/^https:\/\/orientation\.lemhi\.ai\/setup#token=/);
      await loginContext.close();

      const teammatePreviewContext = await browser.newContext();
      const teammatePreviewPage = await teammatePreviewContext.newPage();
      await teammatePreviewPage.goto(teammateSetupUrl);
      await teammatePreviewPage.reload();
      await teammatePreviewPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(teammatePreviewPage).toHaveURL(/\/set-password$/);
      await teammatePreviewContext.close();

      const teammateSetupContext = await browser.newContext();
      const teammateSetupPage = await teammateSetupContext.newPage();
      await teammateSetupPage.goto(teammateSetupUrl);
      await teammateSetupPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(teammateSetupPage).toHaveURL(/\/set-password$/);
      await teammateSetupPage.getByLabel("New password", { exact: true }).fill(teammateAccount.password);
      await teammateSetupPage.getByLabel("Confirm new password").fill(teammateAccount.password);
      await teammateSetupPage.getByRole("button", { name: "Save password and continue" }).click();
      await expect(teammateSetupPage).toHaveURL(/\/cohort$/);
      await expect(teammateSetupPage.getByText(mspName, { exact: true }).first()).toBeVisible();
      await teammateSetupContext.close();

      const { data: teammateProfile, error: teammateError } = await admin
        .from("profiles")
        .select("id, msp_id, role, password_setup_required")
        .eq("email", teammateAccount.email)
        .single();
      if (teammateError) throw teammateError;
      teammateUserId = teammateProfile.id;
      expect(teammateProfile.msp_id).toBe(mspId);
      expect(teammateProfile.role).toBe("msp_member");
      expect(teammateProfile.password_setup_required).toBe(false);

      const teammateLoginContext = await browser.newContext();
      const teammateLoginPage = await teammateLoginContext.newPage();
      await teammateLoginPage.goto("/sign-in");
      await teammateLoginPage.getByLabel("Work email").fill(teammateAccount.email);
      await teammateLoginPage.getByLabel("Password", { exact: true }).fill(teammateAccount.password);
      await teammateLoginPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(teammateLoginPage).toHaveURL(/\/cohort$/);
      await teammateLoginPage.goto("/admin");
      await expect(teammateLoginPage).toHaveURL(/\/cohort$/);
      await teammateLoginContext.close();

      const completedContext = await browser.newContext();
      const completedPage = await completedContext.newPage();
      await completedPage.goto(setupUrl);
      await completedPage.getByRole("button", { name: "Continue securely" }).click();
      await expect(completedPage.getByRole("status")).toContainText("already complete");
      await completedContext.close();
    } finally {
      if (!ownerUserId) {
        const { data: profile } = await admin.from("profiles").select("id").eq("email", ownerAccount.email).maybeSingle();
        ownerUserId = profile?.id ?? "";
      }
      if (!teammateUserId) {
        const { data: profile } = await admin.from("profiles").select("id").eq("email", teammateAccount.email).maybeSingle();
        teammateUserId = profile?.id ?? "";
      }
      if (!mspId && cohortId) {
        const { data: msp } = await admin.from("msps").select("id").eq("cohort_id", cohortId).eq("name", mspName).maybeSingle();
        mspId = msp?.id ?? "";
      }
      if (!otherMspId && cohortId) {
        const { data: msp } = await admin.from("msps").select("id").eq("cohort_id", cohortId).eq("name", otherMspName).maybeSingle();
        otherMspId = msp?.id ?? "";
      }
      if (teammateUserId) await admin.auth.admin.deleteUser(teammateUserId);
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
      if (mspId) await admin.from("msps").delete().eq("id", mspId);
      if (otherMspId) await admin.from("msps").delete().eq("id", otherMspId);
    }
  });
});
