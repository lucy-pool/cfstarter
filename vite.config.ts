import path from "path";
import { defineConfig, loadEnv } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
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
      ...(mode === "production" && process.env.DEPLOY_TARGET !== "vps"
        ? [cloudflare({ viteEnvironment: { name: "ssr" } })]
        : []),
      tanstackStart(),
      react(),
    ],
    resolve: {
      alias: [
        { find: "@/convex", replacement: path.resolve(__dirname, "./convex") },
        { find: "@/", replacement: path.resolve(__dirname, "./src") + "/" },
      ],
    },
    ssr: {
      // Bundle ALL dependencies into the SSR build so dist/server/server.js
      // is self-contained and the runtime container doesn't need a populated
      // node_modules. Cloudflare Workers always required this; the VPS
      // (Node) target now uses the same bundle so the Dockerfile runner
      // stage only needs to copy dist/ + server-node.mjs.
      noExternal: true,
    },
  };
});
