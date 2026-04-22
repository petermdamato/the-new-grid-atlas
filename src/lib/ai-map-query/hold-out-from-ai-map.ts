import type { FeatureCollection } from "geojson";

/**
 * `capacitytype` / `capacity_type` values that are "coming soon" or otherwise unavailable
 * as selectable map filters. Keep in sync with `AddressSearch` (e.g. Colocation).
 */
export const HELD_OUT_AI_MAP_DC_CAPACITY_TYPES = ["Colocation"] as const;

const EXCLUDED_LC = new Set(
  (HELD_OUT_AI_MAP_DC_CAPACITY_TYPES as readonly string[]).map((s) => s.toLowerCase())
);

/** Drops data-center hits the main UI does not offer as filterable types. */
export function filterHeldOutTypesFromAiMapGeojson(fc: FeatureCollection): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fc.features.filter((f) => {
      const p = f.properties as Record<string, unknown> | undefined;
      if (!p || String(p.kind) !== "data-center") return true;
      const ct = String(p.capacitytype ?? "").trim().toLowerCase();
      if (!ct) return true;
      return !EXCLUDED_LC.has(ct);
    }),
  };
}
