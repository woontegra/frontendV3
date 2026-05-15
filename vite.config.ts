import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@/utils", replacement: path.resolve(__dirname, "src/shared/utils") },
      { find: "@/lib", replacement: path.resolve(__dirname, "src/lib") },
      { find: "@/context", replacement: path.resolve(__dirname, "src/context") },
      { find: "@/core", replacement: path.resolve(__dirname, "src/core") },
      { find: "@/config", replacement: path.resolve(__dirname, "src/shared/config") },
      { find: "@/hooks", replacement: path.resolve(__dirname, "src/hooks") },
      { find: "@modules/fazla-mesai", replacement: path.resolve(__dirname, "src/modules") },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
