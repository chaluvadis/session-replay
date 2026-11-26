import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/session-replay/",
  plugins: [react()],
  resolve: {
    alias: {
      "@dumb-pipe/types": new URL("../types/src/index.ts", import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  build: {
    outDir: "dist",
  },
});
