import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Every href the app renders must land on a real page or route handler: a typo here is a
// 404 the type checker cannot see.
const routes = execSync('git ls-files "app/**/page.tsx" "app/**/route.ts"', { encoding: "utf8" })
  .trim()
  .split("\n")
  .map((f) => "/" + f.replace(/^app\//, "").replace(/\/(page\.tsx|route\.ts)$/, "").replace(/\(.*?\)\/?/g, "").replace(/\/$/, ""));

function resolves(path: string) {
  return routes.some((r) => {
    const rp = r.split("/").filter(Boolean);
    const pp = path.split("/").filter(Boolean);
    if (rp.some((s) => s.startsWith("[..."))) return pp.length >= rp.length - 1;
    return rp.length === pp.length && rp.every((seg, i) => seg.startsWith("[") || seg === pp[i]);
  });
}

describe("internal links", () => {
  it("every href points at a page or route handler", () => {
    const files = execSync('git ls-files "app/*.tsx" "components/*.tsx"', { encoding: "utf8" }).trim().split("\n");
    const broken: string[] = [];
    for (const f of files) {
      if (f.includes("/dev/")) continue; // the component showcase links nowhere on purpose
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
