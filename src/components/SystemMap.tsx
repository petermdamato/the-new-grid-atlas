"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchAllAmazonWarehouseConfirmations,
  mergeAmazonWarehouseConfirmationsWithGeojson,
} from "@/lib/amazon-warehouse-confirmation";
import { fetchAllDataCenterConfirmations } from "@/lib/data-center-confirmation";
import DataCenterConfirmationBadge from "@/components/DataCenterConfirmationBadge";
import Map, { Source, Layer, MapRef, Popup } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as turf from "@turf/turf";
import { Feature, FeatureCollection } from "geojson";
import type { UtilityType } from "@/components/AddressSearch";
import { facilityUrlSlugForFeature, warehouseStreetHeading } from "@/lib/facility-address-slug";
import { DATA_CENTER_GEOJSON_URL } from "@/lib/facility-dataset-url";

interface SystemMapProps {
  features: Feature[];
  center: [number, number] | null;
  selectedIndex: number;
  /** `capacitytype` values to render; empty hides all data-center points */
  visibleDataCenterCapacityTypes: string[];
  /** `warehouseGroup`: FC, DC, Other — empty hides Amazon warehouse points */
  visibleWarehouseGroups: string[];
  /** When false, popup shows blurred placeholder copy (not real facility data) and a sign-up prompt */
  dataCenterDetailsUnlocked: boolean;
  /** Water vs electric utility polygons — stroke/fill styling differs */
  utilityType?: UtilityType;
}

/** Rotating stroke styles for overlapping electric territories (cf. water CWS / Other / WSA) */
const ELECTRIC_STYLES = [
  { stroke: "#b45309", fill: "#b45309", dash: [1] as number[] },
  { stroke: "#6d28d9", fill: "#6d28d9", dash: [2, 2] as number[] },
  { stroke: "#0369a1", fill: "#0369a1", dash: [4, 2] as number[] },
  { stroke: "#be123c", fill: "#be123c", dash: [1, 3] as number[] },
] as const;

type DataCenterHover = {
  lng: number;
  lat: number;
  name: string;
  address: string;
  postal: string;
  companyName: string;
  /** Amazon warehouse: show facility type in popup */
  warehouseTypeRaw?: string;
  /** Deep link to facility page */
  detailKind: "data-center" | "warehouse";
  detailId: string;
};

/** Placeholder copy shown (blurred) when the user is not signed in */
const GUEST_DC_POPUP = {
  name: "Sample Facility Name",
  addressLine: "Street Address, City, State, Zip",
  company: "Sample Company Name",
} as const;

export default function SystemMap({
  features,
  center,
  selectedIndex,
  visibleDataCenterCapacityTypes,
  visibleWarehouseGroups,
  dataCenterDetailsUnlocked,
  utilityType = "water",
}: SystemMapProps) {
  const router = useRouter();
  const mapRef = useRef<MapRef>(null);
  const [dataCenters, setDataCenters] = useState<FeatureCollection | null>(null);
  const [amazonWarehouses, setAmazonWarehouses] = useState<FeatureCollection | null>(null);
  const [hoverDc, setHoverDc] = useState<DataCenterHover | null>(null);
  const [dcConfirmById, setDcConfirmById] = useState(
    () => new globalThis.Map<string, { confirmed: boolean; confirmation_link: string | null }>()
  );
  /** One bulk fetch on mount; after this, hover reads synchronously from `dcConfirmById`. */
  const [dcConfirmBulkLoading, setDcConfirmBulkLoading] = useState(true);
  const [whConfirmById, setWhConfirmById] = useState(
    () => new globalThis.Map<string, { confirmed: boolean; confirmation_link: string | null }>()
  );
  const [whConfirmBulkLoading, setWhConfirmBulkLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(DATA_CENTER_GEOJSON_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((fc) => {
        if (!cancelled && fc?.type === "FeatureCollection") setDataCenters(fc);
      })
      .catch(() => {
        if (!cancelled) setDataCenters(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/amazon_warehouses.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((fc) => {
        if (!cancelled && fc?.type === "FeatureCollection") setAmazonWarehouses(fc);
      })
      .catch(() => {
        if (!cancelled) setAmazonWarehouses(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void fetchAllDataCenterConfirmations(supabase).then((map) => {
      if (cancelled) return;
      setDcConfirmById(map);
      setDcConfirmBulkLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    void fetchAllAmazonWarehouseConfirmations(supabase)
      .then((map) => {
        if (cancelled) return;
        setWhConfirmById(map);
        setWhConfirmBulkLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setWhConfirmById(new globalThis.Map());
        setWhConfirmBulkLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allowedDcTypes = useMemo(
    () => new Set(visibleDataCenterCapacityTypes),
    [visibleDataCenterCapacityTypes]
  );

  const allowedWhGroups = useMemo(() => new Set(visibleWarehouseGroups), [visibleWarehouseGroups]);

  const filteredDataCenters = useMemo((): FeatureCollection | null => {
    if (!dataCenters) return null;
    if (allowedDcTypes.size === 0) {
      return { type: "FeatureCollection", features: [] };
    }
    return {
      type: "FeatureCollection",
      features: dataCenters.features.filter((f) =>
        allowedDcTypes.has(String(f.properties?.capacitytype ?? ""))
      ),
    };
  }, [dataCenters, allowedDcTypes]);

  const filteredWarehouses = useMemo((): FeatureCollection | null => {
    if (!amazonWarehouses) return null;
    if (allowedWhGroups.size === 0) {
      return { type: "FeatureCollection", features: [] };
    }
    return {
      type: "FeatureCollection",
      features: amazonWarehouses.features.filter((f) =>
        allowedWhGroups.has(String(f.properties?.warehouseGroup ?? ""))
      ),
    };
  }, [amazonWarehouses, allowedWhGroups]);

  const whConfirmResolved = useMemo(
    () => mergeAmazonWarehouseConfirmationsWithGeojson(whConfirmById, amazonWarehouses),
    [whConfirmById, amazonWarehouses]
  );

  const hoverConfirmationBadge = useMemo(() => {
    const id = hoverDc?.detailId;
    const k = hoverDc?.detailKind;
    if (!id || (k !== "data-center" && k !== "warehouse")) {
      return { confirmed: false, loading: false };
    }
    if (k === "data-center") {
      return {
        confirmed: dcConfirmById.get(id)?.confirmed ?? false,
        loading: dcConfirmBulkLoading,
      };
    }
    const resolved = whConfirmResolved.get(id);
    const hasResolved = resolved != null;
    return {
      confirmed: resolved?.confirmed ?? false,
      /** After geojson merge, every in-file code resolves; no endless spinner while Supabase catches up. */
      loading: whConfirmBulkLoading && !hasResolved,
    };
  }, [
    hoverDc?.detailKind,
    hoverDc?.detailId,
    dcConfirmById,
    whConfirmResolved,
    dcConfirmBulkLoading,
    whConfirmBulkLoading,
  ]);

  useEffect(() => {
    if (features.length > 0 && mapRef.current) {
      try {
        const allFeatures = turf.featureCollection(features);
        const [minLng, minLat, maxLng, maxLat] = turf.bbox(allFeatures);

        mapRef.current.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 40, duration: 1000 }
        );
      } catch (err) {
        console.error("Error calculating bbox:", err);
        if (center) {
          mapRef.current.flyTo({ center, zoom: 12, duration: 1000 });
        }
      }
    } else if (center && mapRef.current) {
      mapRef.current.flyTo({ center, zoom: 12, duration: 1000 });
    }
  }, [features, center]);

  const onDataCenterMouseMove = useCallback((e: MapMouseEvent) => {
    const f = e.features?.[0];
    if (f?.geometry.type !== "Point") {
      setHoverDc(null);
      return;
    }
    const coords = f.geometry.coordinates;
    const p = f.properties as Record<string, string | number | undefined> | undefined;
    if (String(p?.kind) === "warehouse") {
      const code = String(p?.code ?? "");
      setHoverDc({
        lng: coords[0],
        lat: coords[1],
        name: warehouseStreetHeading(p),
        address: String(p?.address ?? ""),
        postal: "",
        companyName: "Amazon",
        warehouseTypeRaw: String(p?.warehouseTypeRaw ?? ""),
        detailKind: "warehouse",
        detailId: code,
      });
      return;
    }
    setHoverDc({
      lng: coords[0],
      lat: coords[1],
      name: String(p?.name ?? ""),
      address: String(p?.address ?? ""),
      postal: String(p?.postal ?? ""),
      companyName: String(p?.companyName ?? ""),
      detailKind: "data-center",
      detailId: String(p?.id ?? ""),
    });
  }, []);

  const onFacilityClick = useCallback(
    (e: MapMouseEvent) => {
      if (!dataCenterDetailsUnlocked) return;
      const f = e.features?.[0];
      if (f?.geometry.type !== "Point") return;
      const p = f.properties as Record<string, string | number | undefined> | undefined;
      if (String(p?.kind) === "warehouse") {
        const list = amazonWarehouses?.features ?? [];
        if (!list.length) return;
        const slug = facilityUrlSlugForFeature(f, "warehouse", list);
        router.push(`/facility/warehouse/${encodeURIComponent(slug)}`);
        return;
      }
      const list = dataCenters?.features ?? [];
      if (!list.length) return;
      const slug = facilityUrlSlugForFeature(f, "data-center", list);
      router.push(`/facility/data-center/${encodeURIComponent(slug)}`);
    },
    [router, dataCenterDetailsUnlocked, dataCenters?.features, amazonWarehouses?.features]
  );

  const onMapMouseLeave = useCallback(() => {
    setHoverDc(null);
  }, []);

  const interactiveIds = useMemo(() => {
    const ids: string[] = [];
    if (filteredDataCenters?.features.length) ids.push("data-centers-circle");
    if (filteredWarehouses?.features.length) ids.push("amazon-warehouses-circle");
    return ids;
  }, [filteredDataCenters?.features.length, filteredWarehouses?.features.length]);

  return (
    <div className="w-full h-full absolute inset-0 z-0 bg-gray-100">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: -98.5795,
          latitude: 39.8283,
          zoom: 3.5,
        }}
        projection="mercator"
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        interactiveLayerIds={interactiveIds}
        cursor={hoverDc ? (dataCenterDetailsUnlocked ? "pointer" : "default") : "grab"}
        onMouseMove={onDataCenterMouseMove}
        onMouseLeave={onMapMouseLeave}
        onClick={onFacilityClick}
      >
        {features.map((feature, index) => {
          const isSelected = index === selectedIndex;
          const props = feature.properties as Record<string, unknown> | null | undefined;
          const pid = props?.PWSID ?? props?.ID ?? props?.OBJECTID ?? index;

          let strokeColor = "#051821";
          let fillColor = "#051821";
          let lineDash: number[] = isSelected ? [1] : [2, 2];

          if (utilityType === "electric") {
            const ei = Number(props?.electricIndex ?? index) % ELECTRIC_STYLES.length;
            const es = ELECTRIC_STYLES[ei]!;
            strokeColor = es.stroke;
            fillColor = es.fill;
            lineDash = isSelected ? [1] : [...es.dash];
          } else {
            const systemType = props?.systemType || "CWS";
            if (systemType === "Other" || systemType === "WSA") {
              strokeColor = "#1A4645";
              fillColor = "#1A4645";
            }
          }

          return (
            <Source key={`source-${utilityType}-${index}-${String(pid)}`} id={`utility-${utilityType}-${index}`} type="geojson" data={feature}>
              {isSelected && (
                <Layer
                  id={`utility-fill-${utilityType}-${index}`}
                  type="fill"
                  paint={{
                    "fill-color": fillColor,
                    "fill-opacity": 0.2,
                  }}
                />
              )}
              <Layer
                id={`utility-line-${utilityType}-${index}`}
                type="line"
                paint={{
                  "line-color": strokeColor,
                  "line-width": 2,
                  "line-dasharray": lineDash,
                }}
              />
            </Source>
          );
        })}

        {filteredDataCenters && filteredDataCenters.features.length > 0 && (
          <Source id="data-centers" type="geojson" data={filteredDataCenters}>
            <Layer
              id="data-centers-circle"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 2, 6, 4, 10, 6, 14, 9],
                "circle-color": [
                  "match",
                  ["get", "capacitytype"],
                  "Colocation",
                  "#155e75",
                  "Neocloud",
                  "#14b8a6",
                  "Enterprise",
                  "#0f766e",
                  "Hyperscaler",
                  "#14b8a6",
                  "#5c7c78",
                ],
                "circle-opacity": 0.88,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {filteredWarehouses && filteredWarehouses.features.length > 0 && (
          <Source id="amazon-warehouses" type="geojson" data={filteredWarehouses}>
            <Layer
              id="amazon-warehouses-circle"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 1.5, 6, 3.5, 10, 5.5, 14, 8],
                "circle-color": [
                  "match",
                  ["get", "warehouseGroup"],
                  "FC",
                  "#ea580c",
                  "DC",
                  "#9a3412",
                  "Other",
                  "#171717",
                  "#171717",
                ],
                "circle-opacity": 0.92,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {center && (
          <Source
            key={`search-center-${center[0]}-${center[1]}-${features.length}`}
            id="search-center"
            type="geojson"
            data={turf.point(center)}
          >
            <Layer
              id="search-center-point"
              type="circle"
              paint={{
                "circle-radius": 6,
                "circle-color": "#ff0000",
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {hoverDc && (
          <Popup
            longitude={hoverDc.lng}
            latitude={hoverDc.lat}
            closeButton={false}
            closeOnClick={false}
            anchor="bottom"
            offset={14}
            maxWidth="300px"
          >
            <div className="relative p-1 pr-2 pt-1 text-left font-jakarta">
              {hoverDc.detailId &&
              (hoverDc.detailKind === "data-center" || hoverDc.detailKind === "warehouse") ? (
                <div className="absolute right-1 top-1 z-20 max-w-[7rem] leading-none">
                  <DataCenterConfirmationBadge
                    confirmed={hoverConfirmationBadge.confirmed}
                    loading={hoverConfirmationBadge.loading}
                    minimalConfirmed
                  />
                </div>
              ) : null}
              {dataCenterDetailsUnlocked ? (
                <>
                  <div className="pr-14 text-sm font-bold leading-snug text-zinc-900">{hoverDc.name}</div>
                  {hoverDc.warehouseTypeRaw ? (
                    <div className="mt-1 text-[11px] font-medium text-zinc-600">
                      Type: {hoverDc.warehouseTypeRaw}
                    </div>
                  ) : null}
                  {hoverDc.address ? (
                    <div className="mt-1.5 text-xs leading-relaxed text-zinc-600">{hoverDc.address}</div>
                  ) : null}
                  {hoverDc.postal ? (
                    <div className="mt-0.5 text-xs text-zinc-500">{hoverDc.postal}</div>
                  ) : null}
                  {hoverDc.companyName ? (
                    <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] font-semibold text-zinc-700">
                      {hoverDc.companyName}
                    </div>
                  ) : null}
                  {hoverDc.detailId ? (
                    <div className="mt-3 inline-block text-[12px] font-bold tracking-wide text-zinc-800 [font-variant:small-caps]">
                      click to open facility page
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="relative min-h-[6.25rem] overflow-visible rounded-lg pr-12">
                  <div
                    className="pointer-events-none space-y-1.5 opacity-30 [filter:blur(5px)]"
                    aria-hidden
                  >
                    <div className="text-sm font-bold leading-snug text-zinc-900">
                      {GUEST_DC_POPUP.name}
                    </div>
                    <div className="text-xs leading-relaxed text-zinc-600">{GUEST_DC_POPUP.addressLine}</div>
                    <div className="mt-2 border-t border-zinc-100 pt-2 text-[11px] font-semibold text-zinc-700">
                      {GUEST_DC_POPUP.company}
                    </div>
                  </div>
                  <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 py-2 text-center">
                    <KeyRound className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    <p className="text-[10px] font-semibold leading-snug text-zinc-800">
                      Sign up to view details about this facility.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
