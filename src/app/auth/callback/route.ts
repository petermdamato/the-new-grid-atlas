import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only allow same-origin relative paths (blocks open redirects like //evil.com). */
function safeInternalPath(raw: string | null): string {
  if (!raw) return "/";
  let p = raw.trim();
  try {
    p = decodeURIComponent(p);
  } catch {
    return "/";
  }
  if (!p.startsWith("/") || p.startsWith("//")) return "/";
  if (p.includes("://") || p.includes("\\")) return "/";
  const pathOnly = p.split("?")[0].split("#")[0];
  if (pathOnly.length > 256) return "/";
  return pathOnly || "/";
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/signup?error=auth`);
}
