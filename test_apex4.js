async function test() {
  const res = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=FL3421554&clear=11,RIR");
  const html = await res.text();
  
  // Find apex.widget.interactiveReport initialization
  const match = html.match(/apex\.widget\.interactiveReport\(([\s\S]*?)\);/);
  if (match) {
      console.log("Found IR config:", match[1]);
  } else {
      console.log("No IR config found.");
      // Let's look for any apex.jQuery initialization
      const match2 = html.match(/apex\.jQuery\(([\s\S]*?)\);/);
      if (match2) {
          console.log("Found apex.jQuery:", match2[0]);
      }
  }
}
test();
