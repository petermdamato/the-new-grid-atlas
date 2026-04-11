import os
import geopandas as gpd

# This script was used to export the EPA Community Water Systems geodatabase
# into per-state GeoJSON files for faster lookup in the API route.
# 
# Requirements:
# pip install geopandas pyogrio

def main():
    gdb_path = '../public/epa_water_systems/CWS_Boundaries_Latest/SAB_1_1.gdb'
    out_dir = '../data/cws-boundaries/by-state'

    os.makedirs(out_dir, exist_ok=True)

    print("Reading features from Geodatabase...")
    gdf = gpd.read_file(gdb_path, layer='Boundaries')

    print(f"Loaded {len(gdf)} features.")

    # Fill missing states with the first 2 characters of PWSID
    missing_state = gdf['State'].isna() | (gdf['State'] == '')
    gdf.loc[missing_state, 'State'] = gdf.loc[missing_state, 'PWSID'].str[:2]

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
        if not state:
            continue
        
        state_gdf = gdf[gdf['State'] == state]
        out_path = os.path.join(out_dir, f"{state}.geojson")
        
        # Save to GeoJSON
        state_gdf.to_file(out_path, driver='GeoJSON')
        print(f"Wrote {len(state_gdf)} features to {out_path}")

    print("Done!")

if __name__ == '__main__':
    main()
