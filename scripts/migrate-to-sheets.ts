import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncTableToSheet } from "../lib/sheets/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MOCK_DATA_DIR = path.resolve(__dirname, "../lib/db/mock-data");

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function migrateAll() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("      VERTEX-OS: MOCK DATA -> GOOGLE SHEETS MIGRATION          ");
  console.log("═══════════════════════════════════════════════════════════════");

  const url = process.env.GOOGLE_SHEET_WEBAPP_URL;
  if (!url) {
    console.error("ERROR: GOOGLE_SHEET_WEBAPP_URL is not set in environment or .env file.");
    process.exit(1);
  }

  console.log(`Connecting to Google Sheet Web App:\n${url}\n`);

  const files = fs.readdirSync(MOCK_DATA_DIR).filter((f) => f.endsWith(".json"));
  console.log(`Found ${files.length} tables to migrate from ${MOCK_DATA_DIR}\n`);

  let totalRows = 0;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const table = file.replace(".json", "");
    const filePath = path.join(MOCK_DATA_DIR, file);

    let rows: any[] = [];
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      rows = JSON.parse(raw);
    } catch (e) {
      console.error(`Failed to read/parse ${file}:`, e);
      failCount++;
      continue;
    }

    if (!Array.isArray(rows)) {
      console.warn(`[${i + 1}/${files.length}] Skipping ${table} (not an array)`);
      continue;
    }

    process.stdout.write(`[${i + 1}/${files.length}] Migrating '${table}' (${rows.length} rows)... `);

    // If rows are empty, give it a placeholder column so the tab can be initialized
    const payloadRows = rows.length > 0 ? rows : [{ id: "", _placeholder: true }];

    const ok = await syncTableToSheet(table, payloadRows);
    if (ok) {
      console.log("✓ Done");
      totalRows += rows.length;
      successCount++;
    } else {
      console.log("✗ FAILED");
      failCount++;
    }

    // Gentle pacing to respect Google Apps Script rate
    await sleep(400);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Migration Complete:`);
  console.log(`  - Successfully synced: ${successCount} tables`);
  console.log(`  - Failed: ${failCount} tables`);
  console.log(`  - Total records uploaded: ${totalRows}`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

migrateAll().catch((err) => {
  console.error("Fatal error during migration:", err);
  process.exit(1);
});
