import { randomBytes } from "node:crypto";

import { expect, type Page, test } from "@playwright/test";

// After-deploy check of the admin pages from the mvp-autonomous branch. It
// signs in with PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD, set in
// the shell of whoever runs it; nothing is stored. It only reads, unless
// PLAYWRIGHT_WRITE_CHECKS=1: then it uploads one small file for one MSP,
// renames it, and deletes it again.
const account = {
  email: process.env.PLAYWRIGHT_ADMIN_EMAIL ?? "",
  password: process.env.PLAYWRIGHT_ADMIN_PASSWORD ?? "",
};
const mspName = process.env.PLAYWRIGHT_EXPECTED_MSP;
const writeChecks = process.env.PLAYWRIGHT_WRITE_CHECKS === "1";
const title = `Release check ${randomBytes(4).toString("hex")}`;
const renamed = `${title} (renamed)`;

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Work email").fill(account.email);
  await page.getByLabel(/^Password/).fill(account.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

// Opens the admin page of the MSP named by PLAYWRIGHT_EXPECTED_MSP, or of the
// first MSP under "MSP progress".
async function openMsp(page: Page) {
  await page.goto("/admin");
  const links = page.getByRole("heading", { name: "MSP progress" }).locator("xpath=following-sibling::div[1]").getByRole("link");
  const link = mspName ? links.filter({ hasText: mspName }).first() : links.first();
  const name = mspName ?? (await link.locator("p").first().innerText());
  await link.click();
  await expect(page).toHaveURL(/\/admin\/msps\/[0-9a-f-]{36}$/);
  return { name, url: page.url() };
}

const libraryRow = (page: Page, name: string) =>
  page.locator("div.py-4").filter({ has: page.getByRole("heading", { name, exact: true }) });

async function deleteFromLibrary(page: Page, name: string) {
  await page.goto("/admin/library");
  const row = libraryRow(page, name);
  if (!(await row.count())) return;
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await row.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toHaveCount(0);
}

test.describe("release check: admin pages", () => {
  test.skip(!account.email || !account.password, "Set PLAYWRIGHT_ADMIN_EMAIL and PLAYWRIGHT_ADMIN_PASSWORD to run the release check.");
  test.setTimeout(60_000);

  test("the cohort pulse shows stuck tasks and a card per cohort", async ({ page }) => {
    await signIn(page);
    const stuckHeading = page.getByRole("heading", { name: "Stuck tasks" });
    await expect(stuckHeading).toBeVisible();
    const cards = page.getByRole("heading", { name: "Every cohort" }).locator("xpath=following-sibling::div[1]").getByRole("link");
    await expect(cards.first()).toBeVisible();

    const stuck = await stuckHeading.locator("xpath=following-sibling::ol[1]/li").allInnerTexts();
    console.log(`Every cohort: ${(await cards.allInnerTexts()).map((text) => text.replace(/\s+/g, " ")).join(" | ")}`);
    console.log(`Stuck tasks: ${stuck.map((text) => text.replace(/\s+/g, " ")).join(" | ")}`);
  });

  test("View as MSP is read-only and returns to the MSP page", async ({ page }) => {
    await signIn(page);
    const msp = await openMsp(page);

    await page.getByRole("link", { name: "View as MSP" }).click();
    await expect(page).toHaveURL(/\/preview\/cohort$/);
    await expect(page.getByText(`Viewing as ${msp.name}.`)).toBeVisible();

    const nav = page.getByRole("navigation", { name: "MSP preview" });
    await nav.getByRole("link", { name: "Checklist" }).click();
    await expect(page).toHaveURL(/\/preview\/checklist$/);
    await expect(page.getByRole("button", { name: /Mark task as/ })).toHaveCount(0);

    await nav.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/preview\/library$/);

    await page.getByRole("link", { name: "← Back to MSP admin" }).click();
    await expect(page).toHaveURL(msp.url);
  });

  test("Program and Recordings open; nothing is saved", async ({ page }) => {
    await signIn(page);

    await page.goto("/admin/program");
    await expect(page.getByRole("heading", { level: 1, name: "Program" })).toBeVisible();
    const reach = page.getByText(/Changes here reach (the 1 upcoming or active cohort|all \d+ upcoming and active cohorts)/).first();
    await expect(reach).toBeVisible();
    console.log(`Program: ${await reach.innerText()}`);

    await page.goto("/admin/recordings");
    await expect(page.getByRole("heading", { level: 1, name: "Session recordings" })).toBeVisible();
    const sessions = page.locator('select[name="sessionId"] option');
    await expect(sessions.first()).toBeAttached();
    console.log(`Recordings: ${await sessions.count()} group sessions: ${(await sessions.allInnerTexts()).join(" | ")}`);
  });

  test("an MSP-only file can be uploaded, renamed, seen by that MSP, and deleted", async ({ page }) => {
    test.skip(!writeChecks, "Set PLAYWRIGHT_WRITE_CHECKS=1 to upload, rename, and delete one test file.");
    test.setTimeout(120_000);
    await signIn(page);
    const msp = await openMsp(page);
    let deleted = false;

    try {
      await page.goto("/admin/library");
      await page.getByLabel("Title").fill(title);
      await page.getByLabel("Who can see it").selectOption("msp");
      await page.getByLabel("MSP", { exact: true }).selectOption({ label: msp.name });
      await page.locator('input[type="file"][name="file"]').setInputFiles({
        name: "release-check.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Release check file. Safe to delete."),
      });
      await page.getByRole("button", { name: "Upload to library" }).click();
      await expect(page.getByText("Asset added to the library.")).toBeVisible({ timeout: 60_000 });

      await page.reload();
      const row = libraryRow(page, title);
      await row.getByRole("button", { name: "Edit" }).click();
      await row.getByLabel("Title").fill(renamed);
      await row.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByRole("heading", { name: renamed, exact: true })).toBeVisible();

      const openHref = await libraryRow(page, renamed).getByRole("link", { name: "Open ↗" }).getAttribute("href");
      expect(openHref).toMatch(/^\/api\/assets\/[0-9a-f-]{36}$/);
      expect((await page.request.get(openHref!, { maxRedirects: 0 })).status()).toBeLessThan(400);

      await page.goto(`${msp.url}/preview/library`);
      await expect(page.getByRole("heading", { name: renamed, exact: true })).toBeVisible();

      await deleteFromLibrary(page, renamed);
      deleted = true;
      await page.goto(`${msp.url}/preview/library`);
      await expect(page.getByRole("heading", { name: renamed, exact: true })).toHaveCount(0);
      expect((await page.request.get(openHref!, { maxRedirects: 0 })).status()).toBe(404);
    } finally {
      // Never leave the test file behind, whichever step failed.
      if (!deleted) {
        for (const name of [renamed, title]) await deleteFromLibrary(page, name).catch(() => undefined);
      }
    }
  });
});
