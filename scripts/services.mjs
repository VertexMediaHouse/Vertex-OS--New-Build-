// Local development services: an embedded Postgres described by DATABASE_URL.
// `npm run services` keeps it running until Ctrl+C; scripts/dev.mjs imports startServices().
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { pathToFileURL } from "node:url";

try {
  process.loadEnvFile();
} catch {}

const url = new URL(process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5433/vertex");
const dataDir = path.resolve(".data/pg");
const dbName = url.pathname.slice(1);

async function canConnect() {
  const client = new pg.Client({ connectionString: url.href.replace(url.pathname, "/postgres") });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

export async function startServices() {
  if (await canConnect()) {
    console.log(`Postgres already running on :${url.port}`);
    return async () => {};
  }
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: url.username,
    password: decodeURIComponent(url.password),
    port: Number(url.port),
    persistent: true,
    // Windows defaults to WIN1252, which can't store ₹.
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) await server.initialise();
  await server.start();

  const client = server.getPgClient();
  await client.connect();
  for (const name of [dbName, `${dbName}_test`]) {
    const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (!rowCount) await server.createDatabase(name);
  }
  await client.end();
  console.log(`Postgres ready on :${url.port} (databases: ${dbName}, ${dbName}_test)`);
  return () => server.stop();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stop = await startServices();
  const shutdown = async () => {
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
