"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import AddressSearch, {
  DataCenterTypeFilters,
  UtilityType,
  WarehouseTypeFilters,
} from "@/components/AddressSearch";
import SystemMap from "@/components/SystemMap";
import ViolationsWidget from "@/components/ViolationsWidget";
import ElectricProviderWidget from "@/components/ElectricProviderWidget";
import MapMarkerLegend from "@/components/MapMarkerLegend";
import DataCenterTipModal from "@/components/DataCenterTipModal";
import { readMapUiPreferences, writeMapUiPreferences } from "@/lib/map-ui-preferences";
import { Feature } from "geojson";
import { Info, UserPlus, Lightbulb, MapPin } from "lucide-react";

function visibleCapacityTypesFromFilters(f: DataCenterTypeFilters, filtersUnlocked: boolean): string[] {
  const out: string[] = [];
  if (f.hyperscaler) {
    out.push("Hyperscaler", "Neocloud");
  }
  if (filtersUnlocked) {
    if (f.enterprise) out.push("Enterprise");
    if (f.colocation) out.push("Colocation");
  }
  return out;
}

function visibleWarehouseGroupsFromFilters(f: WarehouseTypeFilters): string[] {
  const out: string[] = [];
  if (f.fulfillmentCenter) out.push("FC");
  if (f.distributionCenter) out.push("DC");
  if (f.other) out.push("Other");
  return out;
}

type UtilityDrawerKind = "water" | "electric";

export default function HomePage() {
  const { user, session, loading } = useAuth();
  const filtersUnlocked = !loading && Boolean(session && user);

  const [searchResult, setResult] = useState<{
    features: Feature[];
    center: [number, number] | null;
    utilityType?: UtilityType;
  }>({
    features: [],
    center: null,
    utilityType: "water",
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dataCenterTypeFilters, setDataCenterTypeFilters] = useState<DataCenterTypeFilters>({
    hyperscaler: true,
    colocation: false,
    enterprise: false,
  });
  const [warehouseTypeFilters, setWarehouseTypeFilters] = useState<WarehouseTypeFilters>({
    fulfillmentCenter: false,
    distributionCenter: false,
    other: false,
  });
  const [addressFieldResetSignal, setAddressFieldResetSignal] = useState(0);
  const [tipModalOpen, setTipModalOpen] = useState(false);
  const [aiMapQueryFeatures, setAiMapQueryFeatures] = useState<Feature[]>([]);

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [utilityDrawer, setUtilityDrawer] = useState<UtilityDrawerKind | null>(null);
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [mapUiHydrated, setMapUiHydrated] = useState(false);

  useEffect(() => {
    const saved = readMapUiPreferences();
    if (saved) {
      setDataCenterTypeFilters(saved.dataCenterTypeFilters);
      setWarehouseTypeFilters(saved.warehouseTypeFilters);
      setResult((prev) => ({
        ...prev,
        utilityType: saved.utilityType,
      }));
      setFiltersPanelOpen(saved.filtersOpen);
    }
    setMapUiHydrated(true);
  }, []);

  useEffect(() => {
    if (!mapUiHydrated) return;
    writeMapUiPreferences({
      dataCenterTypeFilters,
      warehouseTypeFilters,
      utilityType: searchResult.utilityType ?? "water",
      filtersOpen: filtersPanelOpen,
    });
  }, [
    mapUiHydrated,
    dataCenterTypeFilters,
    warehouseTypeFilters,
    searchResult.utilityType,
    filtersPanelOpen,
  ]);

  const dismissUtilitySearch = useCallback(() => {
    setResult((prev) => ({
      features: [],
      center: null,
      utilityType: prev.utilityType ?? "water",
    }));
    setSelectedIndex(0);
    setAddressFieldResetSignal((n) => n + 1);
    setUtilityDrawer(null);
  }, []);

  const waterResultsActive =
    searchResult.features.length > 0 && searchResult.utilityType === "water";
  const electricResultsActive =
    searchResult.features.length > 0 && searchResult.utilityType === "electric";

  useEffect(() => {
    if (utilityDrawer === "water" && !waterResultsActive) setUtilityDrawer(null);
    if (utilityDrawer === "electric" && !electricResultsActive) setUtilityDrawer(null);
  }, [waterResultsActive, electricResultsActive, utilityDrawer]);

  useEffect(() => {
    if (!utilityDrawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUtilityDrawer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [utilityDrawer]);

  const visibleDcTypes = visibleCapacityTypesFromFilters(dataCenterTypeFilters, filtersUnlocked);

  const openMobileSearch = useCallback(() => {
    setUtilityDrawer(null);
    setMobileSearchOpen(true);
  }, []);

  const toggleUtilityDrawer = useCallback((kind: UtilityDrawerKind) => {
    setMobileSearchOpen(false);
    setUtilityDrawer((prev) => (prev === kind ? null : kind));
  }, []);

  const legendProps = {
    visibleDataCenterCapacityTypes: visibleDcTypes,
    warehouseTypeFilters,
    showSearchedAddress: Boolean(searchResult.center),
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-gray-50">
      <SystemMap
        features={searchResult.features}
        center={searchResult.center}
        selectedIndex={selectedIndex}
        visibleDataCenterCapacityTypes={visibleDcTypes}
        visibleWarehouseGroups={visibleWarehouseGroupsFromFilters(warehouseTypeFilters)}
        dataCenterDetailsUnlocked={filtersUnlocked}
        utilityType={searchResult.utilityType ?? "water"}
        aiMapQueryFeatures={aiMapQueryFeatures.length > 0 ? aiMapQueryFeatures : null}
      />

      {mobileSearchOpen ? (
        <button
          type="button"
          aria-label="Dismiss search"
          className="fixed inset-0 z-[33] bg-zinc-900/30 md:hidden"
          onClick={() => setMobileSearchOpen(false)}
        />
      ) : null}

      <AddressSearch
        mapPinCenter={searchResult.center}
        dataCenterTypeFilters={dataCenterTypeFilters}
        onToggleDataCenterType={(key) =>
          setDataCenterTypeFilters((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        warehouseTypeFilters={warehouseTypeFilters}
        onToggleWarehouseType={(key) =>
          setWarehouseTypeFilters((prev) => ({ ...prev, [key]: !prev[key] }))
        }
        filtersUnlocked={filtersUnlocked}
        waterResultsActive={waterResultsActive}
        electricResultsActive={electricResultsActive}
        addressFieldResetSignal={addressFieldResetSignal}
        aiResultsActive={aiMapQueryFeatures.length > 0}
        onClearAiMapQuery={() => setAiMapQueryFeatures([])}
        onAiMapQueryResult={(data) => {
          if (!data) {
            setAiMapQueryFeatures([]);
            return;
          }
          setAiMapQueryFeatures(data.features);
        }}
        onResult={(data) => {
          setResult(data);
          setSelectedIndex(0);
          const ut = data.utilityType ?? "water";
          if ((ut === "water" || ut === "electric") && data.features.length > 0) {
            setAiMapQueryFeatures([]);
          }
        }}
        mobileSheetExpanded={mobileSearchOpen}
        onMobileSheetOpenChange={setMobileSearchOpen}
        utilityOverlayType={searchResult.utilityType ?? "water"}
        filtersPanelOpen={filtersPanelOpen}
        onFiltersPanelOpenChange={setFiltersPanelOpen}
      />

      {/* Mobile: floating legend above safe area — search sheet sits higher (see AddressSearch bottom offset) */}
      <div className="pointer-events-none fixed bottom-3 left-1/2 z-[22] flex w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 justify-center md:hidden">
        <div className="pointer-events-auto max-w-full">
          <MapMarkerLegend {...legendProps} />
        </div>
      </div>

      {/* Mobile: open search / filters */}
      <button
        type="button"
        onClick={openMobileSearch}
        className="fixed bottom-[max(6.75rem,env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 z-[24] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/50 bg-white/95 px-5 py-2.5 text-xs font-semibold text-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.12)] backdrop-blur-md transition hover:bg-white md:hidden"
      >
        <MapPin className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
        Search
      </button>

      {/* Mobile: utility emoji triggers — right slide-in */}
      <div className="fixed right-3 top-1/2 z-[26] flex -translate-y-1/2 flex-col gap-2 md:hidden">
        {waterResultsActive ? (
          <button
            type="button"
            onClick={() => toggleUtilityDrawer("water")}
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 text-2xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition hover:bg-white ${
              utilityDrawer === "water" ? "ring-2 ring-sky-400 ring-offset-2 ring-offset-transparent" : ""
            }`}
            aria-label="Open water system and violations"
          >
            <span aria-hidden>💧</span>
          </button>
        ) : null}
        {electricResultsActive ? (
          <button
            type="button"
            onClick={() => toggleUtilityDrawer("electric")}
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 text-2xl shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition hover:bg-white ${
              utilityDrawer === "electric" ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent" : ""
            }`}
            aria-label="Open electric service territory"
          >
            <span aria-hidden>⚡</span>
          </button>
        ) : null}
      </div>

      {utilityDrawer ? (
        <>
          <button
            type="button"
            aria-label="Dismiss utility panel"
            className="fixed inset-0 z-[38] bg-zinc-900/25 md:hidden"
            onClick={() => setUtilityDrawer(null)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-[40] flex w-[min(22rem,calc(100vw-0.5rem))] max-w-full translate-x-0 flex-col border-l border-zinc-200/90 bg-[#FAFAFA] shadow-[-10px_0_36px_rgba(0,0,0,0.12)] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={utilityDrawer === "water" ? "Water system details" : "Electric territory details"}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/80 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                {utilityDrawer === "water" ? "Water system" : "Electric"}
              </span>
              <button
                type="button"
                onClick={() => setUtilityDrawer(null)}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                Close
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-2">
              {utilityDrawer === "water" && waterResultsActive ? (
                <ViolationsWidget
                  instantReveal
                  features={searchResult.features}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                  onDismiss={dismissUtilitySearch}
                  detailUnlocked={filtersUnlocked}
                />
              ) : null}
              {utilityDrawer === "electric" && electricResultsActive ? (
                <ElectricProviderWidget
                  instantReveal
                  features={searchResult.features}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                  onDismiss={dismissUtilitySearch}
                />
              ) : null}
            </div>
          </aside>
        </>
      ) : null}

      {/* Mobile: left circular actions */}
      <div className="fixed left-3 top-1/2 z-[25] flex -translate-y-1/2 flex-col gap-2 md:hidden">
        <button
          type="button"
          onClick={() => setTipModalOpen(true)}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 text-zinc-700 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition hover:bg-white"
          aria-label="Submit a tip"
        >
          <Lightbulb className="h-5 w-5 shrink-0" aria-hidden />
        </button>
        <Link
          href="/about"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 text-zinc-700 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition hover:bg-white"
          aria-label="About this project"
        >
          <Info className="h-5 w-5 shrink-0" aria-hidden />
        </Link>
        <Link
          href={user ? "/account" : "/signup"}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-white/95 text-zinc-700 shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition hover:bg-white"
          aria-label={user ? "Account" : "Sign up for free"}
        >
          <UserPlus className="h-5 w-5 shrink-0" aria-hidden />
        </Link>
      </div>

      {/* Desktop: violations + electric + legend */}
      <div className="absolute bottom-[80px] right-[80px] z-10 hidden flex-col items-end gap-2 md:flex">
        {waterResultsActive && (
          <ViolationsWidget
            features={searchResult.features}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            onDismiss={dismissUtilitySearch}
            detailUnlocked={filtersUnlocked}
          />
        )}
        {electricResultsActive && (
          <ElectricProviderWidget
            features={searchResult.features}
            selectedIndex={selectedIndex}
            onSelectIndex={setSelectedIndex}
            onDismiss={dismissUtilitySearch}
          />
        )}
        <MapMarkerLegend {...legendProps} />
      </div>

      <DataCenterTipModal open={tipModalOpen} onClose={() => setTipModalOpen(false)} />

      {/* Desktop: bottom links */}
      <div className="absolute bottom-[80px] left-[80px] z-10 hidden flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:flex">
        <button
          type="button"
          onClick={() => setTipModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/90 px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-zinc-900"
        >
          <Lightbulb className="h-4 w-4 shrink-0" />
          Submit a tip
        </button>
        <Link
          href="/about"
          className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/90 px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-zinc-900"
        >
          <Info className="h-4 w-4 shrink-0" />
          About this project
        </Link>
        <Link
          href={user ? "/account" : "/signup"}
          className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/90 px-4 py-2.5 text-xs font-semibold text-zinc-700 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-md transition-all duration-200 hover:bg-white hover:text-zinc-900"
        >
          <UserPlus className="h-4 w-4 shrink-0" />
          {user ? "Account" : "Sign up for free"}
        </Link>
      </div>
    </main>
  );
}
