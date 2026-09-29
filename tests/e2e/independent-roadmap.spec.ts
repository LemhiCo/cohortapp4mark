import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Without a local env file the guard below skips this suite.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const isLocal = (value: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(value);
const canRun = Boolean(secretKey) && isLocal(supabaseUrl) && isLocal(baseUrl);

const suffix = randomBytes(4).toString("hex");
const account = {
  email: `individual-admin-${suffix}@lemhi.com`,
  password: randomBytes(18).toString("base64url"),
  userId: "",
};
const mspName = `Independent Roadmap ${suffix}`;
const assetTitle = `Stage one resource ${suffix}`;
let admin: SupabaseClient | undefined;
let cohortId = "";
let mspId = "";

test.describe("independent MSP roadmap", () => {
  test.skip(!canRun, "Runs only against a local Supabase stack and local app.");

  test.beforeAll(async () => {
    if (!canRun) return;
    admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
    await admin.from("admin_allowlist").upsert({ email: account.email, active: true });
    const user = await admin.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      password: account.password,
      user_metadata: { full_name: `Independent Lead ${suffix}` },
    });
    if (user.error) throw user.error;
    account.userId = user.data.user!.id;
  });

  test.afterAll(async () => {
    if (!admin) return;
    if (mspId) await admin.from("msps").delete().eq("id", mspId);
    if (cohortId) await admin.from("cohorts").delete().eq("id", cohortId);
    if (account.userId) await admin.auth.admin.deleteUser(account.userId);
    await admin.from("admin_allowlist").delete().eq("email", account.email);
  });

  test("an admin creates a non-cohort member and previews its visual roadmap", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Work email").fill(account.email);
    await page.getByLabel(/^Password/).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const section = page.locator("#non-cohort-members");
    await section.getByLabel("MSP name").fill(mspName);
    await section.getByRole("button", { name: "Add non-cohort member" }).click();
    await expect(section.getByRole("status")).toContainText(`${mspName} now has an independent program workspace.`);

    const cohort = await admin!.from("cohorts").select("id, workspace_type").eq("name", `${mspName} — Individual`).single();
    if (cohort.error) throw cohort.error;
    cohortId = cohort.data.id;
    expect(cohort.data.workspace_type).toBe("individual");

    const msp = await admin!.from("msps").select("id").eq("cohort_id", cohortId).single();
    if (msp.error) throw msp.error;
    mspId = msp.data.id;

    const sessions = await admin!.from("sessions").select("id", { count: "exact", head: true }).eq("cohort_id", cohortId);
    expect(sessions.count).toBe(0);

    const weekOne = await admin!.from("cohort_weeks").select("id").eq("cohort_id", cohortId).eq("week_number", 1).single();
    if (weekOne.error) throw weekOne.error;
    const asset = await admin!.from("assets").insert({
      category: "documentation",
      cohort_week_id: weekOne.data.id,
      external_url: "https://example.test/independent-stage-one",
      kind: "link",
      msp_id: mspId,
      scope: "msp",
      status: "ready",
      title: assetTitle,
    });
    if (asset.error) throw asset.error;

    await page.goto(`/admin/msps/${mspId}/preview/cohort`);
    await expect(page.getByRole("heading", { name: "Your growth roadmap" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The path from foundation to launch" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(assetTitle) })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Peer companies" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sessions" })).toHaveCount(0);

    await page.getByRole("button", { name: /Stage 2/ }).click();
    await expect(page.getByText(/Stage 2 · 0% complete/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Requirements" })).toBeVisible();
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "The path from foundation to launch" }) }).locator("[aria-pressed=true]")).toContainText("Stage 2");
  });
});
