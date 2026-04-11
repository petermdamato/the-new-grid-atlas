import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseCommunityNoteBody } from "@/lib/community-notes";

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

  const parsed = parseCommunityNoteBody(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { body } = parsed;
  const { error: insertError } = await supabase.from("community_notes").insert({
    submitted_by: user.id,
    facility_type: body.facilityType,
    facility_record_id: body.facilityRecordId,
    note: body.note,
  });

  if (insertError) {
    return insertErrorResponse("community_notes", insertError);
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
