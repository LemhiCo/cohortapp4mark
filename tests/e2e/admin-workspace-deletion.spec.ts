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
  email: `delete-admin-${suffix}@lemhi.com`,
  password: randomBytes(18).toString("base64url"),
};
const ownerAccount = {
  email: `delete-owner-${suffix}@example.test`,
  password: randomBytes(18).toString("base64url"),
};
const cohortName = `Deletion cohort ${suffix}`;
const mspName = `Deletion MSP ${suffix}`;

test.describe("Admin workspace deletion", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");
  test.setTimeout(60_000);

  test("requires accountable confirmation and audits portal and cohort deletion", async ({ page }) => {
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
        user_metadata: { full_name: "Deletion Test Admin" },
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

      const msp = await admin.from("msps").insert({ cohort_id: cohortId, name: mspName }).select("id").single();
      if (msp.error) throw msp.error;
      mspId = msp.data.id;

      const invitation = await admin.from("invitations").insert({
        email: ownerAccount.email,
        invited_by: adminUserId,
        msp_id: mspId,
        role: "msp_owner",
      });
      if (invitation.error) throw invitation.error;
      const ownerUser = await admin.auth.admin.createUser({
        email: ownerAccount.email,
        email_confirm: true,
        password: ownerAccount.password,
      });
      if (ownerUser.error) throw ownerUser.error;
      ownerUserId = ownerUser.data.user!.id;

      const teammateInvitation = await admin.from("invitations").insert({
        email: `delete-teammate-${suffix}@example.test`,
        invited_by: ownerUserId,
        msp_id: mspId,
        role: "msp_member",
      });
      if (teammateInvitation.error) throw teammateInvitation.error;

      await page.goto("/sign-in");
      await page.getByLabel("Work email").fill(adminAccount.email);
      await page.getByLabel("Password", { exact: true }).fill(adminAccount.password);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);

      await page.goto(`/admin/msps/${mspId}`);
      await page.getByText("Open permanent deletion controls").click();
      await page.getByLabel("Reason for deletion").fill("This is a disposable automated test portal.");
      await page.getByLabel("Accountable manager email").fill("someone-else@lemhi.com");
      await page.getByLabel("Confirm the exact MSP portal name").fill(mspName);
      await page.getByLabel(/I understand this permanently deletes/).check();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Permanently delete MSP portal" }).click();
      await expect(page.getByRole("status")).toContainText("must be your signed-in email");
      expect((await admin.from("msps").select("id").eq("id", mspId).maybeSingle()).data?.id).toBe(mspId);

      await page.getByLabel("Reason for deletion").fill("This is a disposable automated test portal.");
      await page.getByLabel("Accountable manager email").fill(adminAccount.email);
      await page.getByLabel("Confirm the exact MSP portal name").fill(mspName);
      await page.getByLabel(/I understand this permanently deletes/).check();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Permanently delete MSP portal" }).click();
      await expect(page).toHaveURL(/\/admin$/);
      expect((await admin.from("msps").select("id").eq("id", mspId).maybeSingle()).data).toBeNull();
      expect((await admin.from("cohorts").select("id").eq("id", cohortId).maybeSingle()).data?.id).toBe(cohortId);
      expect((await admin.from("profiles").select("id").eq("id", ownerUserId).maybeSingle()).data).toBeNull();

      const portalAudit = await admin.from("admin_deletion_audit")
        .select("status, reason, owner_email, deleted_by")
        .eq("target_id", mspId)
        .single();
      expect(portalAudit.error).toBeNull();
      expect(portalAudit.data).toMatchObject({
        deleted_by: adminUserId,
        owner_email: adminAccount.email,
        status: "completed",
      });

      await page.goto(`/admin/cohorts/${cohortId}`);
      await page.getByText("Open permanent deletion controls").click();
      await page.getByLabel("Reason for deletion").fill("This is a disposable automated test cohort.");
      await page.getByLabel("Accountable manager email").fill(adminAccount.email);
      await page.getByLabel("Confirm the exact cohort name").fill(cohortName);
      await page.getByLabel(/I understand this permanently deletes/).check();
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Permanently delete cohort" }).click();
      await expect(page).toHaveURL(/\/admin$/);
      expect((await admin.from("cohorts").select("id").eq("id", cohortId).maybeSingle()).data).toBeNull();
      const cohortAudit = await admin.from("admin_deletion_audit").select("status").eq("target_id", cohortId).single();
      expect(cohortAudit.data?.status).toBe("completed");
    } finally {
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId);
      if (mspId) await admin.from("msps").delete().eq("id", mspId);
      if (cohortId) await admin.from("cohorts").delete().eq("id", cohortId);
      if (adminUserId) await admin.auth.admin.deleteUser(adminUserId);
      await admin.from("admin_allowlist").delete().eq("email", adminAccount.email);
      if (mspId || cohortId) await admin.from("admin_deletion_audit").delete().in("target_id", [mspId, cohortId].filter(Boolean));
    }
  });
});
