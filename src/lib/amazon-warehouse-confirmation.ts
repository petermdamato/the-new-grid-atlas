import type { SupabaseClient } from "@supabase/supabase-js";
import type { Feature, FeatureCollection } from "geojson";

import type { DataCenterConfirmationValue } from "@/lib/data-center-confirmation";

/** Default when a warehouse has no DB row yet, or the table/query fails (matches seeded editorial policy). */
export const AMAZON_WAREHOUSE_EDITORIAL_FALLBACK: DataCenterConfirmationValue = {
  confirmed: true,
  confirmation_link: "https://amzprep.com/",
};

/** Non-Amazon warehouses (e.g. Walmart) are not editorially confirmed until a DB row exists. */
export const NON_AMAZON_WAREHOUSE_CONFIRMATION_DEFAULT: DataCenterConfirmationValue = {
  confirmed: false,
  confirmation_link: null,
};

function isWalmartGeoFeature(f: Feature): boolean {
  return String(f.properties?.companyName ?? "").trim().toLowerCase() === "walmart";
}

/** Facility page / API: Walmart codes from merged geojson use this prefix when there is no DB row. */
export function isWalmartWarehouseCode(warehouseCode: string): boolean {
  return /^wm-/i.test(String(warehouseCode ?? "").trim());
}

/**
 * GeoJSON defaults for every `code`, then DB rows overlay (so `confirmed: false` in Supabase wins).
 */
export function mergeAmazonWarehouseConfirmationsWithGeojson(
  fromDb: globalThis.Map<string, DataCenterConfirmationValue>,
  warehousesFc: FeatureCollection | null
): globalThis.Map<string, DataCenterConfirmationValue> {
  const m = new globalThis.Map<string, DataCenterConfirmationValue>();
  if (warehousesFc?.features?.length) {
    for (const f of warehousesFc.features) {
      const code = String(f.properties?.code ?? "").trim();
      if (!code) continue;
      m.set(
        code,
        isWalmartGeoFeature(f) ? NON_AMAZON_WAREHOUSE_CONFIRMATION_DEFAULT : AMAZON_WAREHOUSE_EDITORIAL_FALLBACK
      );
    }
  }
  for (const [code, v] of fromDb) {
    m.set(code, v);
  }
  return m;
}

/** Load every row for map tooltips (paginated past PostgREST default limit). */
export async function fetchAllAmazonWarehouseConfirmations(
  supabase: SupabaseClient
): Promise<globalThis.Map<string, DataCenterConfirmationValue>> {
  const out = new globalThis.Map<string, DataCenterConfirmationValue>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("amazon_warehouse_confirmations")
      .select("warehouse_code, confirmed, confirmation_link")
      .order("warehouse_code", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("amazon_warehouse_confirmations fetch all:", error.message);
      return out;
    }
    if (!data?.length) break;

    for (const row of data) {
      const code = row.warehouse_code;
      if (typeof code !== "string" || !code) continue;
      out.set(code, {
        confirmed: Boolean(row.confirmed),
        confirmation_link: row.confirmation_link ?? null,
      });
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

export async function fetchAmazonWarehouseConfirmation(
  supabase: SupabaseClient,
  warehouseCode: string
): Promise<DataCenterConfirmationValue> {
  const { data, error } = await supabase
    .from("amazon_warehouse_confirmations")
    .select("confirmed, confirmation_link")
    .eq("warehouse_code", warehouseCode)
    .maybeSingle();

  if (error) {
    console.warn("amazon_warehouse_confirmations lookup:", error.message);
    if (isWalmartWarehouseCode(warehouseCode)) return NON_AMAZON_WAREHOUSE_CONFIRMATION_DEFAULT;
    return AMAZON_WAREHOUSE_EDITORIAL_FALLBACK;
  }
  if (!data) {
    if (isWalmartWarehouseCode(warehouseCode)) return NON_AMAZON_WAREHOUSE_CONFIRMATION_DEFAULT;
    return AMAZON_WAREHOUSE_EDITORIAL_FALLBACK;
  }
  return {
    confirmed: Boolean(data.confirmed),
    confirmation_link: data.confirmation_link ?? null,
  };
}
