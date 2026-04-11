async function test() {
  const res = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/103?ireq_pwsid=NY5503374&clear=RP");
  const html = await res.text();
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  const row = $('table.a-IRR-table tr').eq(1);
  const vioLink = row.find('td[headers="NUM_VIO"] a').attr('href');
  console.log("Violations link from page 103:", vioLink);
}
test();
