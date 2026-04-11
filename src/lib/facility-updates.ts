export const FACILITY_UPDATE_REPORT_OPTIONS = [
  "none_here",
  "wrong_facility",
  "closed",
  "not_open",
] as const;

export type FacilityUpdateReportOption = (typeof FACILITY_UPDATE_REPORT_OPTIONS)[number];

/** Labels for the “details look wrong” modal (values must match DB check constraint). */
export const FACILITY_UPDATE_REPORT_CHOICES: { value: FacilityUpdateReportOption; label: string }[] = [
  { value: "none_here", label: "No data center at this location" },
  { value: "wrong_facility", label: "Wrong facility or company at this location" },
  { value: "closed", label: "Data center closed" },
  { value: "not_open", label: "Data center not opened yet" },
];

export type FacilityUpdateFacilityType = "data_center" | "warehouse";

export type FacilityUpdateSnapshot = {
  facilityName: string | null;
  address: string | null;
  postal: string | null;
  companyName: string | null;
  latitude: number | null;
  longitude: number | null;
  capacityType: string | null;
  warehouseGroup: string | null;
  warehouseTypeRaw: string | null;
  locationRegion: string | null;
};

function readOptionalString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
}

function readOptionalNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

export function parseFacilityUpdateBody(
  raw: unknown
): {
  ok: true;
  body: {
    facilityType: FacilityUpdateFacilityType;
    facilityRecordId: string;
    reportOption: FacilityUpdateReportOption;
    snapshot: FacilityUpdateSnapshot;
  };
} | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Invalid JSON body." };
  }
  const o = raw as Record<string, unknown>;

  const facilityType = o.facilityType;
  if (facilityType !== "data_center" && facilityType !== "warehouse") {
    return { ok: false, error: "facilityType must be data_center or warehouse." };
  }

  const facilityRecordId = typeof o.facilityRecordId === "string" ? o.facilityRecordId.trim() : "";
  if (!facilityRecordId) {
    return { ok: false, error: "facilityRecordId is required." };
  }

  const reportOption = o.reportOption;
  if (typeof reportOption !== "string" || !FACILITY_UPDATE_REPORT_OPTIONS.includes(reportOption as FacilityUpdateReportOption)) {
    return { ok: false, error: "reportOption is invalid." };
  }

  const snap = o.snapshot;
  if (!snap || typeof snap !== "object") {
    return { ok: false, error: "snapshot object is required." };
  }
  const s = snap as Record<string, unknown>;

  const snapshot: FacilityUpdateSnapshot = {
    facilityName: readOptionalString(s.facilityName),
    address: readOptionalString(s.address),
    postal: readOptionalString(s.postal),
    companyName: readOptionalString(s.companyName),
    latitude: readOptionalNumber(s.latitude),
    longitude: readOptionalNumber(s.longitude),
    capacityType: readOptionalString(s.capacityType),
    warehouseGroup: readOptionalString(s.warehouseGroup),
    warehouseTypeRaw: readOptionalString(s.warehouseTypeRaw),
    locationRegion: readOptionalString(s.locationRegion),
  };

  return {
    ok: true,
    body: {
      facilityType,
      facilityRecordId,
      reportOption: reportOption as FacilityUpdateReportOption,
      snapshot,
    },
  };
}
