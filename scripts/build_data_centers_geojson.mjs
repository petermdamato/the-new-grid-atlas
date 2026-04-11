/**
 * One-time / refresh: reads public/data_centers.json (HAR-like capture),
 * extracts unique facilities from datacentermap.com/api/map/popup responses,
 * geocodes addresses with Mapbox, writes public/data_centers.geojson
 *
 * Usage: node scripts/build_data_centers_geojson.mjs
 * (loads MAPBOX_SECRET_TOKEN from .env if present)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const INPUT = path.join(root, "public", "data_centers.json");
const OUTPUT = path.join(root, "public", "data_centers.geojson");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const k = m[1];
    let v = m[2].replace(/^["']|["']$/g, "").trim();
    if (process.env[k] == null) process.env[k] = v;
  }
}
loadEnvFile();

const token = process.env.MAPBOX_SECRET_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
if (!token) {
  console.error("Set MAPBOX_SECRET_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN");
  process.exit(1);
}

function extractRecords(data) {
  const map = new Map();
  for (const rec of data) {
    if (!rec.url || !rec.url.includes("datacentermap.com/api/map/popup")) continue;
    let obj = null;
    if (rec.body_json) obj = rec.body_json;
    else if (rec.body_text && rec.body_text.trim().startsWith("{")) {
      try {
        obj = JSON.parse(rec.body_text);
      } catch {
        /* skip */
      }
    }
    if (!obj || obj.id == null) continue;
    if (!map.has(obj.id)) map.set(obj.id, obj);
  }
  return [...map.values()];
}

/**
 * Map datacentermap `country` strings to Mapbox Geocoding `country` param (ISO 3166-1 alpha-2).
 * Multiple codes bias search (e.g. PR + US for territories).
 */
function countryToMapboxCodes(countryRaw) {
  const raw = String(countryRaw ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return ["us"];

  if (raw === "usa" || raw === "us" || raw === "united states" || raw === "united states of america") {
    return ["us"];
  }
  if (raw === "canada" || raw === "ca") {
    return ["ca"];
  }
  // Territories: bias with US; PR often works as its own `country` filter on Mapbox
  if (raw === "puerto rico" || raw === "pr") {
    return ["pr", "us"];
  }
  if (
    raw.includes("virgin islands") ||
    raw === "vi" ||
    raw === "usvi" ||
    raw === "u.s. virgin islands"
  ) {
    return ["vi", "us"];
  }
  if (raw === "guam" || raw === "gu") return ["us"];
  if (raw === "american samoa" || raw === "as") return ["us"];
  if (raw === "northern mariana islands" || raw === "northern mariana" || raw === "mp") {
    return ["us"];
  }

  console.warn("Unknown country, geocoding without country filter:", countryRaw);
  return [];
}

function buildQuery(o) {
  const countryLabel = o.country?.trim() || "USA";
  const parts = [o.address, o.city, o.state, o.postal, countryLabel].filter(Boolean);
  return parts.join(", ");
}

async function geocode(query, countryCodes) {
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
  });
  if (countryCodes.length > 0) {
    params.set("country", countryCodes.join(","));
  }
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = await res.json();
  const f = json.features?.[0];
  if (!f?.center) return null;
  return [f.center[0], f.center[1]];
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("Reading", INPUT);
  const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const records = extractRecords(data);
  console.log("Unique facilities:", records.length);

  const features = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < records.length; i++) {
    const o = records[i];
    const query = buildQuery(o);
    const countryCodes = countryToMapboxCodes(o.country);
    let coords = await geocode(query, countryCodes);
    // Retry without country filter if we biased to specific countries and got nothing
    if (!coords && countryCodes.length > 0) {
      coords = await geocode(query, []);
    }
    if (!coords) {
      fail++;
      console.warn("Geocode miss:", query);
    } else {
      ok++;
      const companyName = o.companies?.name ?? "";
      const lineAddress = [o.address, o.city, o.state].filter(Boolean).join(", ");
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          id: o.id,
          name: o.name ?? "",
          address: lineAddress,
          postal: o.postal ?? "",
          capacitytype: o.capacitytype ?? "Unknown",
          companyName,
        },
      });
    }
    if ((i + 1) % 50 === 0) console.log(`Progress ${i + 1}/${records.length} (ok ${ok}, miss ${fail})`);
    await sleep(120); // stay under typical rate limits
  }

  const fc = { type: "FeatureCollection", features };
  fs.writeFileSync(OUTPUT, JSON.stringify(fc));
  console.log("Wrote", OUTPUT, "features:", features.length, "geocode ok:", ok, "miss:", fail);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
