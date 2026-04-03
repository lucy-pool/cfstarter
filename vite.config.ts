import path from "path";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
  server: {
    port: 3000,
    proxy: {
      "/api/auth": {
        target: env.VITE_CONVEX_SITE_URL,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tanstackStart({
      spa: { enabled: true },
    }),
    react(),
  ],
  resolve: {
    alias: [
      { find: "@/convex", replacement: path.resolve(__dirname, "./convex") },
      { find: "@/", replacement: path.resolve(__dirname, "./src") + "/" },
    ],
  },
  ssr: {
    noExternal: ["tailwindcss"],
  },
};
});
