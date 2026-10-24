import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("logged-out visitors are sent to login and come back after", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await login(page);
  await expect(page.getByRole("heading", { name: /Welcome back, Dhrumil/ })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("dhrumil@vertexmediahouse.com");
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("?company= switches scope and the cookie keeps it", async ({ page }) => {
  await login(page);
  await expect(page.getByTestId("scope")).toContainText("Scope ALL · companies vmh, vth · 32 leads");

  await page.goto("/dashboard?company=vmh");
  await expect(page.getByTestId("scope")).toContainText("Scope VMH · companies vmh · 18 leads");

  await page.goto("/dashboard"); // no param: cookie remembers VMH
  await expect(page.getByTestId("scope")).toContainText("Scope VMH");

  await page.goto("/dashboard?company=vth");
  await expect(page.getByTestId("scope")).toContainText("Scope VTH · companies vth · 14 leads");

  await page.goto("/dashboard?company=all");
  await expect(page.getByTestId("scope")).toContainText("Scope ALL");
});
