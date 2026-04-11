"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Feature } from "geojson";
import { MapPin, ArrowRight, Loader2, Droplets, Zap, ChevronDown, X, KeyRound } from "lucide-react";
import Autocomplete from "react-google-autocomplete";

export type UtilityType = "water" | "electric";

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
  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        className="flex h-4 w-4 items-center justify-center rounded-full bg-black text-[9px] font-bold leading-none text-zinc-100 shadow-sm outline-none transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
        aria-label={`${id}: ${text}`}
      >
        ?
      </button>
      <span
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-full z-[100] mt-1.5 w-max max-w-[min(16rem,calc(100vw-6rem))] rounded-md border border-zinc-800 bg-black px-2.5 py-2 text-left text-[10px] font-normal leading-snug text-zinc-100 opacity-0 shadow-lg transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
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
}: AddressSearchProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [utilityType, setUtilityType] = useState<UtilityType>("water");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"address" | "ai">("address");
  const [aiQuery, setAiQuery] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  /** Enter runs before Google's `place_changed`; we complete search there or via fallback timer */
  const pendingEnterSearchRef = useRef(false);
  const enterFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    (utilityType === "water" && (address.trim().length > 0 || waterResultsActive)) ||
    (utilityType === "electric" && (address.trim().length > 0 || electricResultsActive));

  /**
   * @param utilityOverride — use when switching tabs so the correct API runs before `utilityType` state updates.
   */
  async function handleSearch(addressOverride?: string, utilityOverride?: UtilityType) {
    const query = (addressOverride ?? getQuery()).trim();
    if (!query) return;

    const mode = utilityOverride ?? utilityType;
    setIsLoading(true);
    setError(null);

    const endpoint = mode === "electric" ? "/api/lookup-electric" : "/api/lookup-pws";

    try {
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
      onResult({ features: [], center: null, error: errMsg, utilityType: mode });
    } finally {
      setIsLoading(false);
    }
  }

  function switchUtilityType(next: UtilityType) {
    if (next === utilityType) return;
    setUtilityType(next);
    setError(null);
    const q = getQuery();
    if (q) {
      void handleSearch(q, next);
    } else {
      onResult({ features: [], center: null, utilityType: next });
    }
  }

  return (
    <div className="absolute z-10 top-[80px] left-[80px] w-[420px] select-none font-jakarta overflow-visible rounded-2xl bg-[#FAFAFA] shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      {/* <div className="px-3 pt-3">
        {panelMode === "address" ? (
          <button
            type="button"
            onClick={() => setPanelMode("ai")}
            className="flex h-7 w-full min-w-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#8ebfbb] to-[#b5dece] px-3 text-[10px] font-semibold leading-none tracking-wide text-zinc-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition-[filter] duration-200 hover:brightness-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ebfbb]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAFAFA]"
            title="You can now query our data with AI (for the irony)"
          >
            <span className="min-w-0 flex-1 truncate text-center">You can now query our data with AI (for the irony)</span>
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
      </div> */}

      {panelMode === "ai" ? (
        <div className="px-5 pb-5 pt-3">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Ask anything about the map data…"
            className="h-11 w-full rounded-2xl border border-zinc-200/90 bg-white px-4 text-xs text-zinc-800 shadow-[0_4px_14px_rgba(0,0,0,0.06)] outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-200/60"
            aria-label="Natural language query (coming soon)"
          />
          <p className="mt-4 text-xs leading-relaxed text-zinc-600">
            You can ask any question of our data in natural language and get back a response on the map. Unsure
            what to search? Try:{" "}
            <span className="font-medium text-zinc-800">
              Show me a county with a hyperscaler and an e-commerce fulfillment center.
            </span>
          </p>
        </div>
      ) : (
        <div className="px-5 pb-5 pt-3">
      <div className="flex items-center justify-between mb-4">
        <span className="block text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase drop-shadow-sm">
          Search by address
        </span>
        
        {/* Utility Toggle */}
        <div className="flex bg-zinc-200/60 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => switchUtilityType("water")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
              utilityType === "water" 
                ? "bg-white text-blue-600 shadow-sm" 
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            Water
          </button>
          <button
            type="button"
            onClick={() => switchUtilityType("electric")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200 ${
              utilityType === "electric"
                ? "bg-white text-amber-600 shadow-sm"
                : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            <Zap className="w-3.5 h-3.5 shrink-0" />
            Electric
          </button>
        </div>
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

      <div className="mt-5 pt-5 border-t border-zinc-200/90">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg py-1 text-left outline-none ring-zinc-400 focus-visible:ring-2"
        >
          <span className="text-[10px] font-semibold tracking-[0.12em] text-zinc-600 uppercase drop-shadow-sm">
            Filters
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${filtersOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {filtersOpen && (
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
                      <label className="flex min-w-0 flex-1 cursor-not-allowed items-center gap-2.5 text-xs font-medium text-zinc-500">
                        <input
                          type="checkbox"
                          checked={false}
                          disabled
                          className="h-3.5 w-3.5 shrink-0 cursor-not-allowed rounded border-zinc-200 text-blue-600 opacity-60"
                        />
                        <span>Colocation</span>
                        <span className="rounded bg-zinc-200/80 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                          Coming soon
                        </span>
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
              Amazon Warehouses
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