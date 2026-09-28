import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Mirrors the `@/*` -> `./src/*` path alias in tsconfig.json.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // The API is a separate origin (and a separate repo). Requests go straight
    // to it via VITE_API_URL rather than through a dev proxy, so local
    // development exercises the same CORS path production does.
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
