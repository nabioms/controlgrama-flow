import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // The APK needs a static HTML shell, while the normal web build keeps SSR.
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 2,
      },
    },
    server: { entry: "server" },
  },
});
