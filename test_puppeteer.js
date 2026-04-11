const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Go to the violations page
  await page.goto('https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=FL3421554&clear=11,RIR', { waitUntil: 'networkidle2' });
  
  // Wait for table to load
  try {
    await page.waitForSelector('table.a-IRR-table', { timeout: 5000 });
    const html = await page.content();
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);
    
    console.log("Found tables:", $('table.a-IRR-table').length);
    const rows = $('table.a-IRR-table tr').length;
    console.log("Found rows:", rows);
    
  } catch (e) {
    console.log("Error or timeout waiting for table", e.message);
    const html = await page.content();
    console.log("Page content snippet:", html.substring(0, 500));
  }
  
  await browser.close();
}

test();
