"use client";

import Link from "next/link";
import { useState } from "react";
import { isHttpUrl, splitUrlInput } from "@/lib/data-center-confirmation";
import type { FacilityTipSnapshot } from "@/lib/facility-tips";

export type FacilityConfirmationKind = "data-center" | "warehouse";

export type DataCenterConfirmationFormProps = {
  kind?: FacilityConfirmationKind;
  /** Internal geojson key (numeric DC id or warehouse code) for the API — not shown in the URL. */
  facilityId: string;
  facilityName: string;
  /** e.g. Hyperscaler (DC) or FC / DC / Other (warehouse). */
  facilitySubtype: string;
  snapshot: FacilityTipSnapshot;
  authLoading: boolean;
  signedIn: boolean;
};

export default function DataCenterConfirmationForm({
  kind = "data-center",
  facilityId,
  facilityName,
  facilitySubtype,
  snapshot,
  authLoading,
  signedIn,
}: DataCenterConfirmationFormProps) {
  const [linksRaw, setLinksRaw] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const idPrefix = kind === "warehouse" ? "wh-confirm" : "dc-confirm";
  const siteNoun = kind === "warehouse" ? "fulfillment or warehouse site" : "site";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setServerError(null);
    const urls = splitUrlInput(linksRaw);
    if (urls.length === 0) {
      setError("Add at least one link (news article, press release, or official company page).");
      return;
    }
    const bad = urls.find((u) => !isHttpUrl(u));
    if (bad) {
      setError(`Each entry must be a full URL starting with http:// or https://. Problem: ${bad.slice(0, 80)}${bad.length > 80 ? "…" : ""}`);
      return;
    }
    if (!signedIn) {
      setServerError("Sign in to submit.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/facility-tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityType: kind === "warehouse" ? "warehouse" : "data_center",
          facilitySubtype,
          facilityRecordId: facilityId,
          confirmationLinks: urls,
          note: note.trim() ? note.trim() : null,
          snapshot,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setServerError(data.error ?? "Could not save. Try again.");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setServerError("Network error. Try again.");
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-4">
        <h2 className="text-xs font-bold text-emerald-950">Thanks for helping</h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-900/90">
          Your sources were saved. We will review them for <span className="font-semibold">{facilityName}</span>.
        </p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="mt-8 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-4">
        <p className="text-xs text-zinc-500">Checking account…</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="mt-8 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-4">
        <h2 className="text-xs font-bold text-zinc-900">Help us confirm this location</h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
          <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-800">
            Sign up
          </Link>{" "}
          or{" "}
          <Link href="/account" className="font-semibold text-blue-600 hover:text-blue-800">
            sign in
          </Link>{" "}
          to submit news articles, press releases, or listings that document this {siteNoun}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-xl border border-zinc-200/90 bg-zinc-50/80 px-4 py-4">
      <h2 className="text-xs font-bold text-zinc-900">Help us confirm this location</h2>
      <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-600">
        This is separate from the map &ldquo;Submit a tip&rdquo; form (for missing or new facilities). Here, add links
        that document <span className="font-medium text-zinc-800">this</span> {siteNoun} — news, press release, or
        company-provided listing.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor={`${idPrefix}-links`} className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Source link(s)
          </label>
          <textarea
            id={`${idPrefix}-links`}
            value={linksRaw}
            onChange={(e) => setLinksRaw(e.target.value)}
            rows={3}
            placeholder="Enter a link or multiple links separated by a comma"
            className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            disabled={submitting}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-note`} className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Note <span className="font-normal normal-case text-zinc-400">(optional)</span>
          </label>
          <textarea
            id={`${idPrefix}-note`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. which building or phase the article refers to"
            className="mt-1.5 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            disabled={submitting}
          />
        </div>
        {error ? <p className="text-[11px] font-medium text-red-700">{error}</p> : null}
        {serverError ? <p className="text-[11px] font-medium text-red-700">{serverError}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Submit confirmation"}
        </button>
      </form>
    </div>
  );
}
