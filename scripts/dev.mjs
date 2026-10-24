// `npm run dev`: start local services, then Next.js; stopping Next stops the services.
import { spawn } from "node:child_process";
import { startServices } from "./services.mjs";

const stop = await startServices();
const next = spawn("next", ["dev", ...process.argv.slice(2)], { stdio: "inherit", shell: true });
next.on("exit", async (code) => {
  await stop();
  process.exit(code ?? 0);
});
