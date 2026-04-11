import os
import geopandas as gpd

def main():
    shp_path = 'public/epa_water_systems/Public_SupplyWa/V1_GU_wWS/v1_GU_wWS.shp'
    out_dir = 'data/other-boundaries/by-state'

    os.makedirs(out_dir, exist_ok=True)

    print("Reading features from Shapefile...")
    gdf = gpd.read_file(shp_path)

    print(f"Loaded {len(gdf)} features.")
    
    # Extract state code from PWS_ID (first 2 chars)
    gdf['State'] = gdf['PWS_ID'].str[:2]
    
    # Rename PWS_ID to PWSID and USEPA_NAME to PWS_Name to match CWS format
    gdf = gdf.rename(columns={'PWS_ID': 'PWSID', 'USEPA_NAME': 'PWS_Name'})
    
    # Keep only necessary columns
    columns_to_keep = ['PWSID', 'PWS_Name', 'State', 'geometry']
    gdf = gdf[columns_to_keep]

    # Reproject to WGS84 (EPSG:4326) for Mapbox/Turf compatibility
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"Reprojecting from {gdf.crs} to EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)

    states = gdf['State'].unique()

    print(f"Found {len(states)} unique states. Writing to GeoJSON...")

    for state in states:
        if not state or len(str(state)) != 2: # Basic validation
            continue
        
        state_gdf = gdf[gdf['State'] == state]
        out_path = os.path.join(out_dir, f"{state}.geojson")
        
        # Save to GeoJSON
        state_gdf.to_file(out_path, driver='GeoJSON')
        print(f"Wrote {len(state_gdf)} features to {out_path}")

    print("Done!")

if __name__ == '__main__':
    main()
