import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allt innehåll är personligt och dynamiskt, så Cache Components används inte.
  // Coachens instruktionsfil läses vid körning och måste följa med i funktionerna.
  outputFileTracingIncludes: {
    "/api/coach/*": ["./coach/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
