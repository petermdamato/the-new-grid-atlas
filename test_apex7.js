async function test() {
  // 1. Get a session ID
  const res1 = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/103", {
      headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
  });
  const cookies = res1.headers.get('set-cookie');
  console.log("Cookies:", cookies);
  
  // 2. Fetch the violations page with the same session
  const res2 = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=FL3421554&clear=11,RIR", {
      headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
  });
  const html2 = await res2.text();
  const cheerio = require('cheerio');
  const $ = cheerio.load(html2);
  
  console.log("Found tables:", $('table.a-IRR-table').length);
  if ($('table.a-IRR-table').length > 0) {
      console.log("Table headers:", $('table.a-IRR-table th').map((i, el) => $(el).text().trim()).get());
      console.log("First row:", $('table.a-IRR-table tr').eq(1).text().replace(/\s+/g, ' ').trim());
  } else {
      console.log("No table found. Looking for no data message...");
      console.log($('.a-IRR-noDataMsg').text());
  }
}
test();
