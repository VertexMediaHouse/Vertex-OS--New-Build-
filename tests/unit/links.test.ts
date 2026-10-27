import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = [
  "/",
  "/dashboard",
  "/activity",
  "/calendar",
  "/notifications",
  "/leads",
  "/clients",
  "/clients/:id",
  "/projects",
  "/tasks",
  "/time",
  "/invoices",
  "/invoices/new",
  "/campaigns",
  "/campaigns/new",
  "/content",
  "/goals",
  "/team",
  "/team/:id",
  "/files",
  "/reports",
  "/settings",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/portal",
  "/api/invoices/:id/pdf",
  "/api/files/:id/download",
];

function resolves(path: string) {
  return routes.some((r) => {
    const rp = r.split("/").filter(Boolean);
    const pp = path.split("/").filter(Boolean);
    if (rp.some((s) => s.startsWith(":"))) {
      return rp.length === pp.length && rp.every((seg, i) => seg.startsWith(":") || seg === pp[i]);
    }
    return rp.length === pp.length && rp.every((seg, i) => seg === pp[i]);
  });
}

describe("internal links", () => {
  it("every href points at a page or route handler", () => {
    const files = execSync('git ls-files "web/**/*.tsx" "components/**/*.tsx"', { encoding: "utf8" })
      .trim()
      .split("\n")
      .filter(Boolean);
    const broken: string[] = [];
    for (const f of files) {
      if (f.includes("/dev/")) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/href=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
        const href = m[1] ?? m[2]!;
        if (!href.startsWith("/") || href.startsWith("//")) continue;
        const path = href.split("?")[0]!.split("#")[0]!.replace(/\$\{[^}]*\}/g, "x");
        if (!resolves(path)) broken.push(`${f}: ${href}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
