import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const eslintConfig = defineConfig([
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  reactRefresh.configs.vite,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // `try { process.loadEnvFile() } catch {}` is this codebase's idiom for "missing .env is fine".
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Shared component files routinely export a cva() variants helper next to the
  // component (the shadcn/ui convention) — fine for fast refresh's purposes, since
  // these aren't route components that get hot-swapped while held open.
  { files: ["components/**"], rules: { "react-refresh/only-export-components": "off" } },
  globalIgnores(["dist/**", ".wrangler/**"]),
]);

export default eslintConfig;
