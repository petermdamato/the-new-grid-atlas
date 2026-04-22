"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Droplets,
  Users,
  MapPin,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  KeyRound,
} from "lucide-react";

interface Violation {
  vioid: string;
  cname: string;
  vname: string;
  enfactionname: string;
  enfdate: string;
  health_effects: string;
  violmeasure: string;
  definition: string;
}

interface SystemMetadata {
  pwsid?: string;
  pwsName?: string;
  primarySource?: string;
  countyServed?: string;
  populationServed?: string;
}

interface ViolationsWidgetProps {
  features: import("geojson").Feature[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onDismiss: () => void;
  detailUnlocked: boolean;
  /** Skip enter delay when embedded in mobile slide-in drawer */
  instantReveal?: boolean;
}

function ViolationRow({ v, detailUnlocked }: { v: Violation; detailUnlocked: boolean }) {
  const [hovered, setHovered] = useState(false);
  
  // As requested, everything is medium severity for now
  const cfg = {
    icon: AlertCircle,
    bg: "bg-amber-50",
    text: "text-amber-500",
    badge: "bg-amber-100 text-amber-600",
  };
  
  const Icon = cfg.icon;

  return (
    <div className="relative flex items-start gap-3 py-1 border-b border-zinc-100 last:border-0">
      <div
        className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-default ${cfg.bg}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.badge}`}>
            {v.cname || "Unknown"}
          </span>
          <span className="text-xs text-zinc-400">
            {new Date(v.enfdate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <p className="text-xs font-medium text-zinc-700 truncate">
          {v.violmeasure} | {v.enfactionname}
        </p>
      </div>

      {hovered &&
        (detailUnlocked ? (
          <div className="absolute left-0 top-full z-10 w-full rounded-xl bg-zinc-900 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-lg">
            <p className="mb-0.5 font-semibold">
              {v.violmeasure} | {v.enfactionname}
            </p>
            <p className="text-zinc-300">{v.definition || v.health_effects || "No details available."}</p>
          </div>
        ) : (
          <div className="absolute left-0 top-full z-10 w-full overflow-hidden rounded-xl shadow-lg">
            <div className="relative min-h-[5rem] bg-zinc-900">
              <div className="pointer-events-none p-3 text-[11px] leading-relaxed text-white opacity-40 blur-sm">
                <p className="mb-0.5 font-semibold">
                  {v.violmeasure} | {v.enfactionname}
                </p>
                <p className="text-zinc-300">
                  {v.definition || v.health_effects || "No details available."}
                </p>
              </div>
              <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/30 px-3 backdrop-blur-[3px]">
                <KeyRound className="h-4 w-4 text-zinc-400" aria-hidden />
                <p className="text-center text-[10px] font-semibold leading-snug text-white">
                  Sign up to view details about this facility.
                </p>
                <Link
                  href="/signup"
                  className="text-[10px] font-bold text-sky-300 hover:text-sky-200"
                >
                  Sign up free
                </Link>
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

const VIOLATIONS_PAGE_SIZE = 10;

function ViolationModalRow({ v, detailUnlocked }: { v: Violation; detailUnlocked: boolean }) {
  const cfg = {
    icon: AlertCircle,
    bg: "bg-amber-50",
    text: "text-amber-500",
    badge: "bg-amber-100 text-amber-600",
  };
  const Icon = cfg.icon;
  const detail = v.definition || v.health_effects || "No details available.";

  return (
    <div className="border-b border-zinc-100 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
              {v.cname || "Unknown"}
            </span>
            <span className="text-xs text-zinc-400">
              {new Date(v.enfdate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-800">
            {v.violmeasure} | {v.enfactionname}
          </p>
          {detailUnlocked ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">{detail}</p>
          ) : (
            <div className="relative mt-1.5 min-h-[3.25rem] overflow-hidden rounded-lg">
              <p className="pointer-events-none text-[11px] leading-relaxed text-zinc-600 opacity-35 blur-sm">
                {detail}
              </p>
              <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/60 px-2 text-center backdrop-blur-[2px]">
                <KeyRound className="h-4 w-4 text-zinc-500" aria-hidden />
                <p className="text-[9px] font-semibold leading-snug text-zinc-800">
                  Sign up to view details about this facility.
                </p>
                <Link href="/signup" className="text-[9px] font-bold text-blue-600 hover:text-blue-700">
                  Sign up free
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ViolationsWidget({
  features,
  selectedIndex,
  onSelectIndex,
  onDismiss,
  detailUnlocked,
  instantReveal = false,
}: ViolationsWidgetProps) {
  const [allViolations, setAllViolations] = useState<Violation[]>([]);
  const [violationsFetchError, setViolationsFetchError] = useState(false);
  const [metadata, setMetadata] = useState<SystemMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [violationsModalOpen, setViolationsModalOpen] = useState(false);
  const [violationsPage, setViolationsPage] = useState(1);

  const feature = features[selectedIndex];
  const pwsid = feature?.properties?.PWSID;
  const pwsName = feature?.properties?.PWS_Name || "Water System Found";

  useEffect(() => {
    if (instantReveal) {
      setShow(true);
      return;
    }
    const showTimer = setTimeout(() => {
      setShow(true);
    }, 1200);
    return () => clearTimeout(showTimer);
  }, [features, instantReveal]);

  useEffect(() => {
    async function fetchData() {
      if (!pwsid) return;
      
      setLoading(true);
      setViolationsFetchError(false);
      try {
        // Fetch metadata
        const metaRes = await fetch(`/api/system-metadata/${pwsid}`);
        if (metaRes.ok) {
          const metaData = (await metaRes.json()) as SystemMetadata;
          setMetadata(metaData);
        } else {
          setMetadata(null);
        }

        // Fetch violations
        const vioRes = await fetch(`/api/system-violations/${pwsid}`);
        if (!vioRes.ok) {
          setViolationsFetchError(true);
          setAllViolations([]);
        } else {
          setViolationsFetchError(false);
          const vioData = await vioRes.json();

          if (Array.isArray(vioData)) {
            const sorted = [...vioData].sort((a: Violation, b: Violation) => {
              return new Date(b.enfdate).getTime() - new Date(a.enfdate).getTime();
            });
            setAllViolations(sorted);
          } else {
            setAllViolations([]);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setViolationsFetchError(true);
        setAllViolations([]);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [pwsid, selectedIndex]);

  const previewViolations = allViolations.slice(0, 5);
  const violationTotalPages = Math.max(1, Math.ceil(allViolations.length / VIOLATIONS_PAGE_SIZE));
  const modalPageStart = (violationsPage - 1) * VIOLATIONS_PAGE_SIZE;
  const modalPageViolations = allViolations.slice(modalPageStart, modalPageStart + VIOLATIONS_PAGE_SIZE);

  const openViolationsModal = useCallback(() => {
    setViolationsPage(1);
    setViolationsModalOpen(true);
  }, []);

  const closeViolationsModal = useCallback(() => {
    setViolationsModalOpen(false);
  }, []);

  useEffect(() => {
    if (!violationsModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeViolationsModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [violationsModalOpen, closeViolationsModal]);

  useEffect(() => {
    setViolationsModalOpen(false);
    setViolationsPage(1);
  }, [pwsid]);

  const props = feature?.properties || {};
  const systemType = props.systemType || "CWS";
  const popServed = metadata?.populationServed || props.Population_Served_Count || "Unknown";
  const source = metadata?.primarySource || props.Primary_Source_Type || "Unknown";
  const county = metadata?.countyServed || props.Counties_Served || "Unknown";
  const activeSince = props.Activity_Date ? new Date(props.Activity_Date).getFullYear() : "Unknown";
  
  // Prefer the name from the feature properties if it exists, otherwise fallback to metadata
  const displayPwsName = props.PWS_Name || metadata?.pwsName || pwsName;

  return (
    <>
    {violationsModalOpen && (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="violations-modal-title"
      >
        <button
          type="button"
          aria-label="Close violations list"
          className="absolute inset-0 bg-zinc-900/25 backdrop-blur-[2px]"
          onClick={closeViolationsModal}
        />
        <div className="relative z-[1] flex max-h-[min(85vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-[#FAFAFA] shadow-[0_20px_50px_rgba(0,0,0,0.18)] font-jakarta">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-200/80 px-5 py-4">
            <div className="min-w-0">
              <h2 id="violations-modal-title" className="text-base font-bold leading-tight text-zinc-900">
                All violations
              </h2>
              <p className="mt-1 truncate text-xs text-zinc-500" title={displayPwsName}>
                {displayPwsName}
              </p>
              <p className="text-[11px] text-zinc-400">PWSID: {pwsid}</p>
            </div>
            <button
              type="button"
              onClick={closeViolationsModal}
              className="shrink-0 rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 custom-scrollbar">
            {modalPageViolations.length > 0 ? (
              modalPageViolations.map((v, i) => (
                <ViolationModalRow
                  key={`${v.vioid}-${modalPageStart + i}`}
                  v={v}
                  detailUnlocked={detailUnlocked}
                />
              ))
            ) : (
              <p className="py-12 text-center text-sm text-zinc-500">No violations to show.</p>
            )}
          </div>

          {allViolations.length > 0 && (
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-200/80 px-5 py-3">
              <span className="text-[11px] text-zinc-500">
                Page {violationsPage} of {violationTotalPages}
                <span className="text-zinc-400"> · {allViolations.length} total</span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={violationsPage <= 1}
                  onClick={() => setViolationsPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={violationsPage >= violationTotalPages}
                  onClick={() => setViolationsPage((p) => Math.min(violationTotalPages, p + 1))}
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    <div
      className={`transition-all duration-700 ease-out ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8 pointer-events-none"
      }`}
    >
      {/* Parent wrapper with background and padding */}
      <div className="max-w-full rounded-2xl bg-[#FAFAFA] p-3 sm:p-5">
        {/* Title moved outside white section */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="block min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Water System {features.length > 1 ? `(${selectedIndex + 1} of ${features.length}) - ${systemType}` : ` - ${systemType}`}
          </span>

          <div className="flex shrink-0 items-center gap-0.5">
            {features.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectIndex(selectedIndex === 0 ? features.length - 1 : selectedIndex - 1)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200"
                  aria-label="Previous water system"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectIndex(selectedIndex === features.length - 1 ? 0 : selectedIndex + 1)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200"
                  aria-label="Next water system"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800"
              aria-label="Close water system panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Original white card content */}
        <div className="flex w-full max-w-[384px] flex-col overflow-hidden rounded-2xl bg-white font-jakarta shadow-[0_2px_24px_rgba(0,0,0,0.08)]">
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
            <h2 className="text-base font-bold text-zinc-900 leading-tight mb-1">
              {displayPwsName}
            </h2>
            <p className="text-xs text-zinc-400">PWSID: {pwsid}</p>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-50 rounded-lg flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Served</p>
                  <p className="text-xs font-semibold text-zinc-700">{popServed.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-50 rounded-lg flex items-center justify-center">
                  <Droplets className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Source</p>
                  <p className="text-xs font-semibold text-zinc-700">{source}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-50 rounded-lg flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">County</p>
                  <p className="text-xs font-semibold text-zinc-700 truncate max-w-[100px]" title={county}>{county}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-50 rounded-lg flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[10px] text-zinc-400 leading-none mb-0.5">Active Since</p>
                  <p className="text-xs font-semibold text-zinc-700">{activeSince}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Violations */}
          <div className="px-5 py-3 flex-1 overflow-y-auto custom-scrollbar max-h-[300px]">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                Recent Violations
              </p>
              {!loading && allViolations.length > 0 && (
                <span className="text-[10px] bg-red-100 text-red-500 font-bold px-2 py-0.5 rounded-full">
                  {allViolations.length}
                </span>
              )}
            </div>

            <div>
              {loading ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-900"></div>
                </div>
              ) : violationsFetchError ? (
                <div className="px-1 py-8 text-center">
                  <p className="text-sm font-semibold text-zinc-900">Connection Error.</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    We&apos;re having trouble connecting to the water data. Please try again later.
                  </p>
                </div>
              ) : previewViolations.length > 0 ? (
                previewViolations.map((v, i) => (
                  <ViolationRow key={`${v.vioid}-${i}`} v={v} detailUnlocked={detailUnlocked} />
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm font-semibold text-zinc-900">All Clear</p>
                  <p className="text-xs text-zinc-500 mt-1">No recent violations found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          {allViolations.length > 0 && (
            <div className="px-5 pb-5 pt-2">
              <button
                type="button"
                onClick={openViolationsModal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-zinc-700"
              >
                View all violations
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}