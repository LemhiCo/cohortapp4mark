import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page, test } from "@playwright/test";

// Creates its own two admins, cohort, MSP and owner, so it only ever runs
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

const suffix = randomBytes(4).toString("hex");
const password = () => randomBytes(18).toString("base64url");
type Account = { email: string; password: string; userId?: string };
const firstLead: Account = { email: `lead-one-${suffix}@lemhi.com`, password: password() };
const secondLead: Account = { email: `lead-two-${suffix}@lemhi.com`, password: password() };
const owner: Account = { email: `lead-owner-${suffix}@example.test`, password: password() };
const names = { first: `First Lead ${suffix}`, second: `Second Lead ${suffix}`, secondTitle: `Partner Success ${suffix}` };

let admin: SupabaseClient | undefined;
const created: { cohortId?: string; mspId?: string } = {};

async function signIn(page: Page, account: Account, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function createAdmin(account: Account, fullName: string, title: string) {
  await admin!.from("admin_allowlist").upsert({ email: account.email, active: true });
  const user = await admin!.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: fullName } });
  if (user.error) throw user.error;
  account.userId = user.data.user!.id;
  const profile = await admin!.from("profiles").update({ title }).eq("id", account.userId);
  if (profile.error) throw profile.error;
}

test.describe("cohort lead", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and a local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await createAdmin(firstLead, names.first, "Head of Success");
    await createAdmin(secondLead, names.second, names.secondTitle);

    const cohort = await admin.from("cohorts").insert({
      program_id: "10000000-0000-4000-8000-000000000001",
      name: `Lead cohort ${suffix}`,
      start_date: new Date().toISOString().slice(0, 10),
      timezone: "America/New_York",
      session_weekday: 1,
      session_time: "11:00",
      lead_id: firstLead.userId,
    }).select("id").single();
    if (cohort.error) throw cohort.error;
    created.cohortId = cohort.data.id;

    const msp = await admin.from("msps").insert({ cohort_id: cohort.data.id, name: `Lead MSP ${suffix}` }).select("id").single();
    if (msp.error) throw msp.error;
    created.mspId = msp.data.id;
    const invite = await admin.from("invitations").insert({
      email: owner.email,
      role: "msp_owner",
      msp_id: msp.data.id,
      invited_by: firstLead.userId,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    if (invite.error) throw invite.error;
    const ownerUser = await admin.auth.admin.createUser({ email: owner.email, password: owner.password, email_confirm: true });
    if (ownerUser.error) throw ownerUser.error;
    owner.userId = ownerUser.data.user!.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (owner.userId) await admin.auth.admin.deleteUser(owner.userId);
    if (created.mspId) await admin.from("msps").delete().eq("id", created.mspId);
    if (created.cohortId) await admin.from("cohorts").delete().eq("id", created.cohortId);
    for (const account of [firstLead, secondLead]) {
      if (account.userId) await admin.auth.admin.deleteUser(account.userId);
      await admin.from("admin_allowlist").delete().eq("email", account.email);
    }
  });

  test("an admin switches the cohort lead and the MSP sees the new lead", async ({ browser, page }) => {
    await signIn(page, firstLead, /\/admin$/);
    await page.goto(`/admin/cohorts/${created.cohortId}`);

    const picker = page.getByLabel("Lemhi lead");
    const leadForm = page.locator("form").filter({ has: picker });
    await expect(picker).toHaveValue(firstLead.userId!);
    await expect(picker.locator(`option[value="${secondLead.userId}"]`)).toHaveText(`${names.second} · ${names.secondTitle}`);
    await expect(picker.locator(`option[value="${owner.userId}"]`)).toHaveCount(0);

    // The server rejects anyone who isn't an active Lemhi admin, even if the
    // form is tampered with.
    await picker.evaluate((select, value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = "Not an admin";
      select.append(option);
    }, owner.userId!);
    await picker.selectOption(owner.userId!);
    await leadForm.getByRole("button", { name: "Save lead" }).click();
    await expect(leadForm.getByRole("status")).toHaveText("Choose an active Lemhi lead.");

    await picker.selectOption(secondLead.userId!);
    await leadForm.getByRole("button", { name: "Save lead" }).click();
    await expect(leadForm.getByRole("status")).toContainText(`${names.second} now leads this cohort.`);
    const { data } = await admin!.from("cohorts").select("lead_id").eq("id", created.cohortId!).single();
    expect(data?.lead_id).toBe(secondLead.userId);

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await signIn(ownerPage, owner, /\/cohort$/);
    const leadCard = ownerPage.locator("section").filter({ hasText: "Your Lemhi lead" });
    await expect(leadCard).toContainText(names.second);
    await expect(leadCard).toContainText(names.secondTitle);
    await expect(leadCard).not.toContainText(names.first);
    await ownerContext.close();
  });
});
