import type { Feature } from "geojson";
import type { WarehouseTypeFilters } from "@/components/AddressSearch";

function propsOf(f: Feature): Record<string, unknown> {
  return (f.properties ?? {}) as Record<string, unknown>;
}

/** Stable order for legend rows (see `MapMarkerLegend`). */
const DC_TYPE_ORDER = ["Enterprise", "Colocation", "Hyperscaler", "Neocloud"] as const;

/**
 * Unique `capacitytype` values on AI map hits (`kind === "data-center"`), for legend rows.
 */
export function legendVisibleDcTypesFromAiFeatures(features: Feature[]): string[] {
  const found = new Set<string>();
  for (const f of features) {
    const p = propsOf(f);
    if (String(p.kind) !== "data-center") continue;
    const ct = String(p.capacitytype ?? "").trim();
    if (ct) found.add(ct);
  }
  const out: string[] = [];
  for (const o of DC_TYPE_ORDER) {
    if (found.has(o)) out.push(o);
  }
  const known = new Set<string>([...DC_TYPE_ORDER]);
  for (const v of found) {
    if (!known.has(v)) out.push(v);
  }
  return out;
}

/**
 * Warehouse legend toggles derived from AI hits (`kind === "warehouse"` + `warehouseGroup`).
 */
export function legendWarehouseFiltersFromAiFeatures(features: Feature[]): WarehouseTypeFilters {
  let fulfillmentCenter = false;
  let distributionCenter = false;
  let other = false;
  for (const f of features) {
    const p = propsOf(f);
    if (String(p.kind) !== "warehouse") continue;
    const g = String(p.warehouseGroup ?? "").trim();
    if (g === "FC") fulfillmentCenter = true;
    else if (g === "DC") distributionCenter = true;
    else if (g === "Other") other = true;
  }
  return { fulfillmentCenter, distributionCenter, other };
}
