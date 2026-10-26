import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    // lib/clock.ts reads this on both sides to pin "today".
    define: { "process.env.SEED_TODAY": JSON.stringify(env.SEED_TODAY ?? "") },
    server: { port: 5173 },
  };
});
