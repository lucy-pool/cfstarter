import path from "path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [tanstackStart(), react()],
  resolve: {
    alias: {
      "@/": path.resolve(__dirname, "./src") + "/",
      "@/convex/": path.resolve(__dirname, "./convex") + "/",
    },
  },
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
});
