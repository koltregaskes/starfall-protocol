import { defineConfig } from "vite";

export default defineConfig({
  base: "/starfall-protocol/",
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("three")) {
            return "three";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
