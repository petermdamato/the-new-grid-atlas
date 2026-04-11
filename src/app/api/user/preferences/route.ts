import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canSaveNotificationPrefs } from "@/lib/zip";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: initialRow, error: selectError } = await supabase
    .from("profiles")
    .select("zip_code, notify_new_data_centers, onboarding_done")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error(selectError);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }

  let row = initialRow;
  if (!row) {
    const { error: insertError } = await supabase.from("profiles").insert({ id: user.id });
    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }
    row = { zip_code: null, notify_new_data_centers: false, onboarding_done: false };
  }

  return NextResponse.json({
    email: user.email ?? "",
    zipCode: row.zip_code ?? "",
    notifyNewDataCenters: Boolean(row.notify_new_data_centers),
    onboardingDone: Boolean(row.onboarding_done),
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const zipRaw = typeof body.zipCode === "string" ? body.zipCode.trim() : "";
    const notifyNewDataCenters = Boolean(body.notifyNewDataCenters);
    const completeOnboarding = Boolean(body.completeOnboarding);

    if (!canSaveNotificationPrefs(zipRaw, notifyNewDataCenters)) {
      return NextResponse.json(
        {
          error:
            "A valid 5-digit ZIP or ZIP+4 (#####-####) is required when email notifications are enabled.",
        },
        { status: 400 }
      );
    }

    const zipCode = zipRaw === "" ? null : zipRaw;

    const { data: current } = await supabase
      .from("profiles")
      .select("onboarding_done")
      .eq("id", user.id)
      .maybeSingle();

    const onboardingDone = completeOnboarding ? true : Boolean(current?.onboarding_done);

    const { error: upsertError } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        zip_code: zipCode,
        notify_new_data_centers: notifyNewDataCenters,
        onboarding_done: onboardingDone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      console.error(upsertError);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
