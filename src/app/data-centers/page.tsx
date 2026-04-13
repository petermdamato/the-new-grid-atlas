import fs from "fs/promises";
import path from "path";
import Link from "next/link";
import type { Feature, FeatureCollection } from "geojson";
import { ArrowLeft } from "lucide-react";
import { facilityUrlSlugsInFileOrder } from "@/lib/facility-address-slug";

/** Re-read if the GeoJSON is updated without a full redeploy (optional). */
export const revalidate = 3600;

function displayName(f: Feature): string {
  const p = f.properties as Record<string, unknown> | undefined;
  const n = String(p?.name ?? "").trim();
  return n || "Unnamed facility";
}

async function loadRows(): Promise<{ rows: { name: string; slug: string }[]; error: string | null }> {
  try {
    const fp = path.join(process.cwd(), "public", "data_centers.geojson");
    const raw = await fs.readFile(fp, "utf8");
    const fc = JSON.parse(raw) as FeatureCollection;
    if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features) || fc.features.length === 0) {
      return { rows: [], error: null };
    }
    const all = fc.features;
    const slugs = facilityUrlSlugsInFileOrder(all, "data-center");
    const rows = all
      .map((f, i) => ({
        name: displayName(f),
        slug: slugs[i] ?? "",
      }))
      .filter((r) => r.slug)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return { rows, error: null };
  } catch {
    return { rows: [], error: "Could not load data centers." };
  }
}

export default async function DataCentersByNamePage() {
  const { rows, error } = await loadRows();

  return (
    <main className="min-h-screen w-full bg-gray-50 font-jakarta text-zinc-900">
      <div className="mx-auto max-w-2xl px-5 pb-16 pt-20 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to map
        </Link>

        <header className="mb-8">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">Directory</p>
          <h1 className="text-2xl font-bold leading-tight text-zinc-900">Data centers by name</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            Facilities are listed A–Z. Each name opens the facility detail page.
          </p>
        </header>

        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No data centers found.</p>
        ) : (
          <nav aria-label="Data centers A–Z">
            <ol className="divide-y divide-zinc-200/90 rounded-2xl border border-zinc-200/80 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              {rows.map(({ name, slug }) => (
                <li key={slug}>
                  <Link
                    href={`/facility/data-center/${encodeURIComponent(slug)}`}
                    className="block px-4 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-zinc-50 hover:text-blue-900 sm:px-5 sm:py-3.5"
                  >
                    {name}
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-center text-[11px] text-zinc-400">{rows.length} locations</p>
          </nav>
        )}
      </div>
    </main>
  );
}
