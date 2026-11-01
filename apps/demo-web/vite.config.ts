import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ai-avatar/widget": resolve(__dirname, "../widget/src/index.ts"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});

