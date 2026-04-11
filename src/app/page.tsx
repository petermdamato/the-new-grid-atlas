"use client";

import { useState, useCallback } from "react";
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
import DataCenterTipModal from "@/components/DataCenterTipModal";
import { Feature } from "geojson";
import { Info, UserPlus, Lightbulb } from "lucide-react";

function visibleCapacityTypesFromFilters(f: DataCenterTypeFilters, filtersUnlocked: boolean): string[] {
  const out: string[] = [];
  if (f.hyperscaler) {
    out.push("Hyperscaler", "Neocloud");
  }
  if (filtersUnlocked) {
    if (f.enterprise) out.push("Enterprise");
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
  /** Bumped when the utility result panel dismisses so AddressSearch can reset the Google input */
  const [addressFieldResetSignal, setAddressFieldResetSignal] = useState(0);
  const [tipModalOpen, setTipModalOpen] = useState(false);

  const dismissUtilitySearch = useCallback(() => {
    setResult((prev) => ({
      features: [],
      center: null,
      utilityType: prev.utilityType ?? "water",
    }));
    setSelectedIndex(0);
    setAddressFieldResetSignal((n) => n + 1);
  }, []);

  const waterResultsActive =
    searchResult.features.length > 0 && searchResult.utilityType === "water";
  const electricResultsActive =
    searchResult.features.length > 0 && searchResult.utilityType === "electric";

  return (
    <main className="h-screen w-screen relative overflow-hidden bg-gray-50">
      <SystemMap
        features={searchResult.features}
        center={searchResult.center}
        selectedIndex={selectedIndex}
        visibleDataCenterCapacityTypes={visibleCapacityTypesFromFilters(
          dataCenterTypeFilters,
          filtersUnlocked
        )}
        visibleWarehouseGroups={visibleWarehouseGroupsFromFilters(warehouseTypeFilters)}
        dataCenterDetailsUnlocked={filtersUnlocked}
        utilityType={searchResult.utilityType ?? "water"}
      />

      <AddressSearch
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
        onResult={(data) => {
          setResult(data);
          setSelectedIndex(0);
        }}
      />

      {searchResult.features.length > 0 && searchResult.utilityType === "water" && (
        <ViolationsWidget
          features={searchResult.features}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onDismiss={dismissUtilitySearch}
          detailUnlocked={filtersUnlocked}
        />
      )}

      {searchResult.features.length > 0 && searchResult.utilityType === "electric" && (
        <ElectricProviderWidget
          features={searchResult.features}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          onDismiss={dismissUtilitySearch}
        />
      )}

      <DataCenterTipModal open={tipModalOpen} onClose={() => setTipModalOpen(false)} />

      <div className="absolute z-10 bottom-[80px] left-[80px] flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
