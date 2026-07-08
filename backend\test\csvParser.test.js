import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv } from "../src/csvParser.js";
import { extractWithHeuristics } from "../src/heuristicExtractor.js";

test("parses quoted CSV values and embedded commas", () => {
  const csv = "Full Name,Email,Remarks\nJohn Doe,john@example.com,\"Busy, call next week\"";
  const { headers, records } = parseCsv(csv);
  assert.deepEqual(headers, ["Full Name", "Email", "Remarks"]);
  assert.equal(records[0].Remarks, "Busy, call next week");
});

test("heuristic extraction maps contact details and skips invalid rows", () => {
  const { records } = parseCsv("Client,Mobile,Status\nPriya,+91 98765 43210,interested\nNo Contact,,unknown");
  const result = extractWithHeuristics(records);
  assert.equal(result.parsed.length, 1);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.parsed[0].name, "Priya");
  assert.equal(result.parsed[0].country_code, "+91");
  assert.equal(result.parsed[0].crm_status, "GOOD_LEAD_FOLLOW_UP");
});
