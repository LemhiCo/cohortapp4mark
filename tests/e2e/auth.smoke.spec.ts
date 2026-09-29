import { expect, test } from "@playwright/test";

const passwordAccount = {
  email: process.env.PLAYWRIGHT_MSP_EMAIL,
  expectedMsp: process.env.PLAYWRIGHT_EXPECTED_MSP,
  password: process.env.PLAYWRIGHT_MSP_PASSWORD,
};
const adminAccount = {
  email: process.env.PLAYWRIGHT_ADMIN_EMAIL,
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD,
};
test("a Lemhi email with a blank password never opens a portal", async ({ page }, testInfo) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your workspace" })).toBeVisible();
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await page.getByLabel("Work email").fill(`no-password-${projectSlug}@lemhi.com`);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("If your invitation is active");

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in$/);
});

for (const path of ["/cohort", "/checklist", "/library", "/team", "/admin"]) {
  test(`signed-out visitors cannot open ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
}

test("a provisioned MSP password account opens only its own portal", async ({ page }) => {
  test.skip(
    !passwordAccount.email || !passwordAccount.password || !passwordAccount.expectedMsp,
    "Set PLAYWRIGHT_MSP_EMAIL, PLAYWRIGHT_MSP_PASSWORD, and PLAYWRIGHT_EXPECTED_MSP to run this production smoke test.",
  );

  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(passwordAccount.email!);
  await page.getByLabel(/^Password/).fill(passwordAccount.password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/cohort$/);
  await expect(page.getByText(passwordAccount.expectedMsp!, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Link coming this week").first()).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/cohort$/);
  await expect(page.getByText(passwordAccount.expectedMsp!, { exact: true }).first()).toBeVisible();
});

test("a provisioned Lemhi admin password account opens the cohort pulse", async ({ page }) => {
  test.skip(
    !adminAccount.email || !adminAccount.password,
    "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run this production smoke test.",
  );

  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(adminAccount.email!);
  await page.getByLabel(/^Password/).fill(adminAccount.password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What needs attention" })).toBeVisible();

  await page.goto("/cohort");
  await expect(page).toHaveURL(/\/admin$/);
});
