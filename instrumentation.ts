export async function register() {
  // Jobs need Node and a database; skip during `next build` and on the edge.
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build" || process.env.DISABLE_JOBS) return;
  const { startJobs } = await import("./lib/jobs");
  startJobs().catch((e) => console.error("[jobs] failed to start", e));
}
