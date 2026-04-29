import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, string | false | string[]>),
        "apache-arrow": path.join(process.cwd(), "node_modules/apache-arrow/Arrow.node.js"),
      };
    }
    return config;
  },
  /** `next dev --turbopack`: same apache-arrow resolution as webpack (Node entry, not DOM). */
  turbopack: {
    resolveAlias: {
      "apache-arrow": path.join(process.cwd(), "node_modules/apache-arrow/Arrow.node.js"),
    },
  },
  // Keep huge GeoJSON out of the serverless bundle when deployed (e.g. Vercel).
  // At runtime set BOUNDARIES_BASE_URL to a public R2 (or other HTTPS) base.
  outputFileTracingExcludes: {
    "/app/api/lookup-pws": ["./data/**/*"],
    "/app/api/lookup-electric": ["./data/**/*"],
    // AI route only needs optional zcta_centroids.csv + public GeoJSON; never the full gazetteer.
    "/app/api/ai-map-query": ["./data/2020_Gaz_zcta_national.txt"],
  },
  // DuckDB loads these with fs at runtime — ensure Vercel / Next trace copies them into the function bundle.
  outputFileTracingIncludes: {
    "/app/api/ai-map-query": [
      "./public/amazon_warehouses.geojson",
      "./public/data_centers.geojson",
      "./data/zcta_centroids.csv",
      "./node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
      "./node_modules/@duckdb/duckdb-wasm/dist/duckdb-eh.wasm",
      "./node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-mvp.worker.cjs",
      "./node_modules/@duckdb/duckdb-wasm/dist/duckdb-node-eh.worker.cjs",
    ],
  },
};

export default nextConfig;
