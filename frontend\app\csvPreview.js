export function parseCsvPreview(input, maxRows = 100) {
  const rows = parseRows(input);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((header, index) => String(header || "").trim() || `column_${index + 1}`);
  return {
    headers,
    rows: rows.slice(1, maxRows + 1).map((values, rowIndex) => ({
      id: rowIndex + 1,
      cells: headers.map((header, index) => ({ header, value: values[index] || "" }))
    }))
  };
}

function parseRows(input) {
  const text = String(input || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"") {
      if (inQuotes && next === "\"") {
        cell += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}
