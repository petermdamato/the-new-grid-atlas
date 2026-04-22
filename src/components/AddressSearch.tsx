"use client";

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { Feature } from "geojson";
import {
  MapPin,
  ArrowRight,
  Loader2,
  Droplets,
  Zap,
  ChevronDown,
  X,
  KeyRound,
} from "lucide-react";
import Autocomplete from "react-google-autocomplete";

const SHEET_DISMISS_PULL_PX = 96;

export type UtilityType = "water" | "electric" | "off";

/** Default utility overlay for new sessions and invalid persisted values */
export const DEFAULT_UTILITY_TYPE: UtilityType = "electric";

export type DataCenterTypeFilterKey = "hyperscaler" | "colocation" | "enterprise";

export type DataCenterTypeFilters = Record<DataCenterTypeFilterKey, boolean>;

export type WarehouseTypeFilterKey = "fulfillmentCenter" | "distributionCenter" | "other";

export type WarehouseTypeFilters = Record<WarehouseTypeFilterKey, boolean>;

const DC_TYPE_HELP = {
  hyperscaler:
    "Facilities run by major cloud and internet platforms to host public cloud and core services at extreme scale. Some of these are used for machine learning and AI training.",
  colocation:
    "Shared buildings where many tenants lease racks, power, and network while a provider operates the facility.",
  enterprise:
    "Private sites owned and run by one company for its own servers, applications, and internal workloads.",
} as const;

function DataCenterFilterHelp({ id, text }: { id: string; text: string }) {
  const [touchOpen, setTouchOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!touchOpen) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setTouchOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [touchOpen]);

  const toggle = useCallback(() => setTouchOpen((o) => !o), []);

  return (
    <div ref={wrapRef} className="group relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-bold leading-none text-zinc-100 shadow-sm outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA] md:pointer-events-auto"
        aria-expanded={touchOpen}
        aria-label={`${id}: help`}
      >
        ?
      </button>
      <span
        role="tooltip"
        className={`absolute right-0 top-full z-[100] mt-1.5 w-max max-w-[min(16rem,calc(100vw-6rem))] rounded-md border border-zinc-800 bg-black px-2.5 py-2 text-left text-[10px] font-normal leading-snug text-zinc-100 shadow-lg transition-opacity duration-150 ease-out md:pointer-events-none ${
          touchOpen ? "opacity-100 max-md:pointer-events-auto" : "opacity-0 max-md:pointer-events-none"
        } md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100`}
      >
        {text}
      </span>
    </div>
  );
}

interface AddressSearchProps {
  onResult: (data: { features: Feature[]; center: [number, number] | null; error?: string; utilityType: UtilityType }) => void;
  dataCenterTypeFilters: DataCenterTypeFilters;
  onToggleDataCenterType: (key: DataCenterTypeFilterKey) => void;
  warehouseTypeFilters: WarehouseTypeFilters;
  onToggleWarehouseType: (key: WarehouseTypeFilterKey) => void;
  /** True when the map has water-system polygons (show clear even if the input is empty) */
  waterResultsActive?: boolean;
  /** True when electric territories are shown */
  electricResultsActive?: boolean;
  /** Incremented when the violations widget is dismissed to remount the Places input */
  addressFieldResetSignal?: number;
  /** Members can use Colocation / Enterprise filters */
  filtersUnlocked?: boolean;
  /** Current map pin from parent — used to keep the pin when turning utility overlay Off */
  mapPinCenter?: [number, number] | null;
  /** AI map query returned at least one point on the map */
  aiResultsActive?: boolean;
  /** Clear violet AI query highlights (parent state) */
  onClearAiMapQuery?: () => void;
  /** NL → SQL → DuckDB map hits (signed-in users only) */
  onAiMapQueryResult?: (data: { features: Feature[]; truncated?: boolean } | null) => void;
  /** Mobile bottom sheet: expanded state (controlled by parent) */
  mobileSheetExpanded?: boolean;
  onMobileSheetOpenChange?: (open: boolean) => void;
  /** Water / electric / off overlay — persisted by parent */
  utilityOverlayType: UtilityType;
  /** Filters accordion open — persisted by parent */
  filtersPanelOpen: boolean;
  onFiltersPanelOpenChange: (open: boolean) => void;
}

export default function AddressSearch({
  onResult,
  dataCenterTypeFilters,
  onToggleDataCenterType,
  warehouseTypeFilters,
  onToggleWarehouseType,
  waterResultsActive = false,
  electricResultsActive = false,
  addressFieldResetSignal = 0,
  filtersUnlocked = false,
  mapPinCenter = null,
  aiResultsActive = false,
  onClearAiMapQuery,
  onAiMapQueryResult,
  mobileSheetExpanded = false,
  onMobileSheetOpenChange,
  utilityOverlayType,
  filtersPanelOpen,
  onFiltersPanelOpenChange,
}: AddressSearchProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [utilityType, setUtilityType] = useState<UtilityType>(utilityOverlayType);
  const [panelMode, setPanelMode] = useState<"address" | "ai">("address");
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiTruncated, setAiTruncated] = useState(false);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  /** Enter runs before Google's `place_changed`; we complete search there or via fallback timer */
  const pendingEnterSearchRef = useRef(false);
  const enterFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Mobile bottom sheet: pull-down dismiss */
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetHandleRef = useRef<HTMLDivElement | null>(null);
  const sheetPullStartY = useRef(0);
  const sheetPullDragging = useRef(false);
  const sheetPullLastDy = useRef(0);

  function clearEnterSearchScheduling() {
    pendingEnterSearchRef.current = false;
    if (enterFallbackTimerRef.current) {
      clearTimeout(enterFallbackTimerRef.current);
      enterFallbackTimerRef.current = null;
    }
  }

  useEffect(() => {
    return () => clearEnterSearchScheduling();
  }, []);

  useEffect(() => {
    setUtilityType(utilityOverlayType);
  }, [utilityOverlayType]);

  useEffect(() => {
    if (!mobileSheetExpanded || !onMobileSheetOpenChange) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileSheetOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileSheetExpanded, onMobileSheetOpenChange]);

  useEffect(() => {
    if (!mobileSheetExpanded) {
      setSheetDragY(0);
      sheetPullDragging.current = false;
    }
  }, [mobileSheetExpanded]);

  useEffect(() => {
    const el = sheetHandleRef.current;
    if (!el || !onMobileSheetOpenChange) return;

    const endPull = () => {
      if (!sheetPullDragging.current) return;
      sheetPullDragging.current = false;
      const dy = sheetPullLastDy.current;
      sheetPullLastDy.current = 0;
      if (dy >= SHEET_DISMISS_PULL_PX) onMobileSheetOpenChange(false);
      setSheetDragY(0);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!mobileSheetExpanded) return;
      sheetPullDragging.current = true;
      sheetPullStartY.current = e.touches[0].clientY;
      sheetPullLastDy.current = 0;
      setSheetDragY(0);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!sheetPullDragging.current || !mobileSheetExpanded) return;
      const dy = Math.max(0, e.touches[0].clientY - sheetPullStartY.current);
      sheetPullLastDy.current = dy;
      if (dy > 0) e.preventDefault();
      setSheetDragY(dy);
    };

    const onTouchEnd = () => endPull();
    const onTouchCancel = () => endPull();

    const onMouseDown = (e: MouseEvent) => {
      if (!mobileSheetExpanded) return;
      sheetPullDragging.current = true;
      sheetPullStartY.current = e.clientY;
      sheetPullLastDy.current = 0;
      setSheetDragY(0);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!sheetPullDragging.current || !mobileSheetExpanded) return;
      const dy = Math.max(0, e.clientY - sheetPullStartY.current);
      sheetPullLastDy.current = dy;
      setSheetDragY(dy);
    };

    const onMouseUp = () => endPull();

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchCancel);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mobileSheetExpanded, onMobileSheetOpenChange]);

  useEffect(() => {
    if (addressFieldResetSignal <= 0) return;
    clearEnterSearchScheduling();
    setAddress("");
    setError(null);
    setAutocompleteKey((k) => k + 1);
  }, [addressFieldResetSignal]);

  function getQuery(): string {
    return (address.trim() || addressInputRef.current?.value.trim() || "").trim();
  }

  function clearAddressAndMap() {
    clearEnterSearchScheduling();
    setAddress("");
    setError(null);
    setAutocompleteKey((k) => k + 1);
    onResult({ features: [], center: null, utilityType });
  }

  const showClearControl =
    address.trim().length > 0 ||
    waterResultsActive ||
    electricResultsActive ||
    Boolean(mapPinCenter);

  /**
   * @param utilityOverride — use when switching tabs so the correct API runs before `utilityType` state updates.
   */
  async function handleSearch(addressOverride?: string, utilityOverride?: UtilityType) {
    const query = (addressOverride ?? getQuery()).trim();
    if (!query) return;

    const mode = utilityOverride ?? utilityType;

    setIsLoading(true);
    setError(null);

    try {
      if (mode === "off") {
        const res = await fetch("/api/geocode-address", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: query }),
        });
        const data = await res.json();
        if (!res.ok) {
          const errMsg = data.error || "An error occurred during search";
          setError(errMsg);
          onResult({ features: [], center: null, error: errMsg, utilityType: "off" });
          return;
        }
        if (data.center && Array.isArray(data.center) && data.center.length === 2) {
          onResult({
            features: [],
            center: data.center as [number, number],
            utilityType: "off",
          });
        } else {
          const errMsg = data.reason || "Could not locate that address.";
          setError(errMsg);
          onResult({ features: [], center: null, error: errMsg, utilityType: "off" });
        }
        return;
      }

      const endpoint = mode === "electric" ? "/api/lookup-electric" : "/api/lookup-pws";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: query }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = data.error || "An error occurred during search";
        setError(errMsg);
        onResult({ features: [], center: null, error: errMsg, utilityType: mode });
        return;
      }

      if (data.features && data.features.length > 0) {
        onResult({
          features: data.features,
          center: data.center,
          utilityType: mode,
        });
      } else {
        const errMsg =
          data.reason ||
          (mode === "electric"
            ? "No electric retail service territory found for this address."
            : "No water system found for this address.");
        setError(errMsg);
        onResult({ features: [], center: null, error: errMsg, utilityType: mode });
      }
    } catch {
      const errMsg = "Failed to connect to the server.";
      setError(errMsg);
      onResult({
        features: [],
        center: null,
        error: errMsg,
        utilityType: mode === "off" ? "off" : mode,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAiMapQuery() {
    if (!onAiMapQueryResult) return;
    const q = aiQuery.trim();
    if (!q) return;

    if (!filtersUnlocked) {
      setAiError("Sign in to run AI map queries.");
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setAiTruncated(false);

    try {
      const res = await fetch("/api/ai-map-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: q }),
      });
      const data = (await res.json()) as {
        error?: string;
        geojson?: { features?: Feature[] };
        truncated?: boolean;
        debugSql?: string;
        debugWrappedSql?: string;
      };

      if (data.debugSql != null && data.debugSql !== "") {
        console.info("[ai-map-query] validated SQL:\n", data.debugSql);
        if (data.debugWrappedSql) {
          console.info("[ai-map-query] executed SQL (outer limit):\n", data.debugWrappedSql);
        }
      }

      if (!res.ok) {
        const errMsg = data.error || "AI map query failed";
        setAiError(errMsg);
        onAiMapQueryResult(null);
        return;
      }

      const feats = Array.isArray(data.geojson?.features) ? data.geojson!.features! : [];
      onAiMapQueryResult({ features: feats, truncated: Boolean(data.truncated) });
      setAiTruncated(Boolean(data.truncated));
      if (feats.length === 0) {
        setAiError("No rows matched your question (try broader filters).");
      }
    } catch {
      const errMsg = "Failed to connect to the server.";
      setAiError(errMsg);
      onAiMapQueryResult(null);
    } finally {
      setAiLoading(false);
    }
  }

  function switchUtilityType(next: UtilityType) {
    if (next === utilityType) return;
    setUtilityType(next);
    setError(null);
    if (next === "off") {
      onResult({ features: [], center: mapPinCenter ?? null, utilityType: "off" });
      return;
    }
    const q = getQuery();
    if (q) {
      void handleSearch(q, next);
    } else {
      onResult({ features: [], center: mapPinCenter ?? null, utilityType: next });
    }
  }

  const mobileSheetOpen = Boolean(mobileSheetExpanded);
  const sheetDragStyle: CSSProperties | undefined =
    mobileSheetOpen && sheetDragY > 0 ? { transform: `translateY(${sheetDragY}px)` } : undefined;

  const rootClass =
    "select-none font-jakarta overflow-x-hidden bg-[#FAFAFA] " +
    (sheetDragY > 0 ? "max-md:transition-none " : "") +
    "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-[34] max-md:w-full max-md:rounded-t-none max-md:shadow-[0_-8px_32px_rgba(0,0,0,0.14)] max-md:max-h-[min(92dvh,100dvh)] max-md:overflow-y-auto max-md:pb-[env(safe-area-inset-bottom,0px)] max-md:transition-transform max-md:duration-300 max-md:ease-out " +
    (mobileSheetOpen
      ? "max-md:translate-y-0 max-md:pointer-events-auto "
      : "max-md:translate-y-[calc(100%+1rem)] max-md:pointer-events-none ") +
    "md:absolute md:left-[80px] md:top-[80px] md:z-[20] md:w-[min(420px,calc(100vw-2.5rem))] md:max-h-[calc(100dvh-88px)] md:translate-y-0 md:pointer-events-auto md:overflow-y-auto md:rounded-2xl md:shadow-[0_8px_30px_rgba(0,0,0,0.12)]";

  return (
    <div className={rootClass} style={sheetDragStyle}>
      {onMobileSheetOpenChange ? (
        <div className="sticky top-0 z-[3] shrink-0 bg-[#FAFAFA] md:hidden">
          <div
            ref={sheetHandleRef}
            className="flex w-full cursor-grab touch-none flex-col items-center justify-center gap-1.5 py-3 active:cursor-grabbing"
            aria-label="Drag down to close"
          >
            <span className="sr-only">Drag down to close search and filters</span>
            <div className="h-1.5 w-11 shrink-0 rounded-full bg-zinc-300" aria-hidden />
          </div>
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/90 px-4 pb-3 pt-0">
            <span className="text-xs font-semibold tracking-wide text-zinc-800">Search &amp; filters</span>
            <button
              type="button"
              onClick={() => onMobileSheetOpenChange(false)}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
              aria-label="Close search and filters"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
      <div className="z-[1] bg-[#FAFAFA] px-3 pb-1 pt-3 max-md:static max-md:pt-2 md:sticky md:top-0">
        {panelMode === "address" ? (
          <button
            type="button"
            onClick={() => setPanelMode("ai")}
            className="flex h-7 w-full min-w-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#8ebfbb] to-[#b5dece] px-3 text-[10px] font-semibold leading-none tracking-wide text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-[filter] duration-200 hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ebfbb]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
            title="You can now query our data with AI (BETA)"
          >
            <span className="min-w-0 flex-1 truncate text-center">You can now query our data with AI (BETA)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPanelMode("address")}
            className="flex h-7 w-full min-w-0 items-center justify-center rounded-lg bg-gradient-to-r from-violet-200 to-teal-100 px-3 text-[10px] font-semibold leading-none tracking-wide text-zinc-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-[background-image] duration-200 hover:from-violet-300 hover:to-teal-200/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
            title="Back to address search"
          >
            <span className="min-w-0 flex-1 truncate text-center">Back to address search</span>
          </button>
        )}
      </div>

      {panelMode === "ai" ? (
        <form
          className="flex flex-col gap-3 px-5 pb-5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!aiLoading) void handleAiMapQuery();
          }}
        >
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Ask anything about the map data…"
            className="h-11 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 text-xs text-zinc-800 shadow-[0_4px_14px_rgba(0,0,0,0.06)] outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60"
            aria-label="Natural language map query"
            disabled={aiLoading}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={aiLoading || !aiQuery.trim()}
              className="group flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all duration-150 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-zinc-900"
            >
              {aiLoading ? (
                <>
                  Searching
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                </>
              ) : (
                <>
                  Run Query
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </>
              )}
            </button>
          </div>
          {aiResultsActive && onClearAiMapQuery ? (
            <button
              type="button"
              onClick={() => {
                onClearAiMapQuery();
                setAiError(null);
                setAiTruncated(false);
              }}
              className="self-start rounded-lg px-1 py-1 text-[11px] font-semibold text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              Clear map highlights
            </button>
          ) : null}
          {aiTruncated ? (
            <p className="text-[11px] font-medium text-amber-800/90">
              Results capped at 500 rows — refine your question for a narrower set.
            </p>
          ) : null}
          {aiError ? (
            <div className="rounded-lg border border-red-100 bg-red-50/90 px-3 py-2 text-xs font-medium text-red-700">
              {aiError}
            </div>
          ) : null}
          <p className="text-xs leading-relaxed text-zinc-600">
            Ask in plain language; we generate read-only SQL over warehouse and data center tables and show hits as
            violet dots. Example:{" "}
            <span className="font-medium text-zinc-800">
              List data centers in Idaho with capacity type Hyperscaler.
            </span>
          </p>
        </form>
      ) : (
        <div className="px-5 pb-5 pt-2">
      <div className="mb-3">
        <span className="block text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase drop-shadow-sm">
          Search by address
        </span>
      </div>

      <div className="flex h-10 items-center gap-2 rounded-2xl border border-white/40 bg-white/ px-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <MapPin className="h-4 w-4 shrink-0 self-center text-zinc-400" />
        <Autocomplete
          ref={addressInputRef}
          key={autocompleteKey}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}
          onPlaceSelected={(place) => {
            const formatted = place?.formatted_address?.trim();
            const fromInput = addressInputRef.current?.value.trim() ?? "";
            const next = formatted || fromInput;
            if (next) setAddress(next);
            if (pendingEnterSearchRef.current) {
              clearEnterSearchScheduling();
              if (next) void handleSearch(next);
            }
          }}
          options={{
            types: ["address"],
            componentRestrictions: { country: "us" },
          }}
          placeholder="Enter a street address..."
          className="h-5 min-w-0 flex-1 self-center border-0 bg-transparent py-0 text-xs leading-5 text-zinc-800 outline-none placeholder:text-zinc-400 cursor-text select-text"
          disabled={isLoading}
          defaultValue={address}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key !== "Enter" || isLoading) return;
            pendingEnterSearchRef.current = true;
            if (enterFallbackTimerRef.current) clearTimeout(enterFallbackTimerRef.current);
            enterFallbackTimerRef.current = setTimeout(() => {
              enterFallbackTimerRef.current = null;
              if (!pendingEnterSearchRef.current) return;
              pendingEnterSearchRef.current = false;
              const v = addressInputRef.current?.value.trim() ?? "";
              if (v) {
                setAddress(v);
                void handleSearch(v);
              }
            }, 400);
          }}
        />
        {showClearControl && (
          <button
            type="button"
            onClick={clearAddressAndMap}
            aria-label="Clear address and map"
            className="flex h-5 w-5 shrink-0 items-center justify-center self-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <div className="flex justify-end mt-3 relative">
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={isLoading}
          className="group flex items-center gap-2 bg-zinc-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all duration-150 shadow-md hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-zinc-900"
        >
          {isLoading ? (
            <>
              Searching
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </>
          ) : (
            <>
              Search
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </>
          )}
        </button>
        
        {error && (
          <div className="absolute top-12 right-0 text-red-500 text-xs font-medium bg-white/90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm border border-red-100">
            {error}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-zinc-200/90 pt-3">
        <span className="mb-2 block text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase drop-shadow-sm">
          Show utility service area
        </span>
        <div className="flex gap-0.5 rounded-md bg-zinc-200/60 p-0.5">
          <button
            type="button"
            onClick={() => switchUtilityType("electric")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-bold transition-colors duration-200 ${
              utilityType === "electric"
                ? "bg-white text-amber-600 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Zap className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Electric</span>
          </button>
          <button
            type="button"
            onClick={() => switchUtilityType("water")}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded px-2 py-1 text-[11px] font-bold transition-colors duration-200 ${
              utilityType === "water"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Droplets className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Water</span>
          </button>
          <button
            type="button"
            onClick={() => switchUtilityType("off")}
            className={`flex min-w-0 flex-1 items-center justify-center rounded px-2 py-1 text-[11px] font-bold transition-colors duration-200 ${
              utilityType === "off"
                ? "bg-white text-zinc-800 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            None
          </button>
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-zinc-200/90">
        <button
          type="button"
          onClick={() => onFiltersPanelOpenChange(!filtersPanelOpen)}
          aria-expanded={filtersPanelOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg py-1 text-left outline-none ring-zinc-400 focus-visible:ring-2"
        >
          <span className="text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase drop-shadow-sm">
            Filters
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${filtersPanelOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {filtersPanelOpen && (
          <>
            <h3 className="mt-3 text-[10px] font-semibold tracking-[0.1em] text-zinc-500 uppercase">
              Data centers
            </h3>
            <div className="mt-2.5 flex flex-col gap-2.5">
              <div className="flex items-center gap-1">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={dataCenterTypeFilters.hyperscaler}
                    onChange={() => onToggleDataCenterType("hyperscaler")}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 text-orange-600 focus:ring-orange-500/30"
                  />
                  Hyperscaler
                </label>
                <DataCenterFilterHelp id="Hyperscaler" text={DC_TYPE_HELP.hyperscaler} />
              </div>
              <div className="flex items-start gap-1">
                <div
                  className={`relative min-w-0 flex-1 rounded-lg ${!filtersUnlocked ? "min-h-[80px]" : ""}`}
                >
                  <div
                    className={
                      filtersUnlocked
                        ? "flex flex-col gap-2.5"
                        : "pointer-events-none flex flex-col gap-2.5 blur-[3px] opacity-50"
                    }
                  >
                    <div className="flex items-center">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                        <input
                          type="checkbox"
                          checked={dataCenterTypeFilters.enterprise}
                          onChange={() => onToggleDataCenterType("enterprise")}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 text-teal-600 focus:ring-teal-500/30"
                        />
                        Enterprise
                      </label>
                    </div>
                    <div className="flex items-center">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                        <input
                          type="checkbox"
                          checked={dataCenterTypeFilters.colocation}
                          onChange={() => onToggleDataCenterType("colocation")}
                          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-zinc-300 text-sky-700 focus:ring-sky-500/30"
                        />
                        Colocation
                      </label>
                    </div>
                  </div>
                  {!filtersUnlocked && (
                    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/55 px-3 py-2 text-center backdrop-blur-[2px]">
                      <KeyRound className="h-5 w-5 text-zinc-500" aria-hidden />
                      <p className="text-[10px] font-semibold leading-snug text-zinc-800">
                        <Link
                          href="/signup"
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                        >
                          Sign up for free
                        </Link>{" "}
                        to use filters
                      </p>
                    </div>
                  )}
                </div>
                {filtersUnlocked ? (
                  <div className="flex shrink-0 flex-col gap-2.5 self-start pt-px">
                    <DataCenterFilterHelp id="Enterprise data center" text={DC_TYPE_HELP.enterprise} />
                    <DataCenterFilterHelp id="Colocation data center" text={DC_TYPE_HELP.colocation} />
                  </div>
                ) : null}
              </div>
            </div>

            <h3 className="mt-3 text-[10px] font-semibold tracking-[0.1em] text-zinc-500 uppercase">
              Warehouses (Walmart and Amazon)
            </h3>
            <div
              className={`relative mt-2.5 rounded-lg ${!filtersUnlocked ? "min-h-[58px]" : ""}`}
            >
              <div
                className={
                  filtersUnlocked
                    ? "flex flex-col gap-2.5"
                    : "pointer-events-none flex flex-col gap-2.5 blur-[3px] opacity-50"
                }
              >
                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={warehouseTypeFilters.fulfillmentCenter}
                    onChange={() => onToggleWarehouseType("fulfillmentCenter")}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 text-amber-600 focus:ring-amber-500/30"
                  />
                  Fulfillment center (FC)
                </label>
                <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                  <input
                    type="checkbox"
                    checked={warehouseTypeFilters.distributionCenter}
                    onChange={() => onToggleWarehouseType("distributionCenter")}
                    className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 text-violet-600 focus:ring-violet-500/30"
                  />
                  Distribution center (DC)
                </label>
                <div>
                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-zinc-800">
                    <input
                      type="checkbox"
                      checked={warehouseTypeFilters.other}
                      onChange={() => onToggleWarehouseType("other")}
                      className="h-3.5 w-3.5 cursor-pointer rounded border-zinc-300 text-slate-600 focus:ring-slate-500/30"
                    />
                    Other
                  </label>
                  {filtersUnlocked ? (
                    <span className="mt-0.5 block pl-[22px] text-[10px] leading-snug text-zinc-400">
                      Corporate offices, logistics and reverse logistics, SUAC, SC, etc.
                    </span>
                  ) : null}
                </div>
              </div>
              {!filtersUnlocked && (
                <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-white/55 px-3 py-2 text-center backdrop-blur-[2px]">
                  <KeyRound className="h-5 w-5 text-zinc-500" aria-hidden />
                  <p className="text-[10px] font-semibold leading-snug text-zinc-800">
                  <Link
                    href="/signup"
                    className="text-[10px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    Sign up for free
                  </Link> to use filters
                  </p>
  
                </div>
              )}
            </div>
          </>
        )}
      </div>
        </div>
      )}
    </div>
  );
}