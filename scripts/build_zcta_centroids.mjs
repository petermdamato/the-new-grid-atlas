#!/usr/bin/env node
/**
 * Build `data/zcta_centroids.csv` from the U.S. Census 2020 ZCTA gazetteer plain-text file.
 *
 * Download (browser or curl; Census may block automated fetch):
 *   https://www2.census.gov/geo/docs/maps/data_data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip
 * Unzip to obtain `2020_Gaz_zcta_national.txt`, then:
 *
 *   node scripts/build_zcta_centroids.mjs /path/to/2020_Gaz_zcta_national.txt
 *
 * Output: `data/zcta_centroids.csv` with columns zip_code,latitude,longitude
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "data", "zcta_centroids.csv");

const inputPath = process.argv[2];

function normHeader(s) {
  return s.trim().toLowerCase().replace(/^"|"$/g, "");
}

function main() {
  if (!inputPath || !fs.existsSync(inputPath)) {
    console.error("Usage: node scripts/build_zcta_centroids.mjs <path-to-2020_Gaz_zcta_national.txt>");
    console.error("");
    console.error("Get the file from Census (unzip after download):");
    console.error(
      "  https://www2.census.gov/geo/docs/maps/data_data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip"
    );
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    console.error("Input file appears empty.");
    process.exit(1);
  }

  const delim = lines[0].includes("\t") ? "\t" : "|";
  const header = lines[0].split(delim).map(normHeader);

  const idxGeoid = header.findIndex((h) => h === "geoid" || h === "zcta" || h === "zip");
  const idxLat = header.findIndex((h) => h === "intptlat" || h === "latitude");
  const idxLon = header.findIndex((h) => h === "intptlong" || h === "longitude");

  if (idxGeoid < 0 || idxLat < 0 || idxLon < 0) {
    console.error("Could not find GEOID, INTPTLAT, INTPTLONG columns. Header:", header.join(", "));
    process.exit(1);
  }

  const rows = ["zip_code,latitude,longitude"];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim);
    if (cols.length <= Math.max(idxGeoid, idxLat, idxLon)) continue;

    let zip = String(cols[idxGeoid] ?? "").trim().replace(/^"|"$/g, "");
    if (!/^\d{5}$/.test(zip)) continue;

    const latStr = String(cols[idxLat] ?? "").trim().replace(/^\+/, "");
    const lonStr = String(cols[idxLon] ?? "").trim().replace(/^\+/, "");
    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    rows.push(`${zip},${lat},${lon}`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, rows.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length - 1} rows to ${outPath}`);
}

main();
