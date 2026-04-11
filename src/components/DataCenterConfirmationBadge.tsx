"use client";

import { Check } from "lucide-react";

type Props = {
  confirmed: boolean;
  loading?: boolean;
  className?: string;
  /** When confirmed, render only a checkmark (no pill) — for map popups. */
  minimalConfirmed?: boolean;
};

/** Upper-right style tag: Confirmed (check) or Unconfirmed. */
export default function DataCenterConfirmationBadge({
  confirmed,
  loading,
  className = "",
  minimalConfirmed = false,
}: Props) {
  if (loading) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400 ${className}`}
      >
        …
      </span>
    );
  }

  if (confirmed) {
    if (minimalConfirmed) {
      return (
        <span className={`inline-flex shrink-0 items-center justify-center ${className}`} title="Confirmed">
          <Check className="h-4 w-4 stroke-[2.5] text-emerald-600" aria-hidden />
          <span className="sr-only">Confirmed</span>
        </span>
      );
    }
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ${className}`}
      >
        <Check className="h-3 w-3 stroke-[2.5]" aria-hidden />
        Confirmed
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-900 ${className}`}
    >
      Unconfirmed
    </span>
  );
}
