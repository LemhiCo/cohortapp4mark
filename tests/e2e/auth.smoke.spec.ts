import { expect, test } from "@playwright/test";

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
