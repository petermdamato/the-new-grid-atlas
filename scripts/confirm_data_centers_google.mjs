/**
 * Reads public/data_centers.json (same HAR-like shape as build_data_centers_geojson.mjs),
 * dedupes facilities by body_json.id, then for each record searches Google via the
 * Custom Search JSON API for: address + city + state + "data center".
 *
 * Picks the best-scoring result that looks like a news article or press release.
 * Writes CSV with a `confirmation` column: URL or the literal `followup`.
 *
 * Setup (Google Cloud / Programmable Search Engine):
 * 1. Enable "Custom Search API" for a project; create an API key.
 * 2. Create a Programmable Search Engine (programmablesearchengine.google.com),
 *    enable "Search the entire web".
 * 3. Env:
 *    GOOGLE_CUSTOM_SEARCH_API_KEY  (or GOOGLE_API_KEY)
 *    GOOGLE_CUSTOM_SEARCH_ENGINE_ID (the `cx` value, or GOOGLE_CX)
 *
 * Usage:
 *   node scripts/confirm_data_centers_google.mjs
 *   node scripts/confirm_data_centers_google.mjs --limit 20
 *   node scripts/confirm_data_centers_google.mjs --resume
 *   NODE_OPTIONS=--max-old-space-size=8192 node scripts/confirm_data_centers_google.mjs
 *
 * Free tier is typically 100 queries/day — use --resume across days.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const INPUT = path.join(root, "public", "data_centers.json");
const DEFAULT_OUT = path.join(root, "public", "data_centers_confirmations.csv");

/** Minimum score (0–100) to accept a link; below this → followup */
const MIN_SCORE = 68;

const DOMAIN_RULES = [
  { re: /(^|\.)reuters\.com$/i, score: 100 },
  { re: /(^|\.)apnews\.com$/i, score: 100 },
  { re: /(^|\.)bloomberg\.com$/i, score: 98 },
  { re: /(^|\.)wsj\.com$/i, score: 98 },
  { re: /(^|\.)nytimes\.com$/i, score: 96 },
  { re: /(^|\.)washingtonpost\.com$/i, score: 94 },
  { re: /(^|\.)theverge\.com$/i, score: 90 },
  { re: /(^|\.)techcrunch\.com$/i, score: 90 },
  { re: /(^|\.)arstechnica\.com$/i, score: 88 },
  { re: /(^|\.)axios\.com$/i, score: 90 },
  { re: /(^|\.)cnbc\.com$/i, score: 88 },
  { re: /(^|\.)forbes\.com$/i, score: 82 },
  { re: /(^|\.)datacenterdynamics\.com$/i, score: 95 },
  { re: /(^|\.)datacenterknowledge\.com$/i, score: 93 },
  { re: /(^|\.)capacitymedia\.com$/i, score: 88 },
  { re: /(^|\.)bizjournals\.com$/i, score: 80 },
  { re: /(^|\.)prnewswire\.com$/i, score: 92 },
  { re: /(^|\.)businesswire\.com$/i, score: 92 },
  { re: /(^|\.)globenewswire\.com$/i, score: 90 },
  { re: /\.gov$/i, score: 88 },
  { re: /\.edu$/i, score: 82 },
  { re: /(journal|tribune|herald|gazette|newstimes|daily|times|press|broadcast|nbc|abc|cbs|fox)\./i, score: 72 },
];

const BLOCKED_URL = new RegExp(
  [
    "linkedin\\.com",
    "facebook\\.com",
    "twitter\\.com",
    "x\\.com",
    "instagram\\.com",
    "pinterest\\.com",
    "reddit\\.com",
    "tiktok\\.com",
    "youtube\\.com",
    "youtu\\.be",
    "wikipedia\\.org",
    "datacentermap\\.com",
    "maps\\.google",
    "google\\.com/maps",
    "yelp\\.com",
    "yellowpages",
    "indeed\\.com",
    "glassdoor",
  ].join("|"),
  "i"
);

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

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadProcessedIds(csvPath) {
  const ids = new Set();
  if (!fs.existsSync(csvPath)) return ids;
  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return ids;
  const header = parseCsvLine(lines[0]);
  const idIdx = header.indexOf("id");
  if (idIdx < 0) return ids;
  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li]);
    if (cols[idIdx] != null && cols[idIdx] !== "") ids.add(String(cols[idIdx]).trim());
  }
  return ids;
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function scoreResult(link, title, snippet) {
  if (!link || BLOCKED_URL.test(link)) return -1;
  const host = hostnameFromUrl(link);
  if (!host) return -1;
  let best = 0;
  for (const { re, score } of DOMAIN_RULES) {
    if (re.test(host)) best = Math.max(best, score);
  }
  const blob = `${title} ${snippet}`.toLowerCase();
  if (best < 75 && /press release|announces|announcement|opens data center|new data center/i.test(blob)) {
    best = Math.max(best, 70);
  }
  return best;
}

function buildSearchQuery(o) {
  const parts = [
    o.address,
    o.city,
    o.state,
    "data center",
  ]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
  return parts.join(" ");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function googleSearch(query, apiKey, cx) {
  const params = new URLSearchParams({
    key: apiKey,
    cx,
    q: query,
    num: "10",
  });
  const url = `https://www.googleapis.com/customsearch/v1?${params}`;
  const res = await fetch(url);
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error?.message || res.statusText;
    throw new Error(`Google Custom Search ${res.status}: ${err}`);
  }
  return json.items ?? [];
}

function pickBestItem(items) {
  let best = null;
  let bestScore = -1;
  for (const it of items) {
    const link = it.link;
    const s = scoreResult(link, it.title ?? "", it.snippet ?? "");
    if (s > bestScore) {
      bestScore = s;
      best = it;
    }
  }
  if (bestScore < MIN_SCORE) return { confirmation: "followup", score: bestScore, item: null };
  return { confirmation: best.link, score: bestScore, item: best };
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let outPath = DEFAULT_OUT;
  let limit = Infinity;
  let resume = false;
  let delayMs = 1100;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out" && argv[i + 1]) {
      outPath = path.resolve(argv[++i]);
    } else if (argv[i] === "--limit" && argv[i + 1]) {
      limit = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (argv[i] === "--resume") {
      resume = true;
    } else if (argv[i] === "--delay-ms" && argv[i + 1]) {
      delayMs = Math.max(0, parseInt(argv[++i], 10) || 0);
    }
  }
  return { outPath, limit, resume, delayMs };
}

const HEADER =
  "id,name,company,address,city,state,country,search_query,confirmation,source_title,score";

async function main() {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID || process.env.GOOGLE_CX;
  if (!apiKey || !cx) {
    console.error(
      "Set GOOGLE_CUSTOM_SEARCH_API_KEY (or GOOGLE_API_KEY) and GOOGLE_CUSTOM_SEARCH_ENGINE_ID (or GOOGLE_CX)."
    );
    process.exit(1);
  }

  const { outPath, limit, resume, delayMs } = parseArgs();

  console.log("Reading", INPUT);
  const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));
  let records = extractRecords(data);
  console.log("Unique facilities:", records.length);

  const processed = resume ? loadProcessedIds(outPath) : new Set();
  if (processed.size) console.log("Resume: skipping", processed.size, "ids already in", outPath);

  if (!resume) {
    fs.writeFileSync(outPath, `${HEADER}\n`);
  } else if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) {
    fs.writeFileSync(outPath, `${HEADER}\n`);
  }

  let done = 0;
  let errors = 0;

  for (const o of records) {
    if (done >= limit) break;
    const idStr = String(o.id);
    if (processed.has(idStr)) continue;

    const company = o.companies?.name ?? "";
    const address = String(o.address ?? "").trim();
    const city = String(o.city ?? "").trim();
    const state = String(o.state ?? "").trim();
    const country = String(o.country ?? "").trim();
    const name = String(o.name ?? "").trim();

    let confirmation = "followup";
    let sourceTitle = "";
    let scoreOut = "";
    const query = buildSearchQuery(o);

    if (!query.replace(/\s+data center$/i, "").trim()) {
      confirmation = "followup";
    } else {
      try {
        const items = await googleSearch(query, apiKey, cx);
        const picked = pickBestItem(items);
        confirmation = picked.confirmation;
        scoreOut = picked.score >= 0 ? String(picked.score) : "";
        if (picked.item) sourceTitle = picked.item.title ?? "";
      } catch (e) {
        console.error("Search failed for id", idStr, e.message);
        errors++;
        confirmation = "followup";
      }
    }

    const row = [
      csvEscape(idStr),
      csvEscape(name),
      csvEscape(company),
      csvEscape(address),
      csvEscape(city),
      csvEscape(state),
      csvEscape(country),
      csvEscape(query),
      csvEscape(confirmation),
      csvEscape(sourceTitle),
      csvEscape(scoreOut),
    ].join(",");

    fs.appendFileSync(outPath, row + "\n");
    processed.add(idStr);
    done++;
    if (done % 10 === 0) console.log("Wrote", done, "rows this run →", outPath);
    if (delayMs > 0) await sleep(delayMs);
  }

  console.log("Done. Rows written this run:", done, "errors:", errors, "output:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
