async function test() {
  console.log("Step 1: Fetching base page to get cookies...");
  const res1 = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11");
  const cookies = res1.headers.get('set-cookie');
  
  // Extract just the cookie value
  const cookieStr = cookies ? cookies.split(';')[0] : '';
  console.log("Got cookie:", cookieStr);
  
  console.log("Step 2: Fetching violations page with cookie...");
  const targetUrl = "https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=FL3421554&clear=11,RIR";
  const res2 = await fetch(targetUrl, {
    headers: {
      'Cookie': cookieStr
    }
  });
  
  const html = await res2.text();
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  console.log("Found tables:", $('table').length);
  $('table').each((i, el) => {
      console.log(`Table ${i} id:`, $(el).attr('id'), 'class:', $(el).attr('class'));
  });
  
  if ($('table').length === 0) {
      console.log("No table found. Looking for no data message...");
      console.log($('.a-IRR-noDataMsg').text());
  }
}

test();
