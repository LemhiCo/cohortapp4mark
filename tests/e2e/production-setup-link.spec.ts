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
const otherMspContact = `hidden-peer-${suffix}@example.test`;
const cohortResourceTitle = `[E2E] Cohort resource ${suffix}`;
const privateResourceTitle = `[E2E] Private resource ${suffix}`;
const otherMspResourceTitle = `[E2E] Other MSP secret ${suffix}`;
const ownerNote = `Owner weekly update ${suffix}`;
const teammateNote = `Teammate weekly update ${suffix}`;

test.describe("Production client setup smoke test", () => {
  test.skip(!enabled, "Requires the explicit production smoke-test command and production environment file.");
  test.setTimeout(150_000);

  test("an MSP can onboard, work weekly, manage its team, and remain isolated", async ({ browser, page }) => {
    const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    let ownerUserId = "";
    let teammateUserId = "";
    let cohortId = "";
    let mspId = "";
    let otherMspId = "";
    let assetIds: string[] = [];
    let mspTasks: Array<{ id: string; title: string }> = [];
    let lemhiTask: { id: string; title: string } | null = null;

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
        primary_contact_email: otherMspContact,
        primary_contact_name: "Hidden Peer Contact",
        website: "https://peer.example.test",
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

      const { data: weekOne, error: weekError } = await admin
        .from("cohort_weeks")
        .select("id")
        .eq("cohort_id", cohortId)
        .eq("week_number", 1)
        .single();
      if (weekError) throw weekError;

      const [{ data: editableTasks, error: editableTaskError }, { data: readOnlyTask, error: readOnlyTaskError }] = await Promise.all([
        admin
          .from("cohort_tasks")
          .select("id, title")
          .eq("cohort_id", cohortId)
          .eq("cohort_week_id", weekOne.id)
          .eq("owner_type", "msp")
          .eq("kind", "task")
          .is("archived_at", null)
          .order("position")
          .limit(3),
        admin
          .from("cohort_tasks")
          .select("id, title")
          .eq("cohort_id", cohortId)
          .eq("cohort_week_id", weekOne.id)
          .eq("owner_type", "lemhi")
          .is("archived_at", null)
          .order("position")
          .limit(1)
          .single(),
      ]);
      if (editableTaskError || readOnlyTaskError || !editableTasks || editableTasks.length < 3) {
        throw editableTaskError ?? readOnlyTaskError ?? new Error("Test cohort needs three MSP-owned Week 1 tasks.");
      }
      mspTasks = editableTasks;
      lemhiTask = readOnlyTask;

      const { data: assets, error: assetError } = await admin.from("assets").insert([
        {
          category: "link",
          cohort_id: cohortId,
          external_url: `https://example.com/cohort-${suffix}`,
          kind: "link",
          scope: "cohort",
          status: "ready",
          title: cohortResourceTitle,
        },
        {
          category: "link",
          external_url: `https://example.com/private-${suffix}`,
          kind: "link",
          msp_id: mspId,
          scope: "msp",
          status: "ready",
          title: privateResourceTitle,
        },
        {
          category: "link",
          external_url: `https://example.com/forbidden-${suffix}`,
          kind: "link",
          msp_id: otherMspId,
          scope: "msp",
          status: "ready",
          title: otherMspResourceTitle,
        },
      ]).select("id");
      if (assetError) throw assetError;
      assetIds = (assets ?? []).map((asset) => asset.id);

      const { data: firstSession, error: sessionError } = await admin
        .from("sessions")
        .select("id")
        .eq("cohort_id", cohortId)
        .eq("kind", "group")
        .eq("week_number", 1)
        .single();
      if (sessionError) throw sessionError;
      const { error: sessionUpdateError } = await admin
        .from("sessions")
        .update({ join_url: `https://example.com/session-${suffix}` })
        .eq("id", firstSession.id);
      if (sessionUpdateError) throw sessionUpdateError;

      const card = page.locator("div.py-5").filter({
        has: page.getByRole("heading", { name: mspName, exact: true }),
      });
      await expect(card.getByRole("button", { name: /Send (new )?setup link|Resend setup link/ })).toHaveCount(0);
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
      const [{ data: ownMsp }, { data: forbiddenMsp }, { data: forbiddenInvites }, { data: forbiddenAssets }] = await Promise.all([
        partner.from("msps").select("id").eq("id", mspId).maybeSingle(),
        partner.from("msps").select("id").eq("id", otherMspId).maybeSingle(),
        partner.from("invitations").select("id").eq("msp_id", otherMspId),
        partner.from("assets").select("id").eq("msp_id", otherMspId),
      ]);
      expect(ownMsp?.id).toBe(mspId);
      expect(forbiddenMsp).toBeNull();
      expect(forbiddenInvites).toEqual([]);
      expect(forbiddenAssets).toEqual([]);
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

      // The owner can understand the roadmap, session, lead, and safe peer view.
      await expect(loginPage.getByRole("heading", { name: "The path from foundation to launch" })).toBeVisible();
      await expect(loginPage.locator("button[aria-pressed]")).toHaveCount(4);
      await expect(loginPage.getByText(otherMspName, { exact: true })).toBeVisible();
      await expect(loginPage.getByText("peer.example.test", { exact: true })).toBeVisible();
      await expect(loginPage.getByText(otherMspContact, { exact: true })).toHaveCount(0);
      await expect(loginPage.getByRole("link", { name: "Join ↗" }).first()).toHaveAttribute(
        "href",
        `https://example.com/session-${suffix}`,
      );
      await expect(loginPage.getByText("Your Lemhi lead")).toBeVisible();

      // Normal weekly work: complete an MSP task, add a note, and leave Lemhi work read-only.
      await loginPage.goto("/checklist");
      const ownerTaskCard = loginPage.locator("article").filter({
        has: loginPage.getByRole("heading", { name: mspTasks[0].title, exact: true }),
      });
      await ownerTaskCard.getByRole("button", { name: "Mark task as done" }).click();
      await expect(ownerTaskCard.getByRole("button", { name: "Mark task as not done" })).toBeVisible();
      await ownerTaskCard.getByText(/^Notes/).click();
      await ownerTaskCard.getByLabel("Add a note").fill(ownerNote);
      await ownerTaskCard.getByRole("button", { name: "Post note" }).click();
      await expect(ownerTaskCard.getByRole("status")).toContainText("Note posted");
      await expect(ownerTaskCard.getByText(ownerNote, { exact: true })).toBeVisible();

      const lemhiTaskCard = loginPage.locator("article").filter({
        has: loginPage.getByRole("heading", { name: lemhiTask!.title, exact: true }),
      });
      await expect(lemhiTaskCard.getByRole("button", { name: /Mark task as/ })).toHaveCount(0);
      await expect(lemhiTaskCard.getByLabel("Not complete")).toBeVisible();

      const [{ data: ownerCompletion }, { data: savedOwnerNote }, { data: progress }] = await Promise.all([
        admin.from("task_completions").select("cohort_task_id").eq("msp_id", mspId).eq("cohort_task_id", mspTasks[0].id).single(),
        admin.from("task_notes").select("body").eq("msp_id", mspId).eq("body", ownerNote).single(),
        admin.from("msp_progress").select("overall_completed_tasks").eq("msp_id", mspId).eq("week_number", 1).single(),
      ]);
      expect(ownerCompletion?.cohort_task_id).toBe(mspTasks[0].id);
      expect(savedOwnerNote?.body).toBe(ownerNote);
      expect(progress?.overall_completed_tasks ?? 0).toBeGreaterThan(0);

      // The library exposes this cohort and MSP only, with useful search and filters.
      await loginPage.goto("/library");
      await expect(loginPage.getByRole("heading", { name: cohortResourceTitle, exact: true })).toBeVisible();
      await expect(loginPage.getByRole("heading", { name: privateResourceTitle, exact: true })).toBeVisible();
      await expect(loginPage.getByRole("heading", { name: otherMspResourceTitle, exact: true })).toHaveCount(0);
      await loginPage.getByLabel("Search the library").fill(privateResourceTitle);
      await expect(loginPage.getByRole("heading", { name: privateResourceTitle, exact: true })).toBeVisible();
      await expect(loginPage.getByRole("heading", { name: cohortResourceTitle, exact: true })).toHaveCount(0);
      await loginPage.getByLabel("Search the library").fill("");
      await loginPage.getByRole("button", { name: "Links" }).click();
      await expect(loginPage.getByRole("heading", { name: privateResourceTitle, exact: true })).toBeVisible();
      await expect(loginPage.getByText("Your team only", { exact: true })).toBeVisible();

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
      await expect(teammateLoginPage.getByRole("navigation", { name: "Portal" }).getByRole("link", { name: "Team" })).toHaveCount(0);
      await teammateLoginPage.goto("/admin");
      await expect(teammateLoginPage).toHaveURL(/\/cohort$/);

      await teammateLoginPage.goto("/team");
      await expect(teammateLoginPage.getByRole("heading", { name: "Your main contact manages access" })).toBeVisible();
      await expect(teammateLoginPage.getByRole("button", { name: "Generate teammate link" })).toHaveCount(0);

      await teammateLoginPage.goto("/library");
      await expect(teammateLoginPage.getByRole("heading", { name: cohortResourceTitle, exact: true })).toBeVisible();
      await expect(teammateLoginPage.getByRole("heading", { name: privateResourceTitle, exact: true })).toBeVisible();
      await expect(teammateLoginPage.getByRole("heading", { name: otherMspResourceTitle, exact: true })).toHaveCount(0);

      await teammateLoginPage.goto("/checklist");
      const teammateTaskCard = teammateLoginPage.locator("article").filter({
        has: teammateLoginPage.getByRole("heading", { name: mspTasks[1].title, exact: true }),
      });
      await teammateTaskCard.getByRole("button", { name: "Mark task as done" }).click();
      await expect(teammateTaskCard.getByRole("button", { name: "Mark task as not done" })).toBeVisible();
      await teammateTaskCard.getByText(/^Notes/).click();
      await teammateTaskCard.getByLabel("Add a note").fill(teammateNote);
      await teammateTaskCard.getByRole("button", { name: "Post note" }).click();
      await expect(teammateTaskCard.getByRole("status")).toContainText("Note posted");
      await expect(teammateTaskCard.getByText(teammateNote, { exact: true })).toBeVisible();
      await teammateLoginContext.close();

      // The owner can remove a teammate and the removed account loses access.
      const ownerReturnContext = await browser.newContext();
      const ownerReturnPage = await ownerReturnContext.newPage();
      await ownerReturnPage.goto("/sign-in");
      await ownerReturnPage.getByLabel("Work email").fill(ownerAccount.email);
      await ownerReturnPage.getByLabel("Password", { exact: true }).fill(ownerAccount.password);
      await ownerReturnPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(ownerReturnPage).toHaveURL(/\/cohort$/);
      await ownerReturnPage.goto("/team");
      const teammateRow = ownerReturnPage.locator("div.py-4").filter({ hasText: teammateAccount.email });
      await teammateRow.getByRole("button", { name: "Remove" }).click();
      await expect(teammateRow.getByText("Removed", { exact: true })).toBeVisible();

      const removedContext = await browser.newContext();
      const removedPage = await removedContext.newPage();
      await removedPage.goto("/sign-in");
      await removedPage.getByLabel("Work email").fill(teammateAccount.email);
      await removedPage.getByLabel("Password", { exact: true }).fill(teammateAccount.password);
      await removedPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(removedPage).toHaveURL(/\/sign-in$/);
      await expect(removedPage.getByRole("status")).toContainText("not recognized");
      await removedContext.close();

      // Ended cohorts remain useful but become read-only in both the UI and database.
      const { error: endedError } = await admin.from("cohorts").update({ status_override: "ended" }).eq("id", cohortId);
      if (endedError) throw endedError;
      await ownerReturnPage.goto("/checklist");
      await expect(ownerReturnPage.getByText("Read-only", { exact: true })).toBeVisible();
      await expect(ownerReturnPage.getByRole("button", { name: /Mark task as/ })).toHaveCount(0);
      await expect(ownerReturnPage.getByLabel("Add a note")).toHaveCount(0);

      const endedPartner = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
      const endedSignIn = await endedPartner.auth.signInWithPassword({
        email: ownerAccount.email,
        password: ownerAccount.password,
      });
      if (endedSignIn.error) throw endedSignIn.error;
      const [{ error: endedCompletionError }, { error: endedNoteError }] = await Promise.all([
        endedPartner.from("task_completions").insert({
          cohort_task_id: mspTasks[2].id,
          completed_by: ownerUserId,
          msp_id: mspId,
        }),
        endedPartner.from("task_notes").insert({
          author_id: ownerUserId,
          body: `Should be rejected ${suffix}`,
          cohort_task_id: mspTasks[2].id,
          msp_id: mspId,
        }),
      ]);
      expect(endedCompletionError).not.toBeNull();
      expect(endedNoteError).not.toBeNull();
      await endedPartner.auth.signOut();

      // Sign-out closes the session, and a deactivated MSP cannot return.
      await ownerReturnPage.getByRole("button", { name: "Sign out" }).click();
      await expect(ownerReturnPage).toHaveURL(/\/sign-in$/);
      await ownerReturnPage.goto("/checklist");
      await expect(ownerReturnPage).toHaveURL(/\/sign-in$/);
      const { error: deactivateError } = await admin.from("msps").update({ status: "deactivated" }).eq("id", mspId);
      if (deactivateError) throw deactivateError;
      await ownerReturnPage.getByLabel("Work email").fill(ownerAccount.email);
      await ownerReturnPage.getByLabel("Password", { exact: true }).fill(ownerAccount.password);
      await ownerReturnPage.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(ownerReturnPage).toHaveURL(/\/sign-in$/);
      await expect(ownerReturnPage.getByRole("status")).toContainText("MSP portal is inactive");
      await ownerReturnContext.close();

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
      const userIds = [teammateUserId, ownerUserId].filter(Boolean);
      const mspIds = [mspId, otherMspId].filter(Boolean);
      const cleanupResults = await Promise.all([
        assetIds.length ? admin.from("assets").delete().in("id", assetIds) : Promise.resolve({ error: null }),
        mspIds.length ? admin.from("task_notes").delete().in("msp_id", mspIds) : Promise.resolve({ error: null }),
        mspIds.length ? admin.from("task_completions").delete().in("msp_id", mspIds) : Promise.resolve({ error: null }),
        mspIds.length ? admin.from("msp_hidden_tasks").delete().in("msp_id", mspIds) : Promise.resolve({ error: null }),
        mspIds.length ? admin.from("activity_events").delete().in("msp_id", mspIds) : Promise.resolve({ error: null }),
      ]);
      const cleanupError = cleanupResults.find((result) => result.error)?.error;
      if (cleanupError) throw cleanupError;

      if (mspIds.length) {
        const { error } = await admin.from("invitations").delete().in("msp_id", mspIds);
        if (error) throw error;
        const { error: profileError } = await admin.from("profiles").delete().in("msp_id", mspIds);
        if (profileError) throw profileError;
        const { error: mspError } = await admin.from("msps").delete().in("id", mspIds);
        if (mspError) throw mspError;
      }
      for (const userId of userIds) {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error && !error.message.toLowerCase().includes("not found")) throw error;
      }
    }
  });
});
