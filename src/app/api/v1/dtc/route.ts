import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET() {
  try {
    const fp = path.join(process.cwd(), "public", "data_centers.geojson");
    const body = await fs.readFile(fp);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
