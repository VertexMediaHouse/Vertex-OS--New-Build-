// Cloudflare Workers entry point. Node-only concerns (the HTTP listener, cron
// job scheduler) live in index.ts instead — that one's for `npm run start`.
import { app } from "./app";

export default app;
