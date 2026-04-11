/**
 * Geocode a US address with Mapbox; returns WGS84 coords and two-letter state code when available.
 */
export type GeocodeOk = { ok: true; lat: number; lng: number; stateCode: string };
export type GeocodeErr = { ok: false; message: string };
export type GeocodeResult = GeocodeOk | GeocodeErr;

export async function geocodeUSAddress(address: string): Promise<GeocodeResult> {
  const token = process.env.MAPBOX_SECRET_TOKEN;
  if (!token) {
    return { ok: false, message: "Geocoding is not configured" };
  }

  const geoRes = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}`
  );

  if (!geoRes.ok) {
    return { ok: false, message: "Geocoding failed" };
  }

  const geo = await geoRes.json();

  if (!geo.features || geo.features.length === 0) {
    return { ok: false, message: "Address not found" };
  }

  const feature = geo.features[0];
  const [lng, lat] = feature.center;

  let stateCode: string | null = null;
  if (feature.context) {
    const region = feature.context.find((c: { id: string; short_code?: string }) => c.id.startsWith("region."));
    if (region?.short_code) {
      if (region.short_code.startsWith("US-")) {
        stateCode = region.short_code.split("-")[1].toUpperCase();
      } else if (region.short_code.length === 2) {
        stateCode = region.short_code.toUpperCase();
      }
    }
  }

  if (!stateCode && feature.id?.startsWith("region.") && feature.properties?.short_code) {
    const sc = feature.properties.short_code;
    if (sc.startsWith("US-")) {
      stateCode = sc.split("-")[1].toUpperCase();
    } else if (sc.length === 2) {
      stateCode = sc.toUpperCase();
    }
  }

  if (!stateCode) {
    return { ok: false, message: "Could not determine state from address" };
  }

  return { ok: true, lat, lng, stateCode };
}
