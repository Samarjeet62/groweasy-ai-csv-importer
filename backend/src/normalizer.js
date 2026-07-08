import { ALLOWED_CRM_STATUSES, ALLOWED_DATA_SOURCES, CRM_FIELDS } from "../../shared/crmFields.js";

export function normalizeCrmRecord(rawRecord) {
  const record = {};
  for (const field of CRM_FIELDS) record[field] = sanitize(rawRecord?.[field]);

  const emails = collectEmails(Object.values(rawRecord || {}).join(" "));
  if (!record.email && emails[0]) record.email = emails[0];
  const extraEmails = emails.filter((email) => email !== record.email);

  const phones = collectPhones(Object.values(rawRecord || {}).join(" "));
  if (record.mobile_without_country_code) {
    const parsed = splitPhone(record.mobile_without_country_code, record.country_code);
    record.country_code = record.country_code || parsed.countryCode;
    record.mobile_without_country_code = parsed.mobile;
  } else if (phones[0]) {
    const parsed = splitPhone(phones[0], rawRecord?.country_code);
    record.country_code = record.country_code || parsed.countryCode;
    record.mobile_without_country_code = parsed.mobile;
  }
  const createdAtDigits = record.created_at.replace(/\D/g, "");
  const extraPhones = phones.filter((phone) => {
    const digits = phone.replace(/\D/g, "");
    return !digits.endsWith(record.mobile_without_country_code) && !createdAtDigits.includes(digits);
  });

  if (!ALLOWED_CRM_STATUSES.includes(record.crm_status)) record.crm_status = "";
  if (!ALLOWED_DATA_SOURCES.includes(record.data_source)) record.data_source = normalizeDataSource(record.data_source);
  if (record.created_at && Number.isNaN(new Date(record.created_at).getTime())) record.created_at = "";

  const noteParts = [record.crm_note];
  if (extraEmails.length) noteParts.push(`Extra emails: ${extraEmails.join(", ")}`);
  if (extraPhones.length) noteParts.push(`Extra phone numbers: ${extraPhones.join(", ")}`);
  record.crm_note = sanitize(noteParts.filter(Boolean).join(" | "));

  for (const key of Object.keys(record)) {
    record[key] = record[key].replace(/\r?\n/g, "\\n");
  }

  return record;
}

export function hasContact(record) {
  return Boolean(record?.email || record?.mobile_without_country_code);
}

export function collectEmails(value) {
  return Array.from(new Set(String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []));
}

export function collectPhones(value) {
  const matches = String(value || "").match(/(?:\+\d{1,3}[-\s]?)?(?:\d[-\s]?){8,14}\d/g) || [];
  return Array.from(new Set(matches.map((phone) => phone.replace(/[^\d+]/g, ""))));
}

export function splitPhone(phone, preferredCountryCode = "") {
  const compact = String(phone || "").replace(/[^\d+]/g, "");
  const digits = compact.replace(/\D/g, "");
  const inferredCountryCode = compact.startsWith("+") && digits.length > 10 ? `+${digits.slice(0, -10)}` : "";
  const countryCode = sanitize(preferredCountryCode) || inferredCountryCode;
  const mobile = countryCode ? digits.slice(-10) : digits.slice(-10);
  return { countryCode, mobile };
}

function sanitize(value) {
  return String(value ?? "").trim();
}

function normalizeDataSource(value) {
  const normalized = sanitize(value).toLowerCase().replace(/[\s-]+/g, "_");
  return ALLOWED_DATA_SOURCES.find((source) => normalized.includes(source)) || "";
}
