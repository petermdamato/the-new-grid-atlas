/**
 * Allowlisted DuckDB tables + columns for NL→SQL (AI map query).
 * Column names are snake_case in DuckDB; GeoJSON `properties` are flattened on load.
 */

export const AI_MAP_QUERY_ALLOWED_TABLES = ["warehouses", "data_centers", "zip_centroids"] as const;

export type AiMapQueryTable = (typeof AI_MAP_QUERY_ALLOWED_TABLES)[number];

/** Human + model-facing schema (keep in sync with load-duckdb flattening). */
export const AI_MAP_QUERY_SCHEMA_DOC = `
Tables (read-only; use these exact names):

## warehouses
One row per warehouse / fulfillment or distribution site (includes Amazon and Walmart from merged GeoJSON).
- kind (VARCHAR) — e.g. "warehouse"
- code (VARCHAR) — facility code, e.g. "BHM1", "WM-IL-JOLIET-FC"
- name (VARCHAR)
- address (VARCHAR)
- location_region (VARCHAR) — US state name
- warehouse_group (VARCHAR) — "FC", "DC", or "Other"
- warehouse_type_raw (VARCHAR)
- company_name (VARCHAR) — e.g. "Amazon", "Walmart"
- next_gen (BOOLEAN) — Walmart next-gen sites when known
- note (VARCHAR) — optional note
- volume (DOUBLE) — optional numeric volume when present
- longitude (DOUBLE), latitude (DOUBLE) — point coordinates in WGS84

## data_centers
One row per data center point.
- id (VARCHAR) — stable id
- name (VARCHAR)
- address (VARCHAR)
- postal (VARCHAR)
- capacity_type (VARCHAR) — e.g. "Hyperscaler", "Colocation", "Enterprise", "Neocloud" (Colocation hits are omitted from the AI map; prefer Hyperscaler, Neocloud, or Enterprise when the user wants pins)
- company_name (VARCHAR)
- longitude (DOUBLE), latitude (DOUBLE) — WGS84

## zip_centroids
US Census 2020 ZCTA internal points (approximate ZIP-area centroids). **Empty until you build** \`data/zcta_centroids.csv\` (see \`data/zcta_centroids.README.md\` and \`npm run build:zcta-centroids\`).
- zip_code (VARCHAR) — 5-digit ZCTA (often treated like ZIP; not identical to every USPS ZIP)
- latitude (DOUBLE), longitude (DOUBLE) — WGS84 internal point

**Important:** \`SELECT\` **only** from \`zip_centroids\` returns **the centroid point**, not nearby data centers. To plot **facilities**, \`JOIN\` \`data_centers\` (or \`warehouses\`) and include **\`dc.latitude AS dc_latitude, dc.longitude AS dc_longitude\`** so the map pins sit on each facility (otherwise only Z lat/lon appear and every row stacks on the ZIP). Also include \`dc.id\` when you want facility links. For joined rows, alias human-readable columns for the map: \`dc.name AS data_center_name\`, \`dc.address AS data_center_address\`, \`dc.company_name AS data_center_company\`.

**Distance:** use the built-in macro \`haversine_km(lat1, lon1, lat2, lon2)\` (great-circle distance in km). Example: join one zip row with \`data_centers\`, \`ORDER BY haversine_km(z.latitude, z.longitude, dc.latitude, dc.longitude) ASC\`, \`LIMIT\` for nearest neighbors.

**Predefined macros:** \`haversine_km\` (above); \`substring_index(str, delim, cnt)\` — MySQL-style string split/join helper when you need multi-part slices; prefer \`split_part\` when you only need one segment.

Rules for generated SQL:
- DuckDB dialect only (embedded WASM). Do not assume MySQL/SQL Server/Postgres-only builtins unless listed below.
- Prefer native DuckDB: \`split_part(col, delim, n)\` for one segment; \`string_split\` + \`list_slice\` + \`array_to_string\` for multi-segment joins; \`coalesce\`, \`strpos\` / \`instr\`.
- \`string_agg(expr, sep)\`: **sep must be a string literal** (e.g. \`', '\`, \`'; '\`, \`' | '\`). Never use a column, parameter, or expression for \`sep\` — DuckDB errors with “Separator argument to StringAgg must be a constant”. For “concatenate with a dynamic delimiter”, aggregate with \`list(expr)\` (optionally \`ORDER BY\`) then \`array_to_string(that_list, literal_sep)\` using a literal delimiter, or avoid aggregation and use row-level \`concat\` / \`concat_ws\` with literals only where required.
- A limited \`substring_index(str, delim, cnt)\` macro exists (MySQL-style positive/negative \`cnt\`) — use only when necessary; native DuckDB is clearer when it fits.
- Single SELECT only — do not use WITH or CTEs.
- Prefer filtering with WHERE; use LIMIT (max 200 in inner query; server adds a hard outer cap).
- Qualify column names; do not use SELECT * unless necessary (prefer named columns).
`.trim();
