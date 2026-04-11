import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ pwsid: string }> }
) {
  try {
    const { pwsid } = await params;

    if (!pwsid) {
      return NextResponse.json({ error: "Missing pwsid parameter" }, { status: 400 });
    }

    const url = `https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/103?ireq_pwsid=${pwsid}&clear=RP`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from EPA: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Find the second row in the table (first row is headers)
    const row = $('table.a-IRR-table tr').eq(1);
    
    if (row.length === 0) {
      return NextResponse.json({ error: "No data found for this PWSID" }, { status: 404 });
    }

    const data = {
      pwsid: row.find('td[headers="PWSID"]').text().trim(),
      pwsName: row.find('td[headers="PWS_NAME"]').text().trim(),
      pwsType: row.find('td[headers="PWS_TYPE_DESCRIPTION"]').text().trim(),
      primarySource: row.find('td[headers="PRIMARY_SOURCE_DESCRIPTION"]').text().trim(),
      countyServed: row.find('td[headers="COUNTY_SERVED"]').text().trim(),
      cityServed: row.find('td[headers="CITY_SERVED"]').text().trim(),
      populationServed: row.find('td[headers="POPULATION_SERVED_COUNT"]').text().trim(),
    };

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching system metadata:", error);
    return NextResponse.json({ error: "Failed to fetch system metadata" }, { status: 500 });
  }
}
