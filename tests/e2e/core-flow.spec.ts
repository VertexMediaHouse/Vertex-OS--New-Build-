import { expect, test } from "@playwright/test";
import { login } from "./helpers";

const MODULES = ["/dashboard", "/leads", "/clients", "/projects", "/tasks", "/time", "/invoices", "/goals", "/files", "/reports", "/campaigns", "/team", "/settings", "/calendar", "/notifications", "/activity"];

test("every module renders in every company scope", async ({ page }) => {
  test.setTimeout(180_000);
  await login(page);
  for (const company of ["all", "vmh", "vth"]) {
    for (const path of MODULES) {
      const res = await page.goto(`${path}?company=${company}`);
      expect(res?.status(), `${path} (${company})`).toBeLessThan(400);
      await expect(page.locator("h1").first(), `${path} (${company})`).toBeVisible();
      await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
    }
  }
});

test("add a lead, then convert it to a client with a project", async ({ page }) => {
  const name = `E2E Lead ${Date.now()}`;
  await login(page, undefined, "/leads");
  await page.getByRole("button", { name: "Add Lead" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Lead / company name").fill(name);
  await dialog.getByLabel("Service").fill("YouTube Editing");
  await dialog.getByLabel("Value (₹)").fill("45000");
  await dialog.getByRole("button", { name: "Add Lead" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("link", { name: `Open ${name}` }).click();
  await page.getByRole("button", { name: "Convert to Client + Project" }).click();
  await page.waitForURL(/\/clients\/[^/]+$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
});
