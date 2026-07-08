export function parseCsv(input) {
  const text = stripBom(String(input || ""));
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
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  if (rows.length === 0) return { headers: [], records: [] };

  const headers = rows[0].map((header, index) => normalizeHeader(header, index));
  const records = rows.slice(1).map((values, rowIndex) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] ?? "").trim();
    });
    return { __row: rowIndex + 2, ...record };
  });

  return { headers, records };
}

function normalizeHeader(header, index) {
  const trimmed = String(header || "").trim();
  return trimmed || `column_${index + 1}`;
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
