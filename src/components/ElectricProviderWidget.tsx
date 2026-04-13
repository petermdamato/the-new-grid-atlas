"use client";

import { useEffect, useState } from "react";
import { Zap, MapPin, Users, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Feature } from "geojson";

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s || s === "NOT AVAILABLE" || s === "-999999") return "—";
  return s;
}

function fmtNum(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (!Number.isFinite(n) || n === -999999) return "—";
  return n.toLocaleString();
}

interface ElectricProviderWidgetProps {
  features: Feature[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onDismiss: () => void;
}

export default function ElectricProviderWidget({
  features,
  selectedIndex,
  onSelectIndex,
  onDismiss,
}: ElectricProviderWidgetProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 1200);
    return () => clearTimeout(t);
  }, [features]);

  const feature = features[selectedIndex];
  const p = (feature?.properties ?? {}) as Record<string, unknown>;
  const name = fmt(p.NAME) !== "—" ? fmt(p.NAME) : fmt(p.HOLDING_CO);
  const id = fmt(p.ID);
  const state = fmt(p.STATE);
  const ctrl = fmt(p.CNTRL_AREA);
  const customers = fmtNum(p.CUSTOMERS);
  const year = fmt(p.YEAR);
  const source = fmt(p.SOURCE);
  const naics = fmt(p.NAICS_DESC);

  return (
    <div
      className={`transition-all duration-700 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      }`}
    >
      <div className="bg-[#FAFAFA] p-5 rounded-2xl font-jakarta">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="block min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Electric service territory
            {features.length > 1 ? ` (${selectedIndex + 1} of ${features.length})` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {features.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectIndex(selectedIndex === 0 ? features.length - 1 : selectedIndex - 1)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200"
                  aria-label="Previous territory"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectIndex(selectedIndex === features.length - 1 ? 0 : selectedIndex + 1)
                  }
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200"
                  aria-label="Next territory"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="w-[384px] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl bg-white shadow-[0_2px_24px_rgba(0,0,0,0.08)]">
          <div className="border-b border-zinc-100 px-5 pb-4 pt-5">
            <div className="mb-2 flex items-start gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Zap className="h-4 w-4 text-amber-600" aria-hidden />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-tight text-zinc-900">{name}</h2>
                <p className="mt-0.5 text-xs text-zinc-400">ID: {id}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                  <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] leading-none text-zinc-400">State</p>
                  <p className="truncate text-xs font-semibold text-zinc-700">{state}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
                  <Users className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] leading-none text-zinc-400">Retail customers</p>
                  <p className="truncate text-xs font-semibold text-zinc-700">{customers}</p>
                </div>
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-zinc-400">Control area</dt>
                <dd className="min-w-0 text-right font-medium text-zinc-800">{ctrl}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-zinc-400">Data year</dt>
                <dd className="text-right font-medium text-zinc-800">{year}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-zinc-400">NAICS</dt>
                <dd className="min-w-0 text-right font-medium text-zinc-800">{naics}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="shrink-0 text-zinc-400">Source</dt>
                <dd className="min-w-0 text-right font-medium text-zinc-800">{source}</dd>
              </div>
            </dl>
          </div>

          <p className="px-5 py-3 text-[10px] leading-relaxed text-zinc-500">
            Electric Retail Service Territories (HIFLD), published by the U.S. Department of Energy, Office of
            Science, Oak Ridge National Laboratory; U.S. Department of Homeland Security.
          </p>
        </div>
      </div>
    </div>
  );
}
