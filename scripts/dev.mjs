// `npm run dev`: start local services, then the API server and the Vite dev server.
// Stopping either child stops everything.
import { spawn } from "node:child_process";
import { startServices } from "./services.mjs";

const stop = await startServices();

const children = [
  spawn("tsx", ["watch", "--env-file-if-exists=.env", "server/index.ts"], { stdio: "inherit", shell: true }),
  spawn("vite", process.argv.slice(2), { stdio: "inherit", shell: true }),
];

let shuttingDown = false;
async function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill();
  await stop();
  process.exit(code ?? 0);
}

for (const child of children) child.on("exit", shutdown);
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
