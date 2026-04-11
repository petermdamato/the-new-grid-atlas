import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFacilityUpdateBody } from "@/lib/facility-updates";

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

  const parsed = parseFacilityUpdateBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { body } = parsed;
  const s = body.snapshot;
  const { error: insertError } = await supabase.from("facility_updates").insert({
    submitted_by: user.id,
    facility_type: body.facilityType,
    facility_record_id: body.facilityRecordId,
    report_option: body.reportOption,
    facility_name: s.facilityName,
    address: s.address,
    postal: s.postal,
    company_name: s.companyName,
    latitude: s.latitude,
    longitude: s.longitude,
    capacity_type: s.capacityType,
    warehouse_group: s.warehouseGroup,
    warehouse_type_raw: s.warehouseTypeRaw,
    location_region: s.locationRegion,
  });

  if (insertError) {
    return insertErrorResponse("facility_updates", insertError);
  }

  return NextResponse.json({ ok: true });
}

function insertErrorResponse(
  table: string,
  insertError: { message?: string; code?: string }
) {
  console.error(`${table} insert:`, insertError);
  const msg = insertError.message ?? "";
  const code = String(insertError.code ?? "");
  let error =
    code === "42P01" || /relation .* does not exist/i.test(msg)
      ? `The ${table} table is missing. Run Supabase migrations.`
      : code === "42501" || /row-level security/i.test(msg)
        ? "Database blocked this insert (RLS). Ensure migrations ran and you are signed in."
        : msg.includes(table)
          ? msg
          : "Could not save your submission. Try again later.";
  if (process.env.NODE_ENV === "development") {
    error = `${error} (${code}: ${msg})`;
  }
  return NextResponse.json({ error }, { status: 500 });
}
