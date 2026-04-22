import {
  DEFAULT_UTILITY_TYPE,
  type DataCenterTypeFilters,
  type UtilityType,
  type WarehouseTypeFilters,
} from "@/components/AddressSearch";

const STORAGE_KEY = "water-system-explorer:map-ui:v1";

export type MapUiPreferencesV1 = {
  dataCenterTypeFilters: DataCenterTypeFilters;
  warehouseTypeFilters: WarehouseTypeFilters;
  utilityType: UtilityType;
  filtersOpen: boolean;
};

const DEFAULT_DC: DataCenterTypeFilters = {
  hyperscaler: true,
  colocation: false,
  enterprise: false,
};

const DEFAULT_WH: WarehouseTypeFilters = {
  fulfillmentCenter: false,
  distributionCenter: false,
  other: false,
};

function isUtilityType(v: unknown): v is UtilityType {
  return v === "water" || v === "electric" || v === "off";
}

function mergeDc(raw: unknown): DataCenterTypeFilters {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DC };
  const o = raw as Record<string, unknown>;
  return {
    hyperscaler: typeof o.hyperscaler === "boolean" ? o.hyperscaler : DEFAULT_DC.hyperscaler,
    colocation: typeof o.colocation === "boolean" ? o.colocation : DEFAULT_DC.colocation,
    enterprise: typeof o.enterprise === "boolean" ? o.enterprise : DEFAULT_DC.enterprise,
  };
}

function mergeWh(raw: unknown): WarehouseTypeFilters {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_WH };
  const o = raw as Record<string, unknown>;
  return {
    fulfillmentCenter:
      typeof o.fulfillmentCenter === "boolean" ? o.fulfillmentCenter : DEFAULT_WH.fulfillmentCenter,
    distributionCenter:
      typeof o.distributionCenter === "boolean" ? o.distributionCenter : DEFAULT_WH.distributionCenter,
    other: typeof o.other === "boolean" ? o.other : DEFAULT_WH.other,
  };
}

export function readMapUiPreferences(): MapUiPreferencesV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const utilityType: UtilityType = isUtilityType(parsed.utilityType)
      ? parsed.utilityType
      : DEFAULT_UTILITY_TYPE;
    return {
      dataCenterTypeFilters: mergeDc(parsed.dataCenterTypeFilters),
      warehouseTypeFilters: mergeWh(parsed.warehouseTypeFilters),
      utilityType,
      filtersOpen: typeof parsed.filtersOpen === "boolean" ? parsed.filtersOpen : false,
    };
  } catch {
    return null;
  }
}

export function writeMapUiPreferences(p: MapUiPreferencesV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota / private mode */
  }
}
