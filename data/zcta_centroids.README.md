# ZCTA centroids for AI map queries (zip → nearest facility)

The NL→SQL DuckDB path can join **`zip_centroids`** (USPS/ZIP-style 5-digit ZCTA code + internal point from Census) to **`data_centers`** or **`warehouses`** to rank by spherical distance using the built-in **`haversine_km(lat1, lon1, lat2, lon2)`** macro.

## Build `zcta_centroids.csv`

1. Download the **2020 ZCTA Gazetteer** zip from the U.S. Census Bureau (search for `2020_Gaz_zcta_national` if the link moves):

   `https://www2.census.gov/geo/docs/maps/data_data/gazetteer/2020_Gazetteer/2020_Gaz_zcta_national.zip`

2. Unzip so you have `2020_Gaz_zcta_national.txt` (tab-separated).

3. From the repo root:

   ```bash
   node scripts/build_zcta_centroids.mjs /path/to/2020_Gaz_zcta_national.txt
   ```

4. Confirm **`data/zcta_centroids.csv`** exists (gitignored; ~33k rows).

If the file is missing, DuckDB still exposes an **empty** `zip_centroids` table so queries do not fail at parse time.

## Example: closest data center to ZIP 47201

Map pins use **`dc_latitude` / `dc_longitude`** when present (see app mapper); always include them when returning facilities.

```sql
SELECT
  dc.id,
  dc.name AS data_center_name,
  dc.address AS data_center_address,
  dc.company_name AS data_center_company,
  dc.latitude AS dc_latitude,
  dc.longitude AS dc_longitude,
  z.zip_code,
  haversine_km(z.latitude, z.longitude, dc.latitude, dc.longitude) AS distance_km
FROM data_centers AS dc
CROSS JOIN (
  SELECT zip_code, latitude, longitude
  FROM zip_centroids
  WHERE zip_code = '47201'
) AS z
ORDER BY distance_km ASC
LIMIT 5
```

ZCTA boundaries differ slightly from USPS ZIP; for strict USPS matching use a USPS crosswalk dataset instead.
