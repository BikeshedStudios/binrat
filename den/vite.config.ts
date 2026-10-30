import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 4096,
  },
  server: {
    port: 5178,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4178",
    },
  },
});
