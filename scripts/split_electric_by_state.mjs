/**
 * One-time: read public/electric_providers.geojson and write data/electric-boundaries/by-state/{ST}.geojson
 * Run: node scripts/split_electric_by_state.mjs
 * Needs heap for full parse: node --max-old-space-size=8192 scripts/split_electric_by_state.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const srcPath = path.join(root, "public", "electric_providers.geojson");
const outDir = path.join(root, "data", "electric-boundaries", "by-state");

if (!fs.existsSync(srcPath)) {
  console.error("Missing:", srcPath);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

console.log("Reading (large file)…");
const raw = fs.readFileSync(srcPath, "utf8");
const fc = JSON.parse(raw);
if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
  console.error("Invalid FeatureCollection");
  process.exit(1);
}

/** @type {Record<string, unknown[]>} */
const byState = {};

for (const f of fc.features) {
  const st = String(f.properties?.STATE ?? "")
    .trim()
    .toUpperCase();
  if (!st || st === "NOT AVAILABLE" || st.length !== 2) continue;
  if (!byState[st]) byState[st] = [];
  byState[st].push(f);
}

let total = 0;
for (const [st, features] of Object.entries(byState)) {
  const out = {
    type: "FeatureCollection",
    name: `Electric_Retail_Service_Territories_${st}`,
    features,
  };
  fs.writeFileSync(path.join(outDir, `${st}.geojson`), JSON.stringify(out));
  total += features.length;
  console.log(st, features.length);
}

console.log("States:", Object.keys(byState).length, "features written:", total);
