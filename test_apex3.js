async function test() {
  const res = await fetch("https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=FL3421554&clear=11,RIR");
  const html = await res.text();
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  
  console.log("Hidden inputs:");
  $('input[type="hidden"]').each((i, el) => {
      console.log($(el).attr('name'), "=", $(el).attr('value'), "id=", $(el).attr('id'));
  });
  
  console.log("\nForm action:");
  console.log($('form').attr('action'));
}

test();
