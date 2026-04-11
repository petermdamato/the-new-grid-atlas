async function test() {
  const address = "San Juan, PR";
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${process.env.MAPBOX_TOKEN}&country=us`;
  
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.features && data.features.length > 0) {
    const feature = data.features[0];
    console.log("Feature ID:", feature.id);
    console.log("Properties:", feature.properties);
    console.log("Context:", JSON.stringify(feature.context, null, 2));
  } else {
    console.log("No features");
  }
}

test();
