import { NextResponse } from "next/server";
import * as turf from "@turf/turf";
import { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";
import { geocodeUSAddress } from "@/lib/mapboxGeocode";
import { loadStateFeatureCollection } from "@/lib/boundaryGeojson";

const stateCache: Record<string, FeatureCollection> = {};

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
      return NextResponse.json({ features: [], reason: geo.message });
    }

    const { lat, lng, stateCode } = geo;

    const features = await findAllElectricContainingPoint(lat, lng, stateCode);
    if (features.length > 0) {
      return NextResponse.json({ features, center: [lng, lat] as [number, number] });
    }
    return NextResponse.json({ features: [], reason: "No electric retail service territory found for this address." });
  } catch (e) {
    console.error("lookup-electric:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function findAllElectricContainingPoint(
  lat: number,
  lng: number,
  stateCode: string
): Promise<Feature[]> {
  const cacheKey = `electric_${stateCode}`;
  let geojson = stateCache[cacheKey];

  if (!geojson) {
    const loaded = await loadStateFeatureCollection("electric-boundaries", stateCode);
    if (!loaded) return [];
    geojson = loaded;
    stateCache[cacheKey] = geojson;
  }

  const point = turf.point([lng, lat]);
  const inside: Feature[] = [];

  for (const feature of geojson.features) {
    if (!feature.geometry) continue;
    try {
      if (turf.booleanPointInPolygon(point, feature as Feature<Polygon | MultiPolygon>)) {
        inside.push(feature as Feature);
      }
    } catch {
      continue;
    }
  }

  if (inside.length === 0) return [];

  inside.sort((a, b) => {
    const areaA = turf.area(a as Feature<Polygon | MultiPolygon>);
    const areaB = turf.area(b as Feature<Polygon | MultiPolygon>);
    return areaA - areaB;
  });

  return inside.map((f, index) => {
    const clone = JSON.parse(JSON.stringify(f)) as Feature;
    if (!clone.properties) clone.properties = {};
    clone.properties.utilityType = "electric";
    clone.properties.systemType = "Electric";
    clone.properties.electricIndex = index;
    return clone;
  });
}
