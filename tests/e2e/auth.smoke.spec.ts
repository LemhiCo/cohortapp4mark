import { expect, test } from "@playwright/test";

const passwordAccount = {
  email: process.env.PLAYWRIGHT_MSP_EMAIL,
  expectedMsp: process.env.PLAYWRIGHT_EXPECTED_MSP,
  password: process.env.PLAYWRIGHT_MSP_PASSWORD,
};

test("a Lemhi email enters the shared demo portal without an email round trip", async ({ page }, testInfo) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your cohort" })).toBeVisible();
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await page.getByLabel("Work email").fill(`portal-smoke-${projectSlug}@lemhi.com`);
  await page.getByRole("button", { name: "Enter the demo portal" }).click();
  await expect(page).toHaveURL(/\/cohort$/);
  await expect(page.getByRole("heading", { name: "Fall 2026 Demo Cohort" })).toBeVisible();
});

test("the demo view toggle switches between the client and admin portals", async ({ page }, testInfo) => {
  await page.goto("/sign-in");
  const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  await page.getByLabel("Work email").fill(`toggle-smoke-${projectSlug}@lemhi.com`);
  await page.getByRole("button", { name: "Enter the demo portal" }).click();
  await expect(page).toHaveURL(/\/cohort$/);

  await page.getByRole("button", { name: "Demo: switch to admin view" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Cohort setup" })).toBeVisible();

  await page.getByRole("button", { name: "Demo: switch to client view" }).click();
  await expect(page).toHaveURL(/\/cohort$/);
  await expect(page.getByRole("heading", { name: "Fall 2026 Demo Cohort" })).toBeVisible();
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
