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
      src = src.replace(
        /globalThis\['__dirname'\]\s*=\s*path\.dirname\(fileURLToPath\(import\.meta\.url\)\)/,
        "globalThis['__dirname'] = '/'"
      );
      return { contents: src, loader: "ts" };
    });
  },
};

/**
 * Externalise every import whose resolved path starts with one of the given
 * prefixes. esbuild's built-in `external` array supports exact names and the
 * "node:*" glob but NOT arbitrary prefix globs for scoped packages, so we use
 * a resolve plugin for that.
 */
const externalPrefix = (...prefixes) => ({
  name: "external-prefix",
  setup(build) {
    const escaped = prefixes.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`^(${escaped.join("|")})`);
    build.onResolve({ filter: re }, (args) => ({ path: args.path, external: true }));
  },
});

await esbuild.build({
  entryPoints: ["server/worker.ts"],
  bundle: true,
  outfile: "dist-worker/worker.js",
  format: "esm",
  target: "esnext",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "import", "module"],
  plugins: [
    shimDirname,
    // @react-pdf/* and pdfkit (+ transitive deps: fontkit, linebreak, unicode-*)
    // are Node-only and cannot run in a Cloudflare Worker. Marking them external
    // here prevents Cloudflare's validator from rejecting the bundle with
    // error 10021 ("Invalid URL string" from pdfkit/lib/mixins/pdfa.js).
    externalPrefix("@react-pdf/", "pdfkit", "fontkit", "linebreak", "unicode-"),
  ],
  // Node built-ins: cover both "node:fs" (modern) and bare "fs" (legacy) forms.
  // Cloudflare Workers exposes these via the nodejs_compat compatibility flag.
  external: [
    "node:*",
    // Bare built-in names used by pg, pgpass, split2, etc.
    "fs", "path", "url", "util", "util/types", "net", "tls", "dns",
    "stream", "stream/promises", "buffer", "crypto", "os", "http", "https",
    "events", "assert", "string_decoder", "zlib", "child_process", "worker_threads",
    "perf_hooks", "async_hooks", "readline",
    // pg native binding — optional, never present in Workers
    "pg-native",
  ],
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
});
