import { ALLOWED_CRM_STATUSES, ALLOWED_DATA_SOURCES, CRM_FIELDS } from "../../shared/crmFields.js";
import { collectEmails, collectPhones, normalizeCrmRecord, splitPhone } from "./normalizer.js";

const FIELD_HINTS = {
  created_at: ["created", "date", "time", "timestamp", "submitted", "lead date"],
  name: ["name", "full name", "customer", "client", "person"],
  email: ["email", "e-mail", "mail"],
  mobile_without_country_code: ["phone", "mobile", "whatsapp", "contact", "number"],
  company: ["company", "business", "organization", "organisation"],
  city: ["city", "location", "town"],
  state: ["state", "province", "region"],
  country: ["country"],
  lead_owner: ["owner", "agent", "sales", "assigned", "executive"],
  crm_status: ["status", "stage", "disposition", "lead status"],
  crm_note: ["note", "remark", "comment", "feedback", "message"],
  data_source: ["source", "campaign", "project", "channel"],
  possession_time: ["possession", "move in", "timeline"],
  description: ["description", "requirement", "details", "interest"]
};

export function extractWithHeuristics(records) {
  const parsed = [];
  const skipped = [];

  for (const source of records) {
    const mapped = mapRecord(source);
    const normalized = normalizeCrmRecord(mapped);
    if (normalized.email || normalized.mobile_without_country_code) {
      parsed.push(normalized);
    } else {
      skipped.push({ row: source.__row, reason: "Missing email and mobile number", source });
    }
  }

  return { parsed, skipped };
}

function mapRecord(source) {
  const result = Object.fromEntries(CRM_FIELDS.map((field) => [field, ""]));
  const entries = Object.entries(source).filter(([key]) => key !== "__row");

  for (const [key, value] of entries) {
    const lower = key.toLowerCase().replace(/[_-]/g, " ");
    for (const [field, hints] of Object.entries(FIELD_HINTS)) {
      if (!result[field] && hints.some((hint) => lower.includes(hint))) {
        result[field] = String(value || "").trim();
      }
    }
  }

  const sourceEntry = entries.find(([key]) => /source|campaign|project/i.test(key));
  if (sourceEntry) result.data_source = normalizeSource(sourceEntry[1]);

  const allText = entries.map(([, value]) => value).join(" ");
  const emails = collectEmails(allText);
  if (!result.email && emails[0]) result.email = emails[0];

  const phones = collectPhones(allText);
  if (!result.mobile_without_country_code && phones[0]) {
    const parsed = splitPhone(phones[0], result.country_code);
    result.country_code = result.country_code || parsed.countryCode;
    result.mobile_without_country_code = parsed.mobile;
  }

  result.crm_status = normalizeStatus(result.crm_status || result.crm_note || result.description);
  result.data_source = normalizeSource(result.data_source || allText);
  return result;
}

function normalizeStatus(value) {
  const lower = String(value || "").toLowerCase();
  if (lower.includes("sale") || lower.includes("closed") || lower.includes("won")) return "SALE_DONE";
  if (lower.includes("bad") || lower.includes("not interested") || lower.includes("invalid")) return "BAD_LEAD";
  if (lower.includes("busy") || lower.includes("not connect") || lower.includes("did not")) return "DID_NOT_CONNECT";
  if (lower.includes("follow") || lower.includes("good") || lower.includes("interested")) return "GOOD_LEAD_FOLLOW_UP";
  return "";
}

function normalizeSource(value) {
  const lower = String(value || "").toLowerCase().replace(/[\s-]+/g, "_");
  return ALLOWED_DATA_SOURCES.find((source) => lower.includes(source) || lower.includes(source.replace(/_/g, ""))) || "";
}
