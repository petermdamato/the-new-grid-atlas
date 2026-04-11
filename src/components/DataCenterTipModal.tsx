"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export interface DataCenterTipModalProps {
  open: boolean;
  onClose: () => void;
}

function trim(s: string) {
  return s.trim();
}

function parseCoord(s: string): number | null {
  const n = Number.parseFloat(trim(s));
  return Number.isFinite(n) ? n : null;
}

export default function DataCenterTipModal({ open, onClose }: DataCenterTipModalProps) {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [articleOrListing, setArticleOrListing] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showThanks, setShowThanks] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setName("");
    setAddress("");
    setCity("");
    setState("");
    setPostalCode("");
    setLat("");
    setLon("");
    setArticleOrListing("");
    setError(null);
    setShowThanks(false);
    setSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("Sign in to submit a tip.");
      return;
    }

    const addrOk =
      trim(address) && trim(city) && trim(state) && trim(postalCode);

    const la = parseCoord(lat);
    const lo = parseCoord(lon);
    const coordsOk =
      la != null &&
      lo != null &&
      la >= -90 &&
      la <= 90 &&
      lo >= -180 &&
      lo <= 180;

    if (!addrOk && !coordsOk) {
      setError(
        "Provide a full mailing address (street, city, state, and postal code) or valid latitude and longitude."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/facility-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionKind: "missing_data_center",
          suggestedFacilityName: trim(name) || null,
          locationKind: addrOk ? "mailing_address" : "coordinates",
          streetAddress: addrOk ? trim(address) : null,
          city: addrOk ? trim(city) : null,
          stateProvince: addrOk ? trim(state) : null,
          postalCode: addrOk ? trim(postalCode) : null,
          latitude: coordsOk ? la : null,
          longitude: coordsOk ? lo : null,
          articleOrListing: trim(articleOrListing) || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save your tip.");
        setSubmitting(false);
        return;
      }
      setShowThanks(true);
    } catch {
      setError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-4 pb-10 sm:items-center sm:p-6 sm:pb-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dc-tip-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px]"
        aria-label="Close tip form"
        onClick={handleClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/50 bg-[#FAFAFA] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.18)] font-jakarta sm:p-8">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <Lightbulb className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 id="dc-tip-title" className="text-base font-bold text-zinc-900">
                Submit a data center tip
              </h2>
              <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                Help us add a missing facility. Signed-in users only; your tip is saved to our database.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {showThanks ? (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/80 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-zinc-900">Thanks for the tip.</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              We received your submission and will review it for the map.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-4 h-10 w-full rounded-xl bg-zinc-900 text-xs font-semibold text-white hover:bg-zinc-800 sm:w-auto sm:px-6"
            >
              Close
            </button>
          </div>
        ) : authLoading ? (
          <p className="text-center text-xs text-zinc-500">Checking account…</p>
        ) : !user ? (
          <div className="rounded-xl border border-zinc-200/80 bg-white/80 px-4 py-5 text-center">
            <p className="text-sm font-medium text-zinc-800">Sign in to submit a tip</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-800">
                Sign up
              </Link>{" "}
              or{" "}
              <Link href="/account" className="font-semibold text-blue-600 hover:text-blue-800">
                sign in
              </Link>{" "}
              to tell us about a data center we should add.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="dc-tip-name" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Data center name
              </label>
              <input
                id="dc-tip-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Data Center Cloud Campus"
                disabled={submitting}
                className="h-10 w-full rounded-xl border border-zinc-200/90 bg-white px-3 text-xs text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 disabled:opacity-60"
              />
            </div>

            <fieldset className="rounded-xl border border-zinc-200/80 bg-white/60 p-3" disabled={submitting}>
              <legend className="px-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Location (address or coordinates — one required)
              </legend>
              <div className="mt-2 space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="dc-tip-address" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      Street address
                    </label>
                    <input
                      id="dc-tip-address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="dc-tip-city" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      City
                    </label>
                    <input
                      id="dc-tip-city"
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="dc-tip-state" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      State / province
                    </label>
                    <input
                      id="dc-tip-state"
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="dc-tip-postal" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      Postal code
                    </label>
                    <input
                      id="dc-tip-postal"
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                </div>
                <p className="text-center text-[10px] font-medium text-zinc-400">or</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="dc-tip-lat" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      Latitude
                    </label>
                    <input
                      id="dc-tip-lat"
                      type="text"
                      inputMode="decimal"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="e.g. 40.7128"
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                  <div>
                    <label htmlFor="dc-tip-lon" className="mb-1 block text-[10px] font-medium text-zinc-500">
                      Longitude
                    </label>
                    <input
                      id="dc-tip-lon"
                      type="text"
                      inputMode="decimal"
                      value={lon}
                      onChange={(e) => setLon(e.target.value)}
                      placeholder="e.g. -74.006"
                      className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-200"
                    />
                  </div>
                </div>
              </div>
            </fieldset>

            <div>
              <label htmlFor="dc-tip-article" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Article, press release, or company listing
              </label>
              <textarea
                id="dc-tip-article"
                value={articleOrListing}
                onChange={(e) => setArticleOrListing(e.target.value)}
                rows={3}
                placeholder="URL or pasted text that supports the tip"
                disabled={submitting}
                className="w-full resize-y rounded-xl border border-zinc-200/90 bg-white px-3 py-2.5 text-xs text-zinc-800 outline-none ring-zinc-300 placeholder:text-zinc-400 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/80 disabled:opacity-60"
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-xl bg-zinc-900 px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit tip"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
