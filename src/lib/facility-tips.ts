import { isHttpUrl, splitUrlInput } from "@/lib/data-center-confirmation";

export const FACILITY_TIP_SUBMISSION_MISSING_DATA_CENTER = "missing_data_center" as const;

export type FacilityTipFacilityType = "data_center" | "warehouse";

export type MissingDataCenterMapTipBody = {
  suggestedFacilityName: string | null;
  locationKind: "mailing_address" | "coordinates";
  streetAddress: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  articleOrListing: string | null;
};

/** Snapshot of geojson-backed fields at submit time (stored on facility_tips). */
export type FacilityTipSnapshot = {
  facilityName: string;
  address: string;
  postal: string;
  companyName: string;
  latitude: number | null;
  longitude: number | null;
  capacityType: string;
  warehouseGroup: string;
  warehouseTypeRaw: string;
  locationRegion: string;
};

export type FacilityTipSubmitBody = {
  facilityType: FacilityTipFacilityType;
  facilitySubtype: string;
  facilityRecordId: string;
  confirmationLinks: string[];
  note: string | null;
  snapshot: FacilityTipSnapshot;
};

function trimStr(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** Map modal: proposed data center → same `facility_tips` row shape. */
export function parseMissingDataCenterMapTipBody(
  raw: unknown
): { ok: true; body: MissingDataCenterMapTipBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const o = raw as Record<string, unknown>;

  if (o.submissionKind !== FACILITY_TIP_SUBMISSION_MISSING_DATA_CENTER) {
    return { ok: false, error: "Invalid submissionKind for map tip." };
  }

  const suggestedRaw = o.suggestedFacilityName;
  const suggestedFacilityName =
    suggestedRaw == null || suggestedRaw === "" ? null : trimStr(suggestedRaw) || null;

  const kind = o.locationKind;
  if (kind !== "mailing_address" && kind !== "coordinates") {
    return { ok: false, error: "locationKind must be mailing_address or coordinates." };
  }

  const streetAddress = trimStr(o.streetAddress) || null;
  const city = trimStr(o.city) || null;
  const stateProvince = trimStr(o.stateProvince) || null;
  const postalCode = trimStr(o.postalCode) || null;

  let latitude: number | null = null;
  let longitude: number | null = null;
  const latRaw = o.latitude;
  const lonRaw = o.longitude;
  if (latRaw != null && typeof latRaw === "number" && Number.isFinite(latRaw)) {
    latitude = latRaw;
  }
  if (lonRaw != null && typeof lonRaw === "number" && Number.isFinite(lonRaw)) {
    longitude = lonRaw;
  }

  if (kind === "mailing_address") {
    if (!streetAddress || !city || !stateProvince || !postalCode) {
      return {
        ok: false,
        error: "For a mailing address, street, city, state/province, and postal code are required.",
      };
    }
  } else {
    if (latitude == null || longitude == null) {
      return { ok: false, error: "For coordinates, valid latitude and longitude are required." };
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return { ok: false, error: "Latitude must be −90…90 and longitude −180…180." };
    }
  }

  const artRaw = o.articleOrListing;
  const articleOrListing =
    artRaw == null || artRaw === ""
      ? null
      : typeof artRaw === "string"
        ? artRaw.trim() || null
        : null;

  return {
    ok: true,
    body: {
      suggestedFacilityName,
      locationKind: kind,
      streetAddress: kind === "mailing_address" ? streetAddress : null,
      city: kind === "mailing_address" ? city : null,
      stateProvince: kind === "mailing_address" ? stateProvince : null,
      postalCode: kind === "mailing_address" ? postalCode : null,
      latitude: kind === "coordinates" ? latitude : null,
      longitude: kind === "coordinates" ? longitude : null,
      articleOrListing,
    },
  };
}

/** Split pasted text into http(s) URLs vs other lines (comma/newline). */
export function extractUrlsAndRemainingText(raw: string | null): { urls: string[]; text: string | null } {
  if (!raw?.trim()) return { urls: [], text: null };
  const whole = raw.trim();
  if (isHttpUrl(whole)) return { urls: [whole], text: null };
  const segments = splitUrlInput(whole);
  const urls: string[] = [];
  const texts: string[] = [];
  for (const seg of segments) {
    if (isHttpUrl(seg)) urls.push(seg);
    else texts.push(seg);
  }
  const text = texts.length ? texts.join("\n") : null;
  return { urls, text };
}

export function parseFacilityTipBody(raw: unknown): { ok: true; body: FacilityTipSubmitBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const o = raw as Record<string, unknown>;

  if (o.submissionKind === FACILITY_TIP_SUBMISSION_MISSING_DATA_CENTER) {
    return { ok: false, error: "Use the map tip payload shape for missing_data_center." };
  }

  const facilityType = o.facilityType;
  if (facilityType !== "data_center" && facilityType !== "warehouse") {
    return { ok: false, error: "facilityType must be data_center or warehouse." };
  }

  const facilityRecordId = typeof o.facilityRecordId === "string" ? o.facilityRecordId.trim() : "";
  if (!facilityRecordId) {
    return { ok: false, error: "facilityRecordId is required." };
  }

  const facilitySubtype = typeof o.facilitySubtype === "string" ? o.facilitySubtype.trim() : "";

  const linksIn = o.confirmationLinks;
  if (!Array.isArray(linksIn)) {
    return { ok: false, error: "confirmationLinks must be an array of URL strings." };
  }
  const confirmationLinks = linksIn.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean);
  if (confirmationLinks.length === 0) {
    return { ok: false, error: "At least one confirmation link is required." };
  }
  const bad = confirmationLinks.find((u) => !isHttpUrl(u));
  if (bad) {
    return { ok: false, error: "Each link must be a full http(s) URL." };
  }

  const noteRaw = o.note;
  const note =
    noteRaw == null || noteRaw === ""
      ? null
      : typeof noteRaw === "string"
        ? noteRaw.trim() || null
        : null;

  const snap = o.snapshot;
  if (!snap || typeof snap !== "object") {
    return { ok: false, error: "snapshot object is required." };
  }
  const s = snap as Record<string, unknown>;

  const snapshot: FacilityTipSnapshot = {
    facilityName: typeof s.facilityName === "string" ? s.facilityName : "",
    address: typeof s.address === "string" ? s.address : "",
    postal: typeof s.postal === "string" ? s.postal : "",
    companyName: typeof s.companyName === "string" ? s.companyName : "",
    latitude: typeof s.latitude === "number" && Number.isFinite(s.latitude) ? s.latitude : null,
    longitude: typeof s.longitude === "number" && Number.isFinite(s.longitude) ? s.longitude : null,
    capacityType: typeof s.capacityType === "string" ? s.capacityType : "",
    warehouseGroup: typeof s.warehouseGroup === "string" ? s.warehouseGroup : "",
    warehouseTypeRaw: typeof s.warehouseTypeRaw === "string" ? s.warehouseTypeRaw : "",
    locationRegion: typeof s.locationRegion === "string" ? s.locationRegion : "",
  };

  return {
    ok: true,
    body: {
      facilityType,
      facilitySubtype,
      facilityRecordId,
      confirmationLinks,
      note,
      snapshot,
    },
  };
}

/** Same URL parsing as the confirmation form textarea (comma / newline). */
export function parseConfirmationLinksFromRaw(raw: string): string[] {
  return splitUrlInput(raw);
}
