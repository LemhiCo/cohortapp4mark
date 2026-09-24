import { expect, test } from "@playwright/test";

test("sign-in page requests a passwordless link without revealing account status", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("heading", { name: "Sign in to your cohort" })).toBeVisible();
  await page.getByLabel("Work email").fill("portal-smoke-test@example.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("If your invitation is active");
});

for (const path of ["/cohort", "/checklist", "/library", "/team", "/admin"]) {
  test(`signed-out visitors cannot open ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/sign-in$/);
  });
}
