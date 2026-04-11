import os
import geopandas as gpd

def main():
    shp_path = 'public/epa_water_systems/Public_SupplyWa/WSA_v1/WSA_v1.shp'
    out_dir = 'data/wsa-boundaries/by-state'

    os.makedirs(out_dir, exist_ok=True)

    print("Reading features from Shapefile...")
    gdf = gpd.read_file(shp_path)

    print(f"Loaded {len(gdf)} features.")
    
    # Let's map STATE_NAME to 2-letter state codes
    state_map = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
        'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
        'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
        'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
        'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
        'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
        'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
        'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
        'District of Columbia': 'DC', 'Puerto Rico': 'PR'
    }
    
    gdf['State'] = gdf['STATE_NAME'].map(state_map)
    
    # Rename for consistency
    gdf = gdf.rename(columns={'WSA_AGIDF': 'PWSID', 'WSA_NAME': 'PWS_Name'})
    
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
