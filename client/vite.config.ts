/// <reference types="vitest" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Upload source maps to Sentry in production builds only
    process.env.NODE_ENV === 'production' && sentryVitePlugin({
      org: process.env.VITE_SENTRY_ORG,
      project: process.env.VITE_SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        assets: "./dist/assets/**/*",
        ignore: ["node_modules/**"],
      },
      release: {
        name: `client-${Date.now()}`,
        setCommits: {
          auto: true,
        },
      },
    }),
  ].filter(Boolean),
  server: {
    port: 5174, // Changed from default 5173 to avoid conflicts
    host: '0.0.0.0', // Allow access from Windows via WSL IP
  },
  build: {
    sourcemap: true, // Generate source maps for production
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
