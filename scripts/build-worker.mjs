// scripts/build-worker.mjs
// Bundles server/worker.ts for Cloudflare Workers, shimming out the
// Node-only `fileURLToPath(import.meta.url)` the Prisma codegen emits.
import * as esbuild from "esbuild";

/** Replace the `__dirname = … fileURLToPath(import.meta.url)` line Prisma generates. */
const shimDirname = {
  name: "shim-dirname",
  setup(build) {
    build.onLoad({ filter: /generated[\\/]client\.ts$/ }, async (args) => {
      const fs = await import("node:fs");
      let src = fs.readFileSync(args.path, "utf8");
      // Replace the problematic line with a safe fallback
      src = src.replace(
        /globalThis\['__dirname'\]\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/,
        "globalThis['__dirname'] = '/'"
      );
      return { contents: src, loader: "ts" };
    });
  },
};

await esbuild.build({
  entryPoints: ["server/worker.ts"],
  bundle: true,
  outfile: "dist/worker.js",
  format: "esm",
  target: "esnext",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "import", "module"],
  plugins: [shimDirname],
  // Node built-ins that Workers provides via nodejs_compat
  external: ["node:*", "pg-native"],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
});
