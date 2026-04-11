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

    // Step 1: Get a session cookie
    const initUrl = "https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/103";
    const initRes = await fetch(initUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const cookies = initRes.headers.get('set-cookie');
    if (!cookies) {
      console.warn("No cookies received from EPA SDWIS initialization");
    }

    // Step 2: Fetch the violations report using the cookie
    const reportUrl = `https://sdwis.epa.gov/ords/sfdw_pub/r/sfdw/sdwis_fed_reports_public/11?ireq_pwsid=${pwsid}&clear=11,RIR`;
    const reportRes = await fetch(reportUrl, {
      headers: {
        'Cookie': cookies || '',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (!reportRes.ok) {
      throw new Error(`Failed to fetch violations from EPA: ${reportRes.statusText}`);
    }

    const html = await reportRes.text();
    const $ = cheerio.load(html);
    
    const violations: {
      vioid: string;
      cname: string;
      vname: string;
      enfactionname: string;
      enfdate: string;
      health_effects: string;
      violmeasure: string;
      definition: string;
    }[] = [];
    
    // Find the table
    const table = $('table.a-IRR-table');
    if (table.length === 0) {
      // It's possible there are no violations, which shows as "No results."
      return NextResponse.json(violations);
    }

    // Extract headers to map column indices
    const headerMap: Record<string, number> = {};
    table.find('tr').first().find('th').each((i, el) => {
      const text = $(el).text().trim();
      headerMap[text] = i;
    });

    // Parse rows
    table.find('tr').each((i, el) => {
      // Skip header row
      if (i === 0) return;
      
      const row = $(el);
      // Skip aggregate rows if any exist
      if (row.find('td.a-IRR-aggregate').length > 0) return;
      
      const cells = row.find('td');
      if (cells.length === 0) return;

      const getCellText = (headerName: string) => {
        const index = headerMap[headerName];
        if (index !== undefined && index < cells.length) {
          return $(cells[index]).text().trim();
        }
        return "";
      };

      // Map to the expected Violation interface format
      violations.push({
        vioid: getCellText("Violation ID"),
        cname: getCellText("Rule Name"), // Using Rule Name for cname/badge
        vname: getCellText("Violation Type"),
        enfactionname: getCellText("Compliance Status"),
        enfdate: getCellText("Compliance Period Begin Date"),
        health_effects: getCellText("Is Health Based") === 'Y' ? "Health Based Violation" : "Non-Health Based Violation",
        violmeasure: getCellText("Violation Type"), // Using Violation Type for violmeasure
        definition: getCellText("Rule Name") // Using Rule Name for definition
      });
    });

    return NextResponse.json(violations);
  } catch (error) {
    console.error("Error fetching system violations:", error);
    return NextResponse.json({ error: "Failed to fetch system violations" }, { status: 500 });
  }
}
