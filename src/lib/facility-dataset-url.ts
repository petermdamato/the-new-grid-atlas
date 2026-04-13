/**
 * Browser-visible URL for the data-center FeatureCollection JSON.
 * Served via a generic API route so the Network tab does not show a literal
 * `data_centers.geojson` path (not a security boundary — responses are still inspectable).
 */
export const DATA_CENTER_GEOJSON_URL = "/api/v1/dtc";
