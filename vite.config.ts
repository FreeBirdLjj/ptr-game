import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "build",
    rolldownOptions: {
      output: {
        keepNames: true,
      },
    },
  },
});
