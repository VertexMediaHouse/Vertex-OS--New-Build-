import { expect, test } from "@playwright/test";
import { login } from "./helpers";

// Hardik is the MEMBER of the three: no leads, no invoices, and only his own projects.
const HARDIK = { email: "hardik@vertexmediahouse.com", password: process.env.SEED_PASSWORD ?? "vertex123" };
// Seeded with no project members at all, so no member is on it.
const NOT_HERS = "project_urban_longform";

test("a member is kept out of leads and of projects they're not on", async ({ page }) => {
  test.setTimeout(120_000); // the dev server is slow when the suite runs in parallel
  await login(page, HARDIK, "/dashboard");

  // Role gate: the whole module, not just the menu item.
  await page.goto("/leads");
  await expect(page.getByText("You don't have access to leads.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leads", exact: true })).toHaveCount(0);

  // Record gate: the list hides it, and so must the detail panel beside it.
  await page.goto(`/projects?id=${NOT_HERS}`);
  // The dev server streams this page slowly when the suite runs in parallel.
  await expect(page.getByRole("heading", { name: /Client Projects|Projects \(VTH\)/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("YouTube Long-form")).toHaveCount(0);

  // Money stays hidden on the dashboard too, since members can't see invoices.
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
  await expect(page.getByText("Total Revenue")).toHaveCount(0);
});
