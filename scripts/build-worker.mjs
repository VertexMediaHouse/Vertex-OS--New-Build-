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
  // Node built-ins: cover both "node:fs" (modern) and bare "fs" (legacy) forms.
  // Cloudflare Workers exposes these via the nodejs_compat compatibility flag.
  external: [
    "node:*",
    // Bare built-in names used by pg, pgpass, split2, etc.
    "fs", "path", "url", "util", "util/types", "net", "tls", "dns",
    "stream", "stream/promises", "buffer", "crypto", "os", "http", "https",
    "events", "assert", "string_decoder", "zlib", "child_process", "worker_threads",
    "perf_hooks", "async_hooks", "readline",
    // pg native binding (optional, never present in Workers)
    "pg-native",
    // @react-pdf is a Node-only server utility; it must not be bundled into the Worker.
    "@react-pdf/renderer", "@react-pdf/image",
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
});
