import { ALLOWED_CRM_STATUSES, ALLOWED_DATA_SOURCES, CRM_FIELDS } from "../../shared/crmFields.js";
import { extractWithHeuristics } from "./heuristicExtractor.js";
import { hasContact, normalizeCrmRecord } from "./normalizer.js";

const BATCH_SIZE = Number(process.env.AI_BATCH_SIZE || 20);
const MAX_RETRIES = Number(process.env.AI_MAX_RETRIES || 2);

export async function extractCrmRecords(records) {
  const batches = chunk(records, BATCH_SIZE);
  const parsed = [];
  const skipped = [];
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();

  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    const result = provider === "mock" ? extractWithHeuristics(batch) : await extractBatchWithRetry(batch, provider);
    parsed.push(...result.parsed);
    skipped.push(...result.skipped);
  }

  return { parsed, skipped, totalImported: parsed.length, totalSkipped: skipped.length };
}

async function extractBatchWithRetry(batch, provider) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const aiRecords = await callProvider(batch, provider);
      return validateAiRecords(batch, aiRecords);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await sleep(400 * 2 ** attempt);
    }
  }
  const fallback = extractWithHeuristics(batch);
  fallback.skipped.push({ reason: `AI batch failed after retries: ${lastError.message}`, sourceRows: batch.map((item) => item.__row) });
  return fallback;
}

async function callProvider(batch, provider) {
  if (provider === "openai") return callOpenAi(batch);
  if (provider === "gemini") return callGemini(batch);
  if (provider === "claude") return callClaude(batch);
  throw new Error(`Unsupported AI_PROVIDER "${provider}"`);
}

async function callOpenAi(batch) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: JSON.stringify({ records: batch }) }
      ]
    })
  });
  const json = await readJson(response);
  return JSON.parse(json.choices[0].message.content).records;
}

async function callGemini(batch) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
      contents: [{ role: "user", parts: [{ text: `${systemPrompt()}\n\nInput:\n${JSON.stringify({ records: batch })}` }] }]
    })
  });
  const json = await readJson(response);
  return JSON.parse(json.candidates[0].content.parts[0].text).records;
}

async function callClaude(batch) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 4000,
      temperature: 0,
      messages: [{ role: "user", content: `${systemPrompt()}\n\nInput:\n${JSON.stringify({ records: batch })}` }]
    })
  });
  const json = await readJson(response);
  return JSON.parse(json.content[0].text).records;
}

function validateAiRecords(batch, aiRecords = []) {
  const parsed = [];
  const skipped = [];
  for (const item of aiRecords) {
    const normalized = normalizeCrmRecord(item);
    if (hasContact(normalized)) parsed.push(normalized);
    else skipped.push({ row: item.__row, reason: "Missing email and mobile number", source: item });
  }

  const missingCount = Math.max(0, batch.length - aiRecords.length);
  for (let i = 0; i < missingCount; i += 1) {
    skipped.push({ reason: "AI did not return a corresponding record" });
  }
  return { parsed, skipped };
}

function systemPrompt() {
  return [
    "You extract CRM lead records from arbitrary CSV rows for GrowEasy.",
    `Return only JSON in this exact shape: {"records":[{${CRM_FIELDS.map((field) => `"${field}":""`).join(",")}}]}.`,
    `CRM fields: ${CRM_FIELDS.join(", ")}.`,
    `crm_status must be blank or one of: ${ALLOWED_CRM_STATUSES.join(", ")}.`,
    `data_source must be blank or one of: ${ALLOWED_DATA_SOURCES.join(", ")}. Leave blank if not confident.`,
    "created_at must be parseable by JavaScript new Date(created_at), otherwise blank.",
    "If multiple emails or mobiles exist, use the first and append the remaining values to crm_note.",
    "Use crm_note for remarks, follow-up notes, extra emails, extra phone numbers, and useful unmatched information.",
    "Do not introduce real line breaks inside field values; use escaped \\n when needed.",
    "Skip records with neither email nor mobile by omitting them from records."
  ].join("\n");
}

async function readJson(response) {
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error?.message || `AI request failed with ${response.status}`);
  return json;
}

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
