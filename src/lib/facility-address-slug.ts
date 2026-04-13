import type { Feature } from "geojson";

export type FacilityUrlKind = "data-center" | "warehouse";

/** URL path segment: street-city-state-postal (each part slugified, joined with hyphens). */
export type FacilityAddressSlugParts = {
  street: string;
  city: string;
  state: string;
  postal: string;
};

function slugifyPart(raw: string, maxLen = 72): string {
  const t = raw.trim();
  if (!t) return "";
  const s = t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!s) return "";
  return s.length > maxLen ? s.slice(0, maxLen).replace(/-$/, "") : s;
}

/** Extract 5-digit ZIP from anywhere in the string. */
function extractZip(s: string): string {
  const m = s.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m?.[1] ?? "";
}

/**
 * Best-effort US-style parse from geojson `address` (+ optional `postal`, warehouse `locationRegion`).
 */
export function parseAddressFieldsForSlug(
  props: Record<string, string | number | undefined> | undefined,
  kind: FacilityUrlKind
): FacilityAddressSlugParts {
  const rawAddr = String(props?.address ?? "").trim();
  let postal = String(props?.postal ?? "").replace(/\D/g, "").slice(0, 5);
  if (!postal) postal = extractZip(rawAddr);

  let work = rawAddr
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .replace(/\s+,/g, ",")
    .trim();
  work = work.replace(/,?\s*(United States|USA)\s*$/i, "").trim();
  work = work.replace(/,?\s*[^,]+ County\s*$/i, "").trim();

  const parts = work.split(",").map((p) => p.trim()).filter(Boolean);

  let street = "";
  let city = "";
  let state = "";

  if (parts.length === 0) {
    street = rawAddr;
  } else if (parts.length === 1) {
    street = parts[0]!;
  } else if (parts.length === 2) {
    const a = parts[0]!;
    const b = parts[1]!;
    const m = b.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (m) {
      street = a;
      city = m[1]!.trim();
      state = m[2]!.toUpperCase();
    } else {
      street = a;
      const m2 = b.match(/^([A-Za-z]{2})\s+(\d{5})\s*$/);
      if (m2) {
        state = m2[1]!.toUpperCase();
        if (!postal) postal = m2[2]!;
      } else {
        city = b;
      }
    }
  } else {
    const last = parts[parts.length - 1]!;
    const penult = parts[parts.length - 2]!;
    const mZip = last.match(/^([A-Za-z]{2})\s+(\d{5})\s*$/i);
    if (mZip) {
      state = mZip[1]!.toUpperCase();
      if (!postal) postal = mZip[2]!;
      city = penult;
      street = parts.slice(0, -2).join(", ");
    } else if (/^[A-Za-z][A-Za-z\s.]+$/.test(last) && last.length <= 40) {
      state = last;
      city = penult;
      street = parts.slice(0, -2).join(", ");
    } else {
      state = last;
      city = penult;
      street = parts.slice(0, -2).join(", ");
    }
  }

  if (!state && kind === "warehouse") {
    state = String(props?.locationRegion ?? "").trim();
  }

  return {
    street: street || rawAddr,
    city,
    state,
    postal,
  };
}

function coordsFallbackSlug(feature: Feature): string {
  if (feature.geometry?.type !== "Point") return "facility";
  const [lng, lat] = feature.geometry.coordinates as [number, number];
  const la = slugifyPart(lat.toFixed(4).replace(".", "p"));
  const lo = slugifyPart(lng.toFixed(4).replace(".", "p"));
  return la && lo ? `at-${la}-${lo}` : "facility";
}

/** Base slug before duplicate suffix (-2, -3, …). */
export function baseSlugFromGeoFeature(feature: Feature, kind: FacilityUrlKind): string {
  const props = feature.properties as Record<string, string | number | undefined> | undefined;
  const { street, city, state, postal } = parseAddressFieldsForSlug(props, kind);
  const a = slugifyPart(street);
  const b = slugifyPart(city);
  const c = slugifyPart(state);
  const z = slugifyPart(postal.replace(/\D/g, ""), 12);
  const segments = [a, b, c, z].filter(Boolean);
  let base = segments.join("-");
  if (!base) {
    base = slugifyPart(String(props?.address ?? ""), 120) || coordsFallbackSlug(feature);
  }
  return base || "facility";
}

/**
 * Deterministic slug for a feature; must use the same ordered `allInFileOrder` array as the static geojson.
 */
export function facilityUrlSlugForFeature(feature: Feature, kind: FacilityUrlKind, allInFileOrder: Feature[]): string {
  const base = baseSlugFromGeoFeature(feature, kind);
  let duplicateIndex = 0;
  for (const other of allInFileOrder) {
    if (other === feature) {
      return duplicateIndex === 0 ? base : `${base}-${duplicateIndex + 1}`;
    }
    if (baseSlugFromGeoFeature(other, kind) === base) {
      duplicateIndex++;
    }
  }
  return base;
}

/**
 * Same URL slugs as {@link facilityUrlSlugForFeature} for each feature in file order, in O(n) time
 * (avoids O(n²) scans when listing thousands of facilities).
 */
export function facilityUrlSlugsInFileOrder(features: Feature[], kind: FacilityUrlKind): string[] {
  const bases = features.map((f) => baseSlugFromGeoFeature(f, kind));
  const slugs: string[] = [];
  const ordinal = new Map<string, number>();
  for (let i = 0; i < features.length; i++) {
    const base = bases[i]!;
    const k = (ordinal.get(base) ?? 0) + 1;
    ordinal.set(base, k);
    slugs.push(k === 1 ? base : `${base}-${k}`);
  }
  return slugs;
}

export function findFacilityByUrlSlug(
  fc: { features: Feature[] } | null,
  kind: FacilityUrlKind,
  slug: string
): Feature | null {
  if (!fc?.features?.length) return null;
  const { features } = fc;
  for (const f of features) {
    if (facilityUrlSlugForFeature(f, kind, features) === slug) return f;
  }
  return null;
}

/** Stable record id for APIs / Supabase (never shown in the URL). */
export function facilityRecordKeyFromFeature(feature: Feature, kind: FacilityUrlKind): string {
  const p = feature.properties as Record<string, string | number | undefined> | undefined;
  if (kind === "warehouse") return String(p?.code ?? "");
  return String(p?.id ?? "");
}

/** Map popup / page title: street line only (no warehouse site codes). */
export function warehouseStreetHeading(
  props: Record<string, string | number | undefined> | undefined
): string {
  const addr = String(props?.address ?? "").trim();
  const first = addr.split(",")[0]?.trim();
  if (first) return first;
  return String(props?.companyName ?? "Amazon");
}
