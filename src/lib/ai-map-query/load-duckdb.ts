import fs from "fs";
import path from "path";
import type { Feature, FeatureCollection } from "geojson";
import {
  createDuckDB,
  DuckDBAccessMode,
  NODE_RUNTIME,
  VoidLogger,
  type DuckDBConnection,
} from "@/lib/ai-map-query/duckdb-wasm-node";

type ArrowResultTable = ReturnType<DuckDBConnection["query"]>;

type DuckWasmBindings = Awaited<ReturnType<typeof createDuckDB>>;

function wasmBundles() {
  const wasmDir = path.join(process.cwd(), "node_modules", "@duckdb", "duckdb-wasm", "dist");
  return {
    mvp: {
      mainModule: path.join(wasmDir, "duckdb-mvp.wasm"),
      mainWorker: path.join(wasmDir, "duckdb-node-mvp.worker.cjs"),
    },
    eh: {
      mainModule: path.join(wasmDir, "duckdb-eh.wasm"),
      mainWorker: path.join(wasmDir, "duckdb-node-eh.worker.cjs"),
    },
  };
}

function jsonSerializeValue(v: unknown): unknown {
  if (typeof v === "bigint") {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : v.toString();
  }
  if (v instanceof Uint8Array) return Buffer.from(v).toString("base64");
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(jsonSerializeValue);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) out[k] = jsonSerializeValue(o[k]);
    return out;
  }
  return v;
}

/** Convert an Arrow result table to plain rows for the GeoJSON mapper. */
export function arrowTableToRows(table: ArrowResultTable): Record<string, unknown>[] {
  const raw = table.toArray() as unknown[];
  const rows: Record<string, unknown>[] = [];
  for (const entry of raw) {
    if (entry != null && typeof entry === "object" && !Array.isArray(entry)) {
      rows.push(jsonSerializeValue(entry) as Record<string, unknown>);
    }
  }
  return rows;
}

function flattenWarehouses(fc: FeatureCollection): Record<string, unknown>[] {
  return fc.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const coords =
      f.geometry?.type === "Point" ? (f.geometry.coordinates as [number, number]) : [null, null];
    return {
      kind: p.kind != null ? String(p.kind) : "",
      code: p.code != null ? String(p.code) : "",
      name: p.name != null ? String(p.name) : "",
      address: p.address != null ? String(p.address) : "",
      location_region: p.locationRegion != null ? String(p.locationRegion) : "",
      warehouse_group: p.warehouseGroup != null ? String(p.warehouseGroup) : "",
      warehouse_type_raw: p.warehouseTypeRaw != null ? String(p.warehouseTypeRaw) : "",
      company_name: p.companyName != null ? String(p.companyName) : "",
      next_gen: p.nextGen === true || p.nextGen === "true",
      note: p.note != null ? String(p.note) : null,
      volume:
        typeof p.volume === "number" && Number.isFinite(p.volume)
          ? p.volume
          : p.volume != null && String(p.volume).trim() !== ""
            ? Number(p.volume)
            : null,
      longitude: coords[0] ?? null,
      latitude: coords[1] ?? null,
    };
  });
}

function flattenDataCenters(fc: FeatureCollection): Record<string, unknown>[] {
  return fc.features.map((f) => {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const coords =
      f.geometry?.type === "Point" ? (f.geometry.coordinates as [number, number]) : [null, null];
    return {
      id: p.id != null ? String(p.id) : "",
      name: p.name != null ? String(p.name) : "",
      address: p.address != null ? String(p.address) : "",
      postal: p.postal != null ? String(p.postal) : "",
      capacity_type: p.capacitytype != null ? String(p.capacitytype) : "",
      company_name: p.companyName != null ? String(p.companyName) : "",
      longitude: coords[0] ?? null,
      latitude: coords[1] ?? null,
    };
  });
}

export function runDuckDbAll(conn: DuckDBConnection, sql: string): Promise<Record<string, unknown>[]> {
  return Promise.resolve(arrowTableToRows(conn.query(sql)));
}

export function runDuckDbExec(conn: DuckDBConnection, sql: string): Promise<void> {
  conn.query(sql);
  return Promise.resolve();
}

export type AiMapDuckDbContext = {
  conn: DuckDBConnection;
  bindings: DuckWasmBindings;
  close: () => void;
};

const HAVERSINE_KM_MACRO = `
CREATE OR REPLACE MACRO haversine_km(lat1, lon1, lat2, lon2) AS (
  2 * 6371.0 * asin(sqrt(least(1.0,
    pow(sin(radians((lat2 - lat1) / 2.0)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    pow(sin(radians((lon2 - lon1) / 2.0)), 2)
  )))
)
`.trim();

/**
 * In-memory DuckDB (WASM) with allowlisted tables `warehouses`, `data_centers`, and optional `zip_centroids`
 * (from `data/zcta_centroids.csv` when present), plus a `haversine_km` macro for spherical distance.
 */
export async function createAiMapDuckDbContext(): Promise<AiMapDuckDbContext> {
  const logger = new VoidLogger();
  const bindings = await createDuckDB(wasmBundles(), logger, NODE_RUNTIME);
  await bindings.instantiate();
  bindings.open({
    path: ":memory:",
    accessMode: DuckDBAccessMode.READ_WRITE,
  });
  const conn = bindings.connect();
  await runDuckDbExec(conn, `PRAGMA threads=2`);

  const warehousesPath = path.join(process.cwd(), "public", "amazon_warehouses.geojson");
  const dataCentersPath = path.join(process.cwd(), "public", "data_centers.geojson");

  const wFc = JSON.parse(fs.readFileSync(warehousesPath, "utf8")) as FeatureCollection;
  const dFc = JSON.parse(fs.readFileSync(dataCentersPath, "utf8")) as FeatureCollection;

  const wRows = flattenWarehouses(wFc);
  const dRows = flattenDataCenters(dFc);

  bindings.registerFileText("__ai_map_warehouses.json", JSON.stringify(wRows));
  bindings.registerFileText("__ai_map_data_centers.json", JSON.stringify(dRows));
  conn.insertJSONFromPath("__ai_map_warehouses.json", { schema: "main", name: "warehouses" });
  conn.insertJSONFromPath("__ai_map_data_centers.json", { schema: "main", name: "data_centers" });

  await runDuckDbExec(conn, HAVERSINE_KM_MACRO);

  const zctaCsvPath = path.join(process.cwd(), "data", "zcta_centroids.csv");
  if (fs.existsSync(zctaCsvPath)) {
    const csvText = fs.readFileSync(zctaCsvPath, "utf8");
    bindings.registerFileText("__ai_map_zcta.csv", csvText);
    conn.insertCSVFromPath("__ai_map_zcta.csv", {
      schema: "main",
      name: "__zcta_raw",
      header: true,
    });
    await runDuckDbExec(
      conn,
      `CREATE TABLE zip_centroids AS SELECT
        trim(cast(zip_code AS VARCHAR)) AS zip_code,
        cast(latitude AS DOUBLE) AS latitude,
        cast(longitude AS DOUBLE) AS longitude
      FROM __zcta_raw`
    );
    await runDuckDbExec(conn, `DROP TABLE __zcta_raw`);
  } else {
    await runDuckDbExec(
      conn,
      `CREATE TABLE zip_centroids (
        zip_code VARCHAR,
        latitude DOUBLE,
        longitude DOUBLE
      )`
    );
  }

  const close = () => {
    try {
      conn.close();
    } catch {
      /* ignore */
    }
    try {
      bindings.reset();
    } catch {
      /* ignore */
    }
  };

  return { conn, bindings, close };
}

function looksLikeUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** id → capacitytype from the same GeoJSON DuckDB loads (NL→SQL often omits `capacity_type`). */
let dataCenterCapacityById: Map<string, string> | null = null;

function getDataCenterCapacityById(): Map<string, string> {
  if (dataCenterCapacityById) return dataCenterCapacityById;
  const geoPath = path.join(process.cwd(), "public", "data_centers.geojson");
  const fc = JSON.parse(fs.readFileSync(geoPath, "utf8")) as FeatureCollection;
  const m = new Map<string, string>();
  for (const f of fc.features) {
    const p = (f.properties ?? {}) as Record<string, unknown>;
    const id = p.id != null ? String(p.id).trim() : "";
    if (!id) continue;
    const ct = p.capacitytype != null ? String(p.capacitytype).trim() : "";
    m.set(id, ct);
  }
  dataCenterCapacityById = m;
  return m;
}

function resolveDataCenterCapacityType(row: Record<string, unknown>, idStr: string): string {
  if (row.capacity_type != null && String(row.capacity_type).trim() !== "") {
    return String(row.capacity_type).trim();
  }
  if (row.capacitytype != null && String(row.capacitytype).trim() !== "") {
    return String(row.capacitytype).trim();
  }
  const idCandidates = [
    idStr,
    row.dc_id != null ? String(row.dc_id) : "",
    row.data_center_id != null ? String(row.data_center_id) : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const byId = getDataCenterCapacityById();
  for (const cand of idCandidates) {
    const t = byId.get(cand);
    if (t) return t;
  }
  return "";
}

/**
 * Map rows (with longitude/latitude) to Point features with properties shaped like the main
 * facility layers so popups and facility navigation behave consistently.
 */
export function aiQueryRowsToMapFeatures(rows: Record<string, unknown>[]): Feature[] {
  const features: Feature[] = [];
  for (const row of rows) {
    /** Prefer facility coordinates when the SQL joined zip → DC (see schema: dc_latitude / dc_longitude). */
    const lng = Number(row.dc_longitude ?? row.longitude);
    const lat = Number(row.dc_latitude ?? row.latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    const idStr = row.id != null ? String(row.id) : "";
    const codeStr = row.code != null ? String(row.code) : "";
    const zipStr = row.zip_code != null ? String(row.zip_code).trim() : "";
    const joinedDcHint =
      row.data_center_name != null ||
      row.data_center_address != null ||
      row.data_center_company != null;

    const isZipCentroidOnly =
      zipStr.length === 5 &&
      !joinedDcHint &&
      !idStr &&
      !codeStr &&
      (row.capacity_type == null || String(row.capacity_type) === "") &&
      row.dc_latitude == null &&
      row.dc_longitude == null;

    const isDataCenter =
      !isZipCentroidOnly &&
      ((idStr && looksLikeUuid(idStr)) ||
        (row.capacity_type != null && String(row.capacity_type).length > 0 && idStr.length > 0) ||
        joinedDcHint);

    const props: Record<string, string | number | boolean | null> = {
      aiQueryHit: true,
    };

    if (isZipCentroidOnly) {
      props.kind = "zip-centroid";
      props.zipCode = zipStr;
      props.name = `ZCTA ${zipStr} (centroid)`;
      props.address = "";
      props.companyName = "";
    } else if (isDataCenter) {
      props.kind = "data-center";
      props.id = idStr;
      props.name =
        row.data_center_name != null
          ? String(row.data_center_name)
          : row.name != null
            ? String(row.name)
            : "";
      props.address =
        row.data_center_address != null
          ? String(row.data_center_address)
          : row.address != null
            ? String(row.address)
            : "";
      props.postal = row.postal != null ? String(row.postal) : "";
      props.capacitytype = resolveDataCenterCapacityType(row, idStr);
      props.companyName =
        row.data_center_company != null
          ? String(row.data_center_company)
          : row.company_name != null
            ? String(row.company_name)
            : "";
    } else {
      props.kind = "warehouse";
      props.code = codeStr;
      props.name = row.name != null ? String(row.name) : "";
      props.address = row.address != null ? String(row.address) : "";
      props.companyName = row.company_name != null ? String(row.company_name) : "";
      props.warehouseTypeRaw = row.warehouse_type_raw != null ? String(row.warehouse_type_raw) : "";
      props.warehouseGroup = row.warehouse_group != null ? String(row.warehouse_group) : "";
    }

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties: props,
    });
  }

  return features;
}

/** GeoJSON wrapper for API responses. */
export function aiQueryRowsToFeatureCollection(rows: Record<string, unknown>[]): FeatureCollection {
  return { type: "FeatureCollection", features: aiQueryRowsToMapFeatures(rows) };
}
