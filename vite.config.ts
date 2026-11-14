import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "build",
    sourcemap: true,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/excalibur")) return "excalibur";
          return undefined;
        },
      },
    },
  },
});
