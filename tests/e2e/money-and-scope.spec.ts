import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

/** The number on a KPI card, e.g. "Total Leads" → 32. */
async function kpi(page: Page, label: string): Promise<number> {
  const value = await page.locator(`p:text-is("${label}") + div span`).first().innerText();
  return Number(value.replace(/[^\d]/g, ""));
}

test("company scope really filters the data: VMH + VTH = All", async ({ page }) => {
  await login(page, undefined, "/leads");
  const counts: Record<string, number> = {};
  for (const company of ["all", "vmh", "vth"]) {
    await page.goto(`/leads?company=${company}`);
    await expect(page.getByRole("heading", { name: "Leads", exact: true })).toBeVisible();
    counts[company] = await kpi(page, "Total Leads");
  }
  expect(counts.vmh).toBeGreaterThan(0);
  expect(counts.vth).toBeGreaterThan(0);
  expect(counts.vmh! + counts.vth!).toBe(counts.all);
});

test("an invoice number that was already used is refused", async ({ page }) => {
  await login(page, undefined, "/settings");
  await page.goto("/settings?tab=companies");
  const form = page.locator("form").filter({ has: page.getByLabel("Next invoice number") }).first();
  await form.getByLabel("Next invoice number").fill("1");
  await form.getByRole("button", { name: /^Save / }).click();
  await expect(page.getByText(/must be above/)).toBeVisible();
});

test("a payment lowers the outstanding amount", async ({ page }) => {
  await login(page, undefined, "/invoices");
  await page.goto("/invoices?status=PENDING");
  const href = await page.locator("tbody tr a").first().getAttribute("href");
  await page.goto(`/invoices${href}`);
  const outstanding = page.locator('dt:text-is("Outstanding") + dd');
  const before = Number((await outstanding.innerText()).replace(/[^\d]/g, ""));
  expect(before).toBeGreaterThan(1000);

  await page.getByRole("button", { name: "Record Payment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/^Amount/).fill("1000");
  await dialog.getByRole("button", { name: "Save payment" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => Number((await outstanding.innerText()).replace(/[^\d]/g, ""))).toBe(before - 1000);
});
