"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { canSaveNotificationPrefs, isValidUsZip } from "@/lib/zip";

export type SavedPrefs = { zipCode: string; notifyNewDataCenters: boolean };

type Props = {
  initialZip: string;
  initialNotify: boolean;
  /** When true, PATCH sets onboardingDone on the user */
  completeOnboarding: boolean;
  onSaved: (values: SavedPrefs) => void | Promise<void>;
  showDisclaimer?: boolean;
  submitLabel?: string;
  showBackLink?: boolean;
  /** Main line for the notification checkbox */
  notifyCheckboxPrimary?: string;
  /** Smaller muted line; omit or pass null/empty to hide */
  notifyCheckboxSecondary?: string | null;
};

export default function DataCenterPreferencesForm({
  initialZip,
  initialNotify,
  completeOnboarding,
  onSaved,
  showDisclaimer,
  submitLabel = "Save",
  showBackLink = true,
  notifyCheckboxPrimary = "Send me an email notification about new data centers near me",
  notifyCheckboxSecondary = "(Your ZIP code is required for this option.)",
}: Props) {
  const [zipCode, setZipCode] = useState(initialZip);
  const [notifyNewDataCenters, setNotifyNewDataCenters] = useState(initialNotify);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = useMemo(
    () => canSaveNotificationPrefs(zipCode, notifyNewDataCenters),
    [zipCode, notifyNewDataCenters]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipCode,
          notifyNewDataCenters,
          completeOnboarding,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save");
        return;
      }
      await onSaved({ zipCode, notifyNewDataCenters });
    } finally {
      setSaving(false);
    }
  }

  const zipHint =
    notifyNewDataCenters && zipCode.trim() && !isValidUsZip(zipCode.trim())
      ? "Use 5 digits or ZIP+4 (#####-####)"
      : null;

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 font-jakarta">
      <div>
        <label htmlFor="zip" className="mb-1.5 block text-xs font-semibold text-zinc-600">
          ZIP code <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <input
          id="zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="e.g. 90210 or 90210-1234"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
        />
        {zipHint ? <p className="mt-1 text-xs text-amber-700">{zipHint}</p> : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
        <input
          type="checkbox"
          checked={notifyNewDataCenters}
          onChange={(e) => setNotifyNewDataCenters(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-orange-600"
        />
        <span className="text-sm leading-snug text-zinc-700">
          {notifyCheckboxPrimary}
          {notifyCheckboxSecondary ? (
            <>
              {" "}
              <span className="text-zinc-500">{notifyCheckboxSecondary}</span>
            </>
          ) : null}
        </span>
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {showDisclaimer ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          We never save your searches. Your ZIP code and email are the only data we save.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSave || saving}
        className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-45"
      >
        {saving ? "Saving…" : submitLabel}
      </button>

      {!canSave && notifyNewDataCenters ? (
        <p className="text-center text-xs text-zinc-500">
          Enter a valid ZIP to enable saving with notifications on, or turn notifications off.
        </p>
      ) : null}

      {showBackLink ? (
        <p className="text-center text-xs text-zinc-400">
          <Link href="/" className="font-semibold text-zinc-600 hover:text-zinc-900">
            Back to map
          </Link>
        </p>
      ) : null}
    </form>
  );
}
