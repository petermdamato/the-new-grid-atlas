async function test() {
  console.log("Step 1: Fetching base page to get cookies...");
  const res1 = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11", {
    redirect: 'manual'
  });
  
  console.log("Status 1:", res1.status);
  console.log("Headers 1:", Object.fromEntries(res1.headers.entries()));
  
  const cookies = res1.headers.get('set-cookie');
  const location = res1.headers.get('location');
  
  console.log("Cookies:", cookies);
  console.log("Location:", location);
  
  let sessionUrl = "https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=NY5503374&clear=11,RIR";
  if (location) {
     // Extract session ID from location if present
     // APEX URLs look like: f?p=APP:PAGE:SESSION:REQUEST:DEBUG:CLEAR:ITEMNAMES:ITEMVALUES
     // Or friendly URLs: /ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?session=12345
     console.log("Following redirect to get session...");
     const res2 = await fetch("https://sdwis.epa.gov" + location, {
         headers: cookies ? { 'Cookie': cookies } : {}
     });
     const text2 = await res2.text();
     console.log("Response 2 length:", text2.length);
  }
}

test();
