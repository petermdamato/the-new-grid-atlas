import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep huge GeoJSON out of the serverless bundle when deployed (e.g. Vercel).
  // At runtime set BOUNDARIES_BASE_URL to a public R2 (or other HTTPS) base.
  outputFileTracingExcludes: {
    "/app/api/lookup-pws": ["./data/**/*"],
    "/app/api/lookup-electric": ["./data/**/*"],
  },
};

export default nextConfig;
