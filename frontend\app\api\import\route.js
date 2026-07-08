import { extractCrmRecords } from "../../../../backend/src/aiExtractor.js";
import { parseCsv } from "../../../../backend/src/csvParser.js";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.text !== "function") {
      return Response.json({ error: "CSV file is required." }, { status: 400 });
    }

    const csv = await file.text();
    const { headers, records } = parseCsv(csv);
    if (headers.length === 0) {
      return Response.json({ error: "CSV must include a header row." }, { status: 400 });
    }
    if (records.length === 0) {
      return Response.json({ error: "CSV must include at least one data row." }, { status: 400 });
    }

    const result = await extractCrmRecords(records);
    return Response.json({ headers, totalRows: records.length, ...result });
  } catch (error) {
    return Response.json({ error: error.message || "Unexpected server error." }, { status: 500 });
  }
}
