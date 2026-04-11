import type { SupabaseClient } from "@supabase/supabase-js";

export type DataCenterConfirmationRow = {
  data_center_id: string;
  confirmed: boolean;
  confirmation_link: string | null;
};

/** Split comma-separated confirmation_link into trimmed URL strings. */
export function parseConfirmationUrls(confirmationLink: string | null | undefined): string[] {
  if (!confirmationLink?.trim()) return [];
  return confirmationLink
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse user-entered link field: commas or newlines, trimmed, non-empty. */
export function splitUrlInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export type DataCenterConfirmationValue = {
  confirmed: boolean;
  confirmation_link: string | null;
};

/** Load every row for map tooltips (one request batch; paginated past PostgREST default limit). */
export async function fetchAllDataCenterConfirmations(
  supabase: SupabaseClient
): Promise<globalThis.Map<string, DataCenterConfirmationValue>> {
  const out = new globalThis.Map<string, DataCenterConfirmationValue>();
  const pageSize = 1000;
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("data_center_confirmations")
      .select("data_center_id, confirmed, confirmation_link")
      .order("data_center_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("data_center_confirmations fetch all:", error.message);
      return out;
    }
    if (!data?.length) break;

    for (const row of data) {
      const id = row.data_center_id;
      if (typeof id !== "string" || !id) continue;
      out.set(id, {
        confirmed: Boolean(row.confirmed),
        confirmation_link: row.confirmation_link ?? null,
      });
    }

    if (data.length < pageSize) break;
    from += pageSize;
  }

  return out;
}

export async function fetchDataCenterConfirmation(
  supabase: SupabaseClient,
  dataCenterId: string
): Promise<{ confirmed: boolean; confirmation_link: string | null } | null> {
  const { data, error } = await supabase
    .from("data_center_confirmations")
    .select("confirmed, confirmation_link")
    .eq("data_center_id", dataCenterId)
    .maybeSingle();

  if (error) {
    console.warn("data_center_confirmations lookup:", error.message);
    return null;
  }
  if (!data) {
    return { confirmed: false, confirmation_link: null };
  }
  return {
    confirmed: Boolean(data.confirmed),
    confirmation_link: data.confirmation_link ?? null,
  };
}
