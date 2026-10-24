import type { Page } from "@playwright/test";

export const OWNER = { email: "dhrumil@vertexmediahouse.com", password: process.env.SEED_PASSWORD ?? "vertex123" };

export async function login(page: Page, user = OWNER, next = "/dashboard") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => url.pathname === next);
}
