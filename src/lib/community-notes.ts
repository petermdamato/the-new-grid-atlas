export type CommunityNoteFacilityType = "data_center" | "warehouse";

export function parseCommunityNoteBody(
  raw: unknown
): { ok: true; body: { facilityType: CommunityNoteFacilityType; facilityRecordId: string; note: string } } | { ok: false; error: string } {
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

  const noteRaw = o.note;
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";
  if (!note) {
    return { ok: false, error: "note is required." };
  }

  return { ok: true, body: { facilityType, facilityRecordId, note } };
}
