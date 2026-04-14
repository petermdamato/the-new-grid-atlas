/**
 * Appends Walmart warehouse points from public/new_walmart_data.csv into
 * public/amazon_warehouses.geojson (geocodes each row with Mapbox).
 *
 * CSV: State,City,Address,Note,nextGen,Type,volume
 *  - Type Distribution -> warehouseGroup DC
 *  - Type Fulfillment -> warehouseGroup FC
 *  - companyName "Walmart", nextGen/note/volume from CSV
 *  - volume "50M+ units" -> 50000000
 *
 * Usage: node scripts/merge_walmart_into_amazon_geojson.mjs
 * Env: MAPBOX_SECRET_TOKEN or NEXT_PUBLIC_MAPBOX_TOKEN
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const GEOJSON_PATH = path.join(root, "public", "amazon_warehouses.geojson");
const WALMART_CSV = path.join(root, "public", "new_walmart_data.csv");

const US_STATE_ABBR = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

const CA_PROVINCE_ABBR = {
  Alberta: "AB",
  "British Columbia": "BC",
  Manitoba: "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  Nunavut: "NU",
  Ontario: "ON",
  "Prince Edward Island": "PE",
  Quebec: "QC",
  Saskatchewan: "SK",
  Yukon: "YT",
};

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

function stateToAbbr(stateName) {
  const s = String(stateName ?? "").trim();
  if (US_STATE_ABBR[s]) return { abbr: US_STATE_ABBR[s], country: "US" };
  if (CA_PROVINCE_ABBR[s]) return { abbr: CA_PROVINCE_ABBR[s], country: "CA" };
  return null;
}

function typeToWarehouseGroup(typeRaw) {
  const t = String(typeRaw ?? "").trim().toLowerCase();
  if (t === "distribution") return { warehouseGroup: "DC", warehouseTypeRaw: "DC" };
  if (t === "fulfillment") return { warehouseGroup: "FC", warehouseTypeRaw: "FC" };
  return { warehouseGroup: "Other", warehouseTypeRaw: String(typeRaw ?? "").trim() || "Unknown" };
}

/** "50M+ units" / "100M+ units" -> integer cubic-units style count */
function parseVolume(volRaw) {
  const v = String(volRaw ?? "").trim();
  if (!v) return null;
  const m = v.match(/^(\d+)\s*M\+\s*units\s*$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  return n * 1_000_000;
}

function buildGeocodeQuery({ stateName, city, address, country, abbr }) {
  const addr = String(address ?? "").trim();
  const c = String(city ?? "").trim();

  if (country === "CA") {
    return `${addr}, ${abbr}, Canada`;
  }

  // US: full address ends with ", ST 12345" (comma before state avoids matching street "… Dr 12095")
  if (/,\s+[A-Z]{2}\s+\d{5}\s*$/i.test(addr)) {
    return `${addr.replace(/\s+$/, "")}, USA`;
  }

  const zipM = addr.match(/\b(\d{5})\s*$/);
  if (zipM) {
    const street = addr.slice(0, addr.lastIndexOf(zipM[1])).replace(/[\s,]+$/g, "").trim();
    return `${street}, ${c}, ${abbr} ${zipM[1]}, USA`;
  }

  return `${addr}, ${c}, ${abbr}, USA`;
}

async function geocode(query) {
  const params = new URLSearchParams({
    access_token: token,
    limit: "1",
    country: "us,ca",
  });
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

function extractPostalUs(addr) {
  const m = String(addr).match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1] ?? "";
}

function main() {
  const text = fs.readFileSync(WALMART_CSV, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCSVLine(lines[0] ?? "");
  if (!header[0]?.toLowerCase().includes("state") || !header[1]?.toLowerCase().includes("city")) {
    console.warn("Unexpected CSV header, continuing:", header);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 6) continue;
    const [stateName, city, address, note, nextGen, type, volume = ""] = cols;
    rows.push({
      stateName: stateName.trim(),
      city: city.trim(),
      address: address.trim(),
      note: note.trim(),
      nextGen: String(nextGen).trim().toUpperCase() === "TRUE",
      type: type.trim(),
      volume: volume.trim(),
    });
  }
  return rows;
}

const walmartRows = main();

(async () => {
  const fc = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf8"));
  if (fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    console.error("Invalid geojson");
    process.exit(1);
  }

  fc.features = fc.features.filter((f) => String(f.properties?.companyName ?? "") !== "Walmart");

  const existingCodes = new Set(
    fc.features.map((f) => String(f.properties?.code ?? "")).filter(Boolean)
  );

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < walmartRows.length; i++) {
    const row = walmartRows[i];
    const st = stateToAbbr(row.stateName);
    if (!st) {
      console.warn("Unknown state/province:", row.stateName);
      fail++;
      continue;
    }

    const query = buildGeocodeQuery({
      stateName: row.stateName,
      city: row.city,
      address: row.address,
      country: st.country,
      abbr: st.abbr,
    });

    let coords = await geocode(query);
    if (!coords && st.country === "US") {
      coords = await geocode(`${row.address}, ${row.city}, USA`);
    }

    if (!coords) {
      fail++;
      console.warn("Geocode miss:", query.slice(0, 100));
      await sleep(110);
      continue;
    }

    const { warehouseGroup, warehouseTypeRaw } = typeToWarehouseGroup(row.type);
    const vol = parseVolume(row.volume);

    let code = `WM-${st.abbr}-${row.city.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}-${warehouseGroup}`
      .toUpperCase()
      .slice(0, 32);
    let suffix = 0;
    while (existingCodes.has(code)) {
      suffix++;
      code = `${code.slice(0, 28)}-${suffix}`;
    }
    existingCodes.add(code);

    const displayAddress =
      st.country === "CA"
        ? `${row.address}, ${st.abbr}, Canada`
        : /,\s+[A-Z]{2}\s+\d{5}\s*$/i.test(row.address)
          ? row.address
          : `${row.address.replace(/\s*\d{5}\s*$/, "").replace(/[\s,]+$/g, "")}, ${row.city}, ${st.abbr} ${extractPostalUs(row.address)}, United States`;

    const props = {
      kind: "warehouse",
      code,
      name: `${code} · Walmart`,
      address: displayAddress,
      locationRegion: row.stateName,
      warehouseGroup,
      warehouseTypeRaw,
      companyName: "Walmart",
      nextGen: row.nextGen,
    };
    if (row.note) props.note = row.note;
    if (vol != null) props.volume = vol;

    fc.features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: coords },
      properties: props,
    });
    ok++;
    console.log("OK", code, query.slice(0, 70));
    await sleep(110);
  }

  fs.writeFileSync(GEOJSON_PATH, JSON.stringify(fc));
  console.log("Wrote", GEOJSON_PATH, "added Walmart:", ok, "failed:", fail, "total features:", fc.features.length);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
