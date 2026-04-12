import fs from "fs/promises";
import path from "path";
import type { FeatureCollection } from "geojson";

export type BoundaryDataset =
  | "cws-boundaries"
  | "wsa-boundaries"
  | "other-boundaries"
  | "electric-boundaries";

function boundariesBaseUrl(): string | null {
  const raw = process.env.BOUNDARIES_BASE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

/** Allow only sane state / territory codes (no path traversal). */
function safeStateCode(stateCode: string): string | null {
  const s = stateCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,6}$/.test(s)) return null;
  return s;
}

/**
 * Load per-state GeoJSON for boundary lookups.
 * - If BOUNDARIES_BASE_URL is set (e.g. public R2 URL), fetches HTTPS objects
 *   at {base}/{dataset}/by-state/{state}.geojson (keys mirror paths under data/).
 * - Otherwise reads from data/ on disk (local dev).
 */
export async function loadStateFeatureCollection(
  dataset: BoundaryDataset,
  stateCode: string
): Promise<FeatureCollection | null> {
  const state = safeStateCode(stateCode);
  if (!state) return null;

  const base = boundariesBaseUrl();
  if (base) {
    const url = `${base}/${dataset}/by-state/${encodeURIComponent(state)}.geojson`;
    try {
      const res = await fetch(url, {
        next: { revalidate: 86_400 },
      });
      if (!res.ok) {
        if (res.status !== 404) {
          console.error(`boundary fetch failed ${res.status} ${url}`);
        }
        return null;
      }
      const text = await res.text();
      return JSON.parse(text) as FeatureCollection;
    } catch (e) {
      console.error(`boundary fetch error ${url}:`, e);
      return null;
    }
  }

  const filePath = path.join(process.cwd(), "data", dataset, "by-state", `${state}.geojson`);
  try {
    const fileContent = await fs.readFile(filePath, "utf8");
    return JSON.parse(fileContent) as FeatureCollection;
  } catch {
    return null;
  }
}
