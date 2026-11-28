import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "build",
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "excalibur", test: /node_modules[\\/]excalibur/ }],
        },
      },
    },
  },
});
