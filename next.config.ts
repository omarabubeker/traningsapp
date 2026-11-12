import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sidor du nyss besökt visas direkt i 60 s när du byter flik. Allt som ändrar data (och
  // synken från klockan) anropar router.refresh(), som tömmer cachen, så du ser aldrig
  // gammal data efter en ändring.
  experimental: {
    staleTimes: { dynamic: 60 },
  },
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
