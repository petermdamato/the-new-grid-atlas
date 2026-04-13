"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import type { FeatureCollection } from "geojson";
import { ArrowLeft, AlertTriangle, MessageSquareText } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { fetchAmazonWarehouseConfirmation } from "@/lib/amazon-warehouse-confirmation";
import { fetchDataCenterConfirmation, parseConfirmationUrls } from "@/lib/data-center-confirmation";
import type { FacilityTipSnapshot } from "@/lib/facility-tips";
import { FACILITY_UPDATE_REPORT_CHOICES } from "@/lib/facility-updates";
import {
  facilityRecordKeyFromFeature,
  findFacilityByUrlSlug,
  warehouseStreetHeading,
  type FacilityUrlKind,
} from "@/lib/facility-address-slug";
import { DATA_CENTER_GEOJSON_URL } from "@/lib/facility-dataset-url";
import DataCenterConfirmationBadge from "@/components/DataCenterConfirmationBadge";
import DataCenterConfirmationForm from "@/components/DataCenterConfirmationForm";

type FacilityKind = "data-center" | "warehouse";

function isFacilityKind(s: string): s is FacilityKind {
  return s === "data-center" || s === "warehouse";
}

export default function FacilityPage() {
  const params = useParams();
  const kindRaw = params.kind;
  const slugRaw = params.slug;
  const kind = typeof kindRaw === "string" ? kindRaw : kindRaw?.[0];
  const slugParam = typeof slugRaw === "string" ? slugRaw : slugRaw?.[0];

  const { user, loading: authLoading } = useAuth();

  const [dcFc, setDcFc] = useState<FeatureCollection | null>(null);
  const [whFc, setWhFc] = useState<FeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportChoice, setReportChoice] = useState<string>("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [impactNote, setImpactNote] = useState("");
  const [impactSubmitted, setImpactSubmitted] = useState(false);
  const [impactSubmitting, setImpactSubmitting] = useState(false);
  const [impactError, setImpactError] = useState<string | null>(null);
  const [dcConfirmation, setDcConfirmation] = useState<{
    confirmed: boolean;
    confirmation_link: string | null;
  } | null>(null);
  const [dcConfirmationLoading, setDcConfirmationLoading] = useState(false);
  const [whConfirmation, setWhConfirmation] = useState<{
    confirmed: boolean;
    confirmation_link: string | null;
  } | null>(null);
  const [whConfirmationLoading, setWhConfirmationLoading] = useState(false);

  const decodedSlug = useMemo(() => (slugParam ? decodeURIComponent(slugParam) : ""), [slugParam]);

  const urlKind: FacilityUrlKind = kind === "warehouse" ? "warehouse" : "data-center";

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    const load = async () => {
      try {
        if (kind === "data-center") {
          const r = await fetch(DATA_CENTER_GEOJSON_URL);
          if (!r.ok) throw new Error("Failed to load data centers");
          const json = (await r.json()) as FeatureCollection;
          if (!cancelled) setDcFc(json?.type === "FeatureCollection" ? json : null);
        } else if (kind === "warehouse") {
          const r = await fetch("/amazon_warehouses.geojson");
          if (!r.ok) throw new Error("Failed to load warehouses");
          const json = (await r.json()) as FeatureCollection;
          if (!cancelled) setWhFc(json?.type === "FeatureCollection" ? json : null);
        }
      } catch {
        if (!cancelled) setLoadError("Could not load facility data.");
      }
    };

    if (kind && isFacilityKind(kind) && decodedSlug) void load();
    return () => {
      cancelled = true;
    };
  }, [kind, decodedSlug]);

  const feature = useMemo(() => {
    if (!kind || !isFacilityKind(kind)) return null;
    if (kind === "data-center") return findFacilityByUrlSlug(dcFc, "data-center", decodedSlug);
    return findFacilityByUrlSlug(whFc, "warehouse", decodedSlug);
  }, [kind, dcFc, whFc, decodedSlug]);

  const facilityRecordKey = useMemo(() => {
    if (!feature) return "";
    return facilityRecordKeyFromFeature(feature, urlKind);
  }, [feature, urlKind]);

  const facilityTipContext = useMemo(() => {
    if (!feature) return null;
    const p = feature.properties as Record<string, string | number | undefined> | undefined;
    const g = feature.geometry;
    const c = g?.type === "Point" ? (g.coordinates as [number, number]) : null;
    const capacityType = kind === "data-center" ? String(p?.capacitytype ?? "") : "";
    const warehouseGroup = kind === "warehouse" ? String(p?.warehouseGroup ?? "") : "";
    const warehouseTypeRaw = kind === "warehouse" ? String(p?.warehouseTypeRaw ?? "") : "";
    const facilitySubtype =
      kind === "data-center" ? capacityType : warehouseGroup || warehouseTypeRaw;
    const snapshot: FacilityTipSnapshot = {
      facilityName:
        kind === "warehouse"
          ? String(p?.address ?? "").trim().slice(0, 240) || warehouseStreetHeading(p)
          : String(p?.name ?? "Data center"),
      address: String(p?.address ?? ""),
      postal: kind === "data-center" ? String(p?.postal ?? "") : "",
      companyName: String(p?.companyName ?? ""),
      latitude: c ? c[1] : null,
      longitude: c ? c[0] : null,
      capacityType,
      warehouseGroup,
      warehouseTypeRaw,
      locationRegion: kind === "warehouse" ? String(p?.locationRegion ?? "") : "",
    };
    return { facilitySubtype, snapshot };
  }, [feature, kind]);

  useEffect(() => {
    if (kind !== "data-center" || !facilityRecordKey) {
      setDcConfirmation(null);
      setDcConfirmationLoading(false);
      return;
    }
    let cancelled = false;
    setDcConfirmationLoading(true);
    const supabase = createClient();
    void fetchDataCenterConfirmation(supabase, facilityRecordKey).then((row) => {
      if (cancelled) return;
      setDcConfirmation(row ?? { confirmed: false, confirmation_link: null });
      setDcConfirmationLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, facilityRecordKey]);

  useEffect(() => {
    if (kind !== "warehouse" || !facilityRecordKey) {
      setWhConfirmation(null);
      setWhConfirmationLoading(false);
      return;
    }
    let cancelled = false;
    setWhConfirmationLoading(true);
    const supabase = createClient();
    void fetchAmazonWarehouseConfirmation(supabase, facilityRecordKey).then((row) => {
      if (cancelled) return;
      setWhConfirmation(row);
      setWhConfirmationLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [kind, facilityRecordKey]);

  const facilityConfirmation = kind === "warehouse" ? whConfirmation : dcConfirmation;
  const facilityConfirmationLoading = kind === "warehouse" ? whConfirmationLoading : dcConfirmationLoading;

  const confirmationUrls = useMemo(
    () => parseConfirmationUrls(facilityConfirmation?.confirmation_link),
    [facilityConfirmation?.confirmation_link]
  );

  if (!kind || !slugParam || !isFacilityKind(kind)) {
    notFound();
  }

  const props = feature?.properties as Record<string, string | number | undefined> | undefined;

  const name =
    kind === "warehouse"
      ? warehouseStreetHeading(props)
      : String(props?.name ?? "Data center");
  const addressLine = String(props?.address ?? "");
  const postal = kind === "data-center" ? String(props?.postal ?? "") : "";
  const company =
    kind === "warehouse" ? String(props?.companyName ?? "Amazon") : String(props?.companyName ?? "");
  const capacityType = kind === "data-center" ? String(props?.capacitytype ?? "") : "";
  const warehouseTypeRaw = kind === "warehouse" ? String(props?.warehouseTypeRaw ?? "") : "";
  const coords =
    feature?.geometry?.type === "Point" ? (feature.geometry.coordinates as [number, number]) : null;

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportChoice || !user) return;
    setReportError(null);
    setReportSubmitting(true);
    try {
      const res = await fetch("/api/facility-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType: kind === "warehouse" ? "warehouse" : "data_center",
          facilityRecordId: facilityRecordKey,
          reportOption: reportChoice,
          snapshot: {
            facilityName: name || null,
            address: addressLine || null,
            postal: postal || null,
            companyName: company || null,
            latitude: coords ? coords[1] : null,
            longitude: coords ? coords[0] : null,
            capacityType: capacityType || null,
            warehouseGroup:
              kind === "warehouse" ? String(props?.warehouseGroup ?? "").trim() || null : null,
            warehouseTypeRaw: warehouseTypeRaw || null,
            locationRegion:
              kind === "warehouse" ? String(props?.locationRegion ?? "").trim() || null : null,
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not send report.");
      }
      setReportSubmitted(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleImpactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = impactNote.trim();
    if (!text) return;
    setImpactError(null);
    setImpactSubmitting(true);
    try {
      const res = await fetch("/api/community-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType: kind === "warehouse" ? "warehouse" : "data_center",
          facilityRecordId: facilityRecordKey,
          note: text,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not save your note.");
      }
      setImpactSubmitted(true);
      setImpactNote("");
    } catch (err) {
      setImpactError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setImpactSubmitting(false);
    }
  };

  const resetReportModal = useCallback(() => {
    setReportOpen(false);
    setReportChoice("");
    setReportSubmitted(false);
    setReportError(null);
    setReportSubmitting(false);
  }, []);

  if (loadError) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 font-jakarta">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-800">{loadError}</p>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-blue-600 hover:text-blue-700">
            Back to map
          </Link>
        </div>
      </main>
    );
  }

  if (!feature && dcFc !== null && kind === "data-center") {
    return (
      <main className="min-h-screen bg-gray-50 p-6 font-jakarta">
        <p className="text-center text-sm text-zinc-600">Facility not found.</p>
        <Link href="/" className="mt-4 flex justify-center text-sm font-semibold text-blue-600">
          Back to map
        </Link>
      </main>
    );
  }

  if (!feature && whFc !== null && kind === "warehouse") {
    return (
      <main className="min-h-screen bg-gray-50 p-6 font-jakarta">
        <p className="text-center text-sm text-zinc-600">Facility not found.</p>
        <Link href="/" className="mt-4 flex justify-center text-sm font-semibold text-blue-600">
          Back to map
        </Link>
      </main>
    );
  }

  if (!feature && (kind === "data-center" ? dcFc === null : whFc === null) && !loadError) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 font-jakarta flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </main>
    );
  }

  if (!feature) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 font-jakarta">
        <p className="text-center text-sm text-zinc-600">Facility not found.</p>
        <Link href="/" className="mt-4 flex justify-center text-sm font-semibold text-blue-600">
          Back to map
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-screen overflow-y-auto bg-gray-50 font-jakarta">
      <Link
        href="/"
        className="absolute left-6 top-6 z-10 inline-flex items-center gap-2 text-zinc-500 transition-colors hover:text-zinc-900 sm:left-10 sm:top-10"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm font-semibold">Back to map</span>
      </Link>

      <div className="mx-auto max-w-xl px-6 pb-16 pt-20 sm:px-8 sm:pt-24">
        <div className="rounded-3xl border border-zinc-100 bg-white p-8 shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                {kind === "warehouse" ? "Fulfillment / warehouse" : "Data center"}
              </span>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-zinc-900">{name}</h1>
            </div>
            {kind === "data-center" || kind === "warehouse" ? (
              <DataCenterConfirmationBadge
                confirmed={facilityConfirmation?.confirmed ?? false}
                loading={facilityConfirmationLoading}
                className="shrink-0"
              />
            ) : null}
          </div>

          <dl className="mt-8 space-y-5 border-t border-zinc-100 pt-8 text-sm text-zinc-600">
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Location</dt>
              <dd className="mt-1 leading-relaxed text-zinc-800">
                {addressLine || "—"}
                {postal ? (
                  <>
                    <br />
                    <span className="text-zinc-600">{postal}</span>
                  </>
                ) : null}
                {coords ? (
                  <p className="mt-2 font-mono text-[11px] text-zinc-500">
                    {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
                  </p>
                ) : null}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Company</dt>
              <dd className="mt-1 font-medium text-zinc-900">{company || "—"}</dd>
            </div>
            {capacityType ? (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Capacity type</dt>
                <dd className="mt-1 text-zinc-800">{capacityType}</dd>
              </div>
            ) : null}
            {warehouseTypeRaw ? (
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Facility type</dt>
                <dd className="mt-1 text-zinc-800">{warehouseTypeRaw}</dd>
              </div>
            ) : null}
          </dl>

          {(kind === "data-center" || kind === "warehouse") &&
          facilityConfirmation?.confirmed &&
          confirmationUrls.length > 0 ? (
            <div className="mt-8 border-t border-zinc-100 pt-8">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Source</h2>
              <ul className="mt-3 flex list-none flex-col gap-2">
                {confirmationUrls.map((url) => (
                  <li key={url}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs font-medium text-blue-600 underline-offset-2 hover:text-blue-800"
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(kind === "data-center" || kind === "warehouse") &&
          facilityConfirmation &&
          !facilityConfirmation.confirmed &&
          !facilityConfirmationLoading ? (
            facilityTipContext ? (
              <DataCenterConfirmationForm
                kind={kind === "warehouse" ? "warehouse" : "data-center"}
                facilityId={facilityRecordKey}
                facilityName={name}
                facilitySubtype={facilityTipContext.facilitySubtype}
                snapshot={facilityTipContext.snapshot}
                authLoading={authLoading}
                signedIn={Boolean(user)}
              />
            ) : null
          ) : null}

          <div className="mt-10 border-t border-zinc-100 pt-8">
            <button
              type="button"
              onClick={() => {
                setReportSubmitted(false);
                setReportChoice("");
                setReportError(null);
                setReportOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-2.5 text-xs font-semibold text-amber-950 transition-colors hover:bg-amber-100/90"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              These details look wrong
            </button>
          </div>

          <div className="mt-10 border-t border-zinc-100 pt-8">
            <div className="flex items-center gap-2 text-zinc-900">
              <MessageSquareText className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-bold">Community impact note</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Share how this facility affects your community (noise, traffic, water, power, jobs, etc.). Signed-in
              users only.
            </p>

            {authLoading ? (
              <p className="mt-4 text-xs text-zinc-400">Checking account…</p>
            ) : user ? (
              impactSubmitted ? (
                <p className="mt-4 rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs font-medium text-sky-900">
                  Thanks — your note was saved.
                </p>
              ) : (
                <form onSubmit={handleImpactSubmit} className="mt-4 space-y-3">
                  {impactError ? (
                    <p className="rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs font-medium text-red-900">
                      {impactError}
                    </p>
                  ) : null}
                  <textarea
                    value={impactNote}
                    onChange={(e) => setImpactNote(e.target.value)}
                    rows={4}
                    placeholder="Describe local impact you’ve observed or documented…"
                    className="w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-xs text-zinc-800 outline-none placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80"
                  />
                  <button
                    type="submit"
                    disabled={!impactNote.trim() || impactSubmitting}
                    className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {impactSubmitting ? "Saving…" : "Submit note"}
                  </button>
                </form>
              )
            ) : (
              <p className="mt-4 text-xs text-zinc-600">
                <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                  Sign up
                </Link>{" "}
                or{" "}
                <Link href="/account" className="font-semibold text-blue-600 hover:text-blue-700">
                  sign in
                </Link>{" "}
                to leave a community impact note.
              </p>
            )}
          </div>
        </div>
      </div>

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
            aria-label="Close"
            onClick={resetReportModal}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 bg-[#FAFAFA] p-6 shadow-xl">
            {reportSubmitted ? (
              <>
                <p className="text-sm font-semibold text-zinc-900">Thanks for the report.</p>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  We saved your feedback and the facility details shown on this page.
                </p>
                <button
                  type="button"
                  onClick={resetReportModal}
                  className="mt-5 h-10 w-full rounded-xl bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Close
                </button>
              </>
            ) : authLoading ? (
              <p className="text-xs text-zinc-500">Checking account…</p>
            ) : !user ? (
              <>
                <h2 id="report-title" className="text-base font-bold text-zinc-900">
                  What looks wrong?
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
                    Sign up
                  </Link>{" "}
                  or{" "}
                  <Link href="/account" className="font-semibold text-blue-600 hover:text-blue-700">
                    sign in
                  </Link>{" "}
                  to submit a correction.
                </p>
                <button
                  type="button"
                  onClick={resetReportModal}
                  className="mt-5 h-10 w-full rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Close
                </button>
              </>
            ) : (
              <form onSubmit={handleReportSubmit}>
                <h2 id="report-title" className="text-base font-bold text-zinc-900">
                  What looks wrong?
                </h2>
                <p className="mt-1 text-[11px] text-zinc-500">Choose the option that best matches what you’re seeing.</p>
                {reportError ? (
                  <p className="mt-3 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs font-medium text-red-900">
                    {reportError}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-col gap-2.5">
                  {FACILITY_UPDATE_REPORT_CHOICES.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200/90 bg-white px-3 py-2.5 text-xs font-medium text-zinc-800 has-[:checked]:border-zinc-400 has-[:checked]:bg-zinc-50"
                    >
                      <input
                        type="radio"
                        name="report"
                        value={opt.value}
                        checked={reportChoice === opt.value}
                        onChange={() => setReportChoice(opt.value)}
                        className="mt-0.5 h-3.5 w-3.5 border-zinc-300 text-zinc-900"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={resetReportModal}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!reportChoice || reportSubmitting}
                    className="h-10 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {reportSubmitting ? "Sending…" : "Submit report"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
