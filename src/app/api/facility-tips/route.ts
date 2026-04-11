import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractUrlsAndRemainingText,
  FACILITY_TIP_SUBMISSION_MISSING_DATA_CENTER,
  parseFacilityTipBody,
  parseMissingDataCenterMapTipBody,
} from "@/lib/facility-tips";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to submit." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const kind =
    json && typeof json === "object" ? (json as Record<string, unknown>).submissionKind : undefined;

  if (kind === FACILITY_TIP_SUBMISSION_MISSING_DATA_CENTER) {
    const parsed = parseMissingDataCenterMapTipBody(json);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const b = parsed.body;
    const { urls, text: articleText } = extractUrlsAndRemainingText(b.articleOrListing);
    const confirmation_link = urls.length > 0 ? urls.join(",") : null;

    const locLines =
      b.locationKind === "mailing_address"
        ? [
            "Source: map — proposed data center (not on map yet)",
            b.streetAddress,
            [b.city, b.stateProvince, b.postalCode].filter(Boolean).join(", "),
          ]
        : [
            "Source: map — proposed data center (not on map yet)",
            `Coordinates: ${b.latitude}, ${b.longitude}`,
          ];
    const noteParts = [...locLines, articleText].filter(Boolean) as string[];
    const note = noteParts.join("\n\n") || null;

    const { error: insertError } = await supabase.from("facility_tips").insert({
      submitted_by: user.id,
      facility_type: "data_center",
      facility_subtype: null,
      facility_record_id: null,
      confirmation_link,
      note,
      facility_name: b.suggestedFacilityName,
      address: b.streetAddress,
      postal: b.postalCode,
      company_name: null,
      longitude: b.longitude,
      latitude: b.latitude,
      capacity_type: null,
      warehouse_group: null,
      warehouse_type_raw: null,
      location_region: null,
    });

    if (insertError) {
      return facilityTipsInsertErrorResponse(insertError);
    }
    return NextResponse.json({ ok: true });
  }

  const parsed = parseFacilityTipBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { body } = parsed;
  const confirmation_link = body.confirmationLinks.join(",");

  const { error: insertError } = await supabase.from("facility_tips").insert({
    submitted_by: user.id,
    facility_type: body.facilityType,
    facility_subtype: body.facilitySubtype || null,
    facility_record_id: body.facilityRecordId,
    confirmation_link,
    note: body.note,
    facility_name: body.snapshot.facilityName || null,
    address: body.snapshot.address || null,
    postal: body.snapshot.postal || null,
    company_name: body.snapshot.companyName || null,
    longitude: body.snapshot.longitude,
    latitude: body.snapshot.latitude,
    capacity_type: body.snapshot.capacityType || null,
    warehouse_group: body.snapshot.warehouseGroup || null,
    warehouse_type_raw: body.snapshot.warehouseTypeRaw || null,
    location_region: body.snapshot.locationRegion || null,
  });

  if (insertError) {
    return facilityTipsInsertErrorResponse(insertError);
  }

  return NextResponse.json({ ok: true });
}

function facilityTipsInsertErrorResponse(insertError: { message?: string; code?: string }) {
  console.error("facility_tips insert:", insertError);
  const msg = insertError.message ?? "";
  const code = String(insertError.code ?? "");
  const schemaCache = /schema cache/i.test(msg);
  let error = schemaCache
    ? "The API does not see public.facility_tips yet. Apply migrations (supabase db push, or paste supabase/migrations/*facility_tips*.sql in the SQL editor). If the table already exists, reload the PostgREST schema (NOTIFY pgrst, 'reload schema'; or wait a minute)."
    : code === "42P01" || /relation .* does not exist/i.test(msg)
      ? "The facility_tips table is missing. Run Supabase migrations (see supabase/migrations)."
      : code === "42501" || /row-level security/i.test(msg)
        ? "Database blocked this insert (RLS). Ensure migrations ran and you are signed in."
        : msg.includes("facility_tips")
          ? msg
          : "Could not save your submission. Try again later.";
  if (process.env.NODE_ENV === "development") {
    error = `${error} (${code}: ${msg})`;
  }
  return NextResponse.json({ error }, { status: 500 });
}
