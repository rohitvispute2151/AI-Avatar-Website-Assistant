import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "SiteGuide",
      fileName: (format) => `site-guide.${format === "es" ? "js" : "umd.cjs"}`,
      formats: ["es", "umd"]
    },
    rollupOptions: {
      output: {
        exports: "named",
      }
    }
  }
});

