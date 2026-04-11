import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as turf from "@turf/turf";
import { FeatureCollection, Feature, Polygon, MultiPolygon } from "geojson";
import { geocodeUSAddress } from "@/lib/mapboxGeocode";

// Simple in-memory cache for state GeoJSON files
const stateCache: Record<string, FeatureCollection> = {};

export async function POST(req: Request) {
  try {
    const { address } = await req.json();

    if (!address) {
      return NextResponse.json({ error: "Address is required" }, { status: 400 });
    }

    const geo = await geocodeUSAddress(typeof address === "string" ? address.trim() : "");
    if (!geo.ok) {
      if (geo.message === "Geocoding failed" || geo.message === "Geocoding is not configured") {
        return NextResponse.json({ error: geo.message }, { status: 500 });
      }
      return NextResponse.json({ features: [], reason: geo.message });
    }

    const { lat, lng, stateCode } = geo;

    // 2️⃣ Spatial lookup in both datasets
    const cwsFeature = await findBestFeature(lat, lng, stateCode, "cws-boundaries", "CWS");
    const otherFeature = await findBestFeature(lat, lng, stateCode, "other-boundaries", "Other");
    const wsaFeature = await findBestFeature(lat, lng, stateCode, "wsa-boundaries", "WSA");

    const features = [];
    if (cwsFeature) features.push(cwsFeature);
    if (otherFeature) features.push(otherFeature);
    if (wsaFeature) features.push(wsaFeature);

    if (features.length > 0) {
      return NextResponse.json({ 
        features,
        center: [lng, lat]
      });
    } else {
      return NextResponse.json({ features: [], reason: "No water system found for this address." });
    }
  } catch (error) {
    console.error("Error in lookup-pws:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function findBestFeature(lat: number, lng: number, stateCode: string, datasetDir: string, systemType: 'CWS' | 'Other' | 'WSA'): Promise<Feature | null> {
  try {
    const cacheKey = `${datasetDir}_${stateCode}`;
    let geojson = stateCache[cacheKey];

    if (!geojson) {
      const filePath = path.join(process.cwd(), "data", datasetDir, "by-state", `${stateCode}.geojson`);
      try {
        const fileContent = await fs.readFile(filePath, "utf8");
        geojson = JSON.parse(fileContent);
        stateCache[cacheKey] = geojson;
      } catch (err) {
        console.error(`Could not load boundary file for state ${stateCode} in ${datasetDir}:`, err);
        return null;
      }
    }

    const point = turf.point([lng, lat]);
    const insideCandidates = [];

    // Find all polygons that contain the point
    for (const feature of geojson.features) {
      if (!feature.geometry) continue;
      
      try {
        if (turf.booleanPointInPolygon(point, feature as Feature<Polygon | MultiPolygon>)) {
          insideCandidates.push(feature);
        }
      } catch {
        continue;
      }
    }

    if (insideCandidates.length > 0) {
      // If multiple candidates, pick the smallest area
      if (insideCandidates.length > 1) {
        insideCandidates.sort((a, b) => {
          const areaA = turf.area(a as Feature<Polygon | MultiPolygon>);
          const areaB = turf.area(b as Feature<Polygon | MultiPolygon>);
          return areaA - areaB;
        });
      }
      const best = insideCandidates[0];
      if (!best.properties) best.properties = {};
      best.properties.systemType = systemType;
      return best;
    }

    // If not inside, check 1-mile buffer
    const searchBuffer = turf.buffer(point, 1, { units: 'miles' });
    if (!searchBuffer) return null;

    const bufferCandidates = [];
    for (const feature of geojson.features) {
      if (!feature.geometry) continue;
      try {
        if (turf.booleanIntersects(searchBuffer, feature as Feature<Polygon | MultiPolygon>)) {
          bufferCandidates.push(feature);
        }
      } catch {
        continue;
      }
    }

    if (bufferCandidates.length > 0) {
      // Sort by distance to centroid
      bufferCandidates.sort((a, b) => {
        const centroidA = turf.centroid(a as Feature<Polygon | MultiPolygon>);
        const centroidB = turf.centroid(b as Feature<Polygon | MultiPolygon>);
        return turf.distance(point, centroidA) - turf.distance(point, centroidB);
      });
      const best = bufferCandidates[0];
      if (!best.properties) best.properties = {};
      best.properties.systemType = systemType;
      return best;
    }

    return null;
  } catch (err) {
    console.error(`Error in findBestFeature for ${datasetDir}:`, err);
    return null;
  }
}
