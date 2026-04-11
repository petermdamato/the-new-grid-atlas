/**
 * Reads public/data.csv (Amazon warehouse list), geocodes addresses with Mapbox,
 * writes public/amazon_warehouses.geojson
 *
 * Usage: node scripts/build_amazon_warehouses_geojson.mjs
 * Env: MAPBOX_SECRET_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const INPUT = path.join(root, "public", "data.csv");
const OUTPUT = path.join(root, "public", "amazon_warehouses.geojson");

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

/** Parse one CSV line with quoted fields (RFC-style). */
function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur);
  return out;
}

function normalizeWarehouseGroup(typeRaw) {
  const t = String(typeRaw ?? "").trim();
  if (!t) return { warehouseGroup: "Other", warehouseTypeRaw: "Unknown" };
  const u = t.toUpperCase();
  if (u === "FC") return { warehouseGroup: "FC", warehouseTypeRaw: t };
  if (u === "DC") return { warehouseGroup: "DC", warehouseTypeRaw: t };
  return { warehouseGroup: "Other", warehouseTypeRaw: t };
}

async function geocode(query, countryParam) {
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
  });
  if (countryParam) params.set("country", countryParam);
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

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error("Missing:", INPUT);
    process.exit(1);
  }

  const text = fs.readFileSync(INPUT, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCSVLine(lines[0] ?? "");
  if (header.length < 4) {
    console.error("Expected header: Location,Code,Type,Address");
    process.exit(1);
  }

  const rows = [];
  const seen = new Set();
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 4) continue;
    const [location, code, type, address] = cols.map((c) => c.trim());
    if (!address) continue;
    const key = `${code}|${address}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ location, code, type, address });
  }

  return rows;
}

const rows = main();

(async () => {
  console.log("Rows to geocode:", rows.length);

  const features = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < rows.length; i++) {
    const { location, code, type, address } = rows[i];
    const query = [address, location].filter(Boolean).join(", ");
    const { warehouseGroup, warehouseTypeRaw } = normalizeWarehouseGroup(type);

    let coords = await geocode(query, "us,ca");
    if (!coords) {
      coords = await geocode(address, "us,ca");
    }
    if (!coords) {
      coords = await geocode(query, "");
    }

    if (!coords) {
      fail++;
      console.warn("Geocode miss:", query.slice(0, 80));
    } else {
      ok++;
      const label = code ? `${code} · Amazon` : "Amazon warehouse";
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: coords },
        properties: {
          kind: "warehouse",
          code: code || "",
          name: label,
          address,
          locationRegion: location || "",
          warehouseGroup,
          warehouseTypeRaw,
          companyName: "Amazon",
        },
      });
    }

    if ((i + 1) % 50 === 0) console.log(`Progress ${i + 1}/${rows.length} ok ${ok} miss ${fail}`);
    await sleep(110);
  }

  const fc = { type: "FeatureCollection", name: "Amazon_warehouses", features };
  fs.writeFileSync(OUTPUT, JSON.stringify(fc));
  console.log("Wrote", OUTPUT, "features:", features.length, "geocode ok:", ok, "miss:", fail);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
