import duckdb from "duckdb";
import fs from "fs";
import os from "os";
import path from "path";
import type { Feature, FeatureCollection } from "geojson";

function sqlStringLiteral(p: string): string {
  return `'${p.replace(/'/g, "''")}'`;
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

export function runDuckDbAll(conn: duckdb.Connection, sql: string): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err: Error | null, rows: unknown) => {
      if (err) reject(err);
      else resolve((rows as Record<string, unknown>[]) ?? []);
    });
  });
}

export function runDuckDbExec(conn: duckdb.Connection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: Error | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export type AiMapDuckDbContext = {
  conn: duckdb.Connection;
  db: duckdb.Database;
  tmpPaths: string[];
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
 * In-memory DuckDB with allowlisted tables `warehouses`, `data_centers`, and optional `zip_centroids`
 * (from `data/zcta_centroids.csv` when present), plus a `haversine_km` macro for spherical distance.
 */
export async function createAiMapDuckDbContext(): Promise<AiMapDuckDbContext> {
  const db = new duckdb.Database(":memory:");
  const conn = db.connect();
  const tmpPaths: string[] = [];

  const warehousesPath = path.join(process.cwd(), "public", "amazon_warehouses.geojson");
  const dataCentersPath = path.join(process.cwd(), "public", "data_centers.geojson");

  const wFc = JSON.parse(fs.readFileSync(warehousesPath, "utf8")) as FeatureCollection;
  const dFc = JSON.parse(fs.readFileSync(dataCentersPath, "utf8")) as FeatureCollection;

  const wRows = flattenWarehouses(wFc);
  const dRows = flattenDataCenters(dFc);

  const stamp = `${process.pid}-${Date.now()}`;
  const tmpW = path.join(os.tmpdir(), `ai-map-w-${stamp}.json`);
  const tmpD = path.join(os.tmpdir(), `ai-map-d-${stamp}.json`);
  tmpPaths.push(tmpW, tmpD);

  fs.writeFileSync(tmpW, JSON.stringify(wRows), "utf8");
  fs.writeFileSync(tmpD, JSON.stringify(dRows), "utf8");

  const wPathSql = sqlStringLiteral(tmpW.replace(/\\/g, "/"));
  const dPathSql = sqlStringLiteral(tmpD.replace(/\\/g, "/"));

  await runDuckDbExec(conn, `PRAGMA threads=2`);
  await runDuckDbExec(
    conn,
    `CREATE TABLE warehouses AS SELECT * FROM read_json_auto(${wPathSql})`
  );
  await runDuckDbExec(
    conn,
    `CREATE TABLE data_centers AS SELECT * FROM read_json_auto(${dPathSql})`
  );

  await runDuckDbExec(conn, HAVERSINE_KM_MACRO);

  const zctaCsvPath = path.join(process.cwd(), "data", "zcta_centroids.csv");
  if (fs.existsSync(zctaCsvPath)) {
    const zPathSql = sqlStringLiteral(zctaCsvPath.replace(/\\/g, "/"));
    await runDuckDbExec(
      conn,
      `CREATE TABLE zip_centroids AS SELECT
        trim(cast(zip_code AS VARCHAR)) AS zip_code,
        cast(latitude AS DOUBLE) AS latitude,
        cast(longitude AS DOUBLE) AS longitude
      FROM read_csv_auto(${zPathSql}, header=true)`
    );
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
    for (const p of tmpPaths) {
      try {
        fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    try {
      conn.close((err) => {
        if (err) console.warn("duckdb conn close:", err);
      });
    } catch {
      /* ignore */
    }
    try {
      db.close((err) => {
        if (err) console.warn("duckdb db close:", err);
      });
    } catch {
      /* ignore */
    }
  };

  return { db, conn, tmpPaths, close };
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
