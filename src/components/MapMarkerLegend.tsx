"use client";

import type { WarehouseTypeFilters } from "@/components/AddressSearch";

/** Circle colors — kept in sync with `SystemMap` layer paint */
const COLORS = {
  /** Hyperscaler and Neocloud share this color on the map */
  hyperscaler: "#14b8a6",
  enterprise: "#0f766e",
  fulfillmentCenter: "#ea580c",
  distributionCenter: "#9a3412",
  otherWarehouse: "#171717",
  searchedAddress: "#ff0000",
} as const;

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-white shadow-sm ring-1 ring-black/10"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export interface MapMarkerLegendProps {
  /** `capacitytype` values the map is allowed to show (from search filters) */
  visibleDataCenterCapacityTypes: string[];
  warehouseTypeFilters: WarehouseTypeFilters;
  /** Search pin is on the map when center is set */
  showSearchedAddress: boolean;
}

export default function MapMarkerLegend({
  visibleDataCenterCapacityTypes,
  warehouseTypeFilters,
  showSearchedAddress,
}: MapMarkerLegendProps) {
  const dc = new Set(visibleDataCenterCapacityTypes);
  const showEnterprise = dc.has("Enterprise");
  const showHyperscaler = dc.has("Hyperscaler") || dc.has("Neocloud");
  const showFc = warehouseTypeFilters.fulfillmentCenter;
  const showDc = warehouseTypeFilters.distributionCenter;
  const showOtherWh = warehouseTypeFilters.other;

  const rows: { key: string; label: string; color: string }[] = [];
  if (showEnterprise) rows.push({ key: "enterprise", label: "Enterprise data center", color: COLORS.enterprise });
  if (showHyperscaler) rows.push({ key: "hyperscaler", label: "Hyperscaler", color: COLORS.hyperscaler });
  if (showFc) rows.push({ key: "fc", label: "Fulfillment center", color: COLORS.fulfillmentCenter });
  if (showDc) rows.push({ key: "dc", label: "Distribution center", color: COLORS.distributionCenter });
  if (showOtherWh) rows.push({ key: "other", label: "Other warehouse", color: COLORS.otherWarehouse });
  if (showSearchedAddress) rows.push({ key: "search", label: "Searched address", color: COLORS.searchedAddress });

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/50 bg-white/90 px-3 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.08)] backdrop-blur-md font-jakarta">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400">Map legend</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex min-w-0 items-center gap-2 text-[11px] text-zinc-700">
            <Dot color={r.color} />
            <span className="leading-tight">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
