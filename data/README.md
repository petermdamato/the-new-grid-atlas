# Boundary data (not in Git)

Per-state GeoJSON for PWS and electric lookups lives under:

- `cws-boundaries/by-state/*.geojson`
- `wsa-boundaries/by-state/*.geojson`
- `other-boundaries/by-state/*.geojson`
- `electric-boundaries/by-state/*.geojson`

Generate these with the `scripts/export_*.py` / `split_electric_by_state` pipeline, or restore from backup.

**Production:** set `BOUNDARIES_BASE_URL` to your public R2 (or CDN) base and run `npm run upload:boundaries-r2` once credentials are in `.env` (see `.env.example`).

**Local dev:** with `BOUNDARIES_BASE_URL` unset, the API reads from this `data/` tree, so keep a copy on disk for development.

**ZCTA / ZIP centroids (AI map SQL):** optional `zcta_centroids.csv` for nearest-facility queries — see [zcta_centroids.README.md](./zcta_centroids.README.md) and `npm run build:zcta-centroids -- <path-to-2020_Gaz_zcta_national.txt>`.
