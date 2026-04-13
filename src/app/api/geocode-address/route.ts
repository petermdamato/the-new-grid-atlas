import { NextResponse } from "next/server";
import { geocodeUSAddress } from "@/lib/mapboxGeocode";

/** Geocode only (no utility boundary lookup) — used when utility overlay is Off. */
export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const geo = await geocodeUSAddress(address.trim());
    if (!geo.ok) {
      if (geo.message === "Geocoding failed" || geo.message === "Geocoding is not configured") {
        return NextResponse.json({ error: geo.message }, { status: 500 });
      }
      return NextResponse.json({ reason: geo.message });
    }

    return NextResponse.json({
      center: [geo.lng, geo.lat] as [number, number],
    });
  } catch (e) {
    console.error("geocode-address:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
