// Screenshot routes and compare them with the design PDF pages.
// usage: node scripts/compare.mjs /dashboard:1:dashboard /leads:3:leads [--base http://localhost:3000]
// Writes docs/screenshots/<name>.png (1536×1024), <name>-1440.png (1440×900) and
// docs/screenshots/diff/<name>-side.png (reference | app) + <name>-diff.png (pixelmatch).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

try {
  process.loadEnvFile();
} catch {}

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const base = baseIdx >= 0 ? args.splice(baseIdx, 2)[1] : "http://localhost:3000";
const targets = args.map((a) => {
  const [route, page, name] = a.split(":");
  return { route, page: Number(page), name: name ?? route.replace(/\W+/g, "-").replace(/^-|-$/g, "") };
});
if (targets.length === 0) {
  console.error("usage: node scripts/compare.mjs <route>:<pdfPage>:<name> ...");
  process.exit(1);
}

const outDir = path.resolve("docs/screenshots");
const diffDir = path.join(outDir, "diff");
fs.mkdirSync(diffDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(`${base}/login`);
await page.getByLabel("Email").fill("dhrumil@vertexmediahouse.com");
await page.getByLabel("Password").fill(process.env.SEED_PASSWORD || "vertex123");
await page.getByRole("button", { name: "Log in" }).click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"));

const shot = async (route, file, size) => {
  await page.setViewportSize(size);
  await page.goto(`${base}${route}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // charts finish their first layout
  await page.screenshot({ path: file });
};

for (const t of targets) {
  const appFile = path.join(outDir, `${t.name}.png`);
  await shot(t.route, appFile, { width: 1536, height: 1024 });
  await shot(t.route, path.join(outDir, `${t.name}-1440.png`), { width: 1440, height: 900 });

  const ref = PNG.sync.read(fs.readFileSync(path.resolve(`docs/reference/page-${String(t.page).padStart(2, "0")}.png`)));
  const app = PNG.sync.read(fs.readFileSync(appFile));
  const { width, height } = ref;
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(ref.data, app.data, diff.data, width, height, { threshold: 0.15 });
  fs.writeFileSync(path.join(diffDir, `${t.name}-diff.png`), PNG.sync.write(diff));

  const side = new PNG({ width: width * 2, height });
  PNG.bitblt(ref, side, 0, 0, width, height, 0, 0);
  PNG.bitblt(app, side, 0, 0, width, height, width, 0);
  fs.writeFileSync(path.join(diffDir, `${t.name}-side.png`), PNG.sync.write(side));
  console.log(`${t.name.padEnd(16)} page ${t.page}  ${((mismatched / (width * height)) * 100).toFixed(1)}% pixels differ  → docs/screenshots/diff/${t.name}-side.png`);
}
await browser.close();
