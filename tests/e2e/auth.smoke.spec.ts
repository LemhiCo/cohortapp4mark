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

for (const path of ["/cohort", "/checklist", "/library", "/team", "/admin"]) {
  test(`signed-out visitors cannot open ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
}
