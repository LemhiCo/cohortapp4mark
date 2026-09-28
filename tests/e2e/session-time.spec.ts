import { expect, type Page, test } from "@playwright/test";

// Session times are shown in the viewer's own time zone. The server renders
// in its own zone (UTC on Vercel), so the browser must switch once it has
// loaded. The server is unlikely to be in Honolulu, so if a server-rendered
// label is left in place, this test fails.
const msp = { email: process.env.PLAYWRIGHT_MSP_EMAIL ?? "", password: process.env.PLAYWRIGHT_MSP_PASSWORD ?? "" };
const admin = { email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "", password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "" };

test.use({ timezoneId: "Pacific/Honolulu" });

async function signIn(page: Page, account: { email: string; password: string }, landing: RegExp) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(landing);
}

async function expectViewerTimes(page: Page) {
  // Sign-in lands through a client-side navigation, which renders in the
  // browser. A full page load renders on the server first, as when a viewer
  // opens or refreshes the page.
  await page.reload();
  const times = page.locator("time[datetime]");
  await expect(times.first()).toBeVisible();
  for (const time of await times.all()) await expect(time).toHaveText(/\bHST$/);
}

test("an MSP sees session times in their own time zone", async ({ page }) => {
  test.skip(!msp.email || !msp.password, "Set PLAYWRIGHT_MSP_EMAIL and PLAYWRIGHT_MSP_PASSWORD to run this check.");
  await signIn(page, msp, /\/cohort$/);
  await expectViewerTimes(page);
});

test("an admin sees upcoming sessions in their own time zone", async ({ page }) => {
  test.skip(!admin.email || !admin.password, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run this check.");
  await signIn(page, admin, /\/admin$/);
  await expectViewerTimes(page);
});
