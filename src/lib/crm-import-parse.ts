import { createHash } from "node:crypto";
import { CRM_VERTICALS, normalizeName, normalizePhone, type CrmSource, type CrmVertical } from "./crm-rules";

/**
 * READING WHAT EACH SOURCE GIVES. Robert's sales CRM ruling of 2026-11-02,
 * item R2. Pure: text or rows in, records out, so a proof drives every parser
 * on a recorded sample and no proof ever reaches a real portal.
 *
 * Every source becomes the same record shape. A permit file is grouped by the
 * contractor ("keyed by contractor name", R2), so one company is one record
 * carrying how many permits it pulled and the latest; a license file is one
 * record per license.
 *
 * NOTHING IS DROPPED UNSAID. rowsRead counts every row the source gave, before
 * the filter. A row that matched the filter and cannot become a record is a
 * skip with its reason, which the import screen prints; a row the filter does
 * not keep is simply not this source's business, and the count says how many.
 */

export type ImportRecord = {
  line: number;
  sourceRecordId: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  postalCode: string | null;
  county: string | null;
  vertical: CrmVertical;
  tags: string[];
  website: string | null;
  permitCount: number | null;
  lastPermitOn: string | null;
  raw: Record<string, unknown>;
};

export type ImportSkip = { line: number; sourceRecordId: string; reason: string; raw: Record<string, unknown> };

export type ParseResult = { rowsRead: number; records: ImportRecord[]; skipped: ImportSkip[] };

/* ------------------------------------------------------------------ CSV rows */

/**
 * RFC 4180 rows, one at a time: quoted fields, doubled quotes, commas and line
 * breaks inside quotes. A generator rather than a grid, because the San Antonio
 * file is about 29 MB and a grid of it would hold every row twice.
 */
export function* csvRows(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell.trim().length > 0)) yield row;
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) yield row;
  }
}

/** Each data row as an object keyed by the header, with its line number (the header is line 1). */
export function* csvObjects(text: string): Generator<{ line: number; row: Record<string, string> }> {
  let header: string[] | null = null;
  let line = 0;
  for (const cells of csvRows(text)) {
    line += 1;
    if (!header) {
      header = cells.map((h) => h.trim());
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    yield { line, row };
  }
}

/* ------------------------------------------------------------------ helpers */

const blank = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : v === null || v === undefined ? "" : String(v).trim();
  return s.length ? s : null;
};

/** A date as YYYY-MM-DD from ISO, "2025-01-01", or "8/9/2027"; null when it is none of those. */
export function isoDate(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return null;
}

/** "SAN ANTONIO, TX 78216" into its city and ZIP. */
export function cityStateZip(v: string | null | undefined): { city: string | null; postalCode: string | null } {
  const s = (v ?? "").trim();
  const m = /^(.*?),\s*[A-Z]{2}\s+(\d{5})(?:-\d{4})?$/.exec(s);
  if (m) return { city: blank(m[1]), postalCode: m[2] };
  return { city: blank(s), postalCode: null };
}

/** "Taylor, Sean" into "Sean Taylor"; anything else as given. */
export function personName(v: string | null | undefined): string | null {
  const s = blank(v);
  if (!s) return null;
  const m = /^([^,]+),\s*(.+)$/.exec(s);
  return m ? `${m[2].trim()} ${m[1].trim()}` : s;
}

/** The id a contractor grouped from a permit file is known by: its normalized name. */
export function contractorRecordId(name: string): string {
  return `contractor:${normalizeName(name)}`;
}

/** The id a row of a bought list is known by: a hash of what makes it one company, so a second list naming it finds it. */
export function csvRecordId(company: string, phone: string | null, email: string | null): string {
  const key = `${normalizeName(company)}|${normalizePhone(phone) ?? ""}|${(email ?? "").trim().toLowerCase()}`;
  return `row:${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

/* ------------------------------------------------------- permits, by contractor */

type PermitHit = { line: number; contractor: string; phone: string | null; address: string | null; city: string | null; zip: string | null; issued: string | null; vertical: CrmVertical; permit: string | null };

/** Fold permits into one record per contractor: the count, the latest issue date, the commonest vertical, the latest phone. */
function foldByContractor(hits: PermitHit[]): ImportRecord[] {
  const by = new Map<string, PermitHit[]>();
  for (const h of hits) {
    const key = normalizeName(h.contractor);
    if (!key) continue;
    const list = by.get(key) ?? [];
    list.push(h);
    by.set(key, list);
  }
  const records: ImportRecord[] = [];
  for (const [, list] of by) {
    list.sort((a, b) => (b.issued ?? "").localeCompare(a.issued ?? "") || a.line - b.line);
    const latest = list[0];
    const tally = new Map<CrmVertical, number>();
    for (const h of list) tally.set(h.vertical, (tally.get(h.vertical) ?? 0) + 1);
    const vertical = [...tally.entries()].sort((a, b) => b[1] - a[1] || CRM_VERTICALS.indexOf(a[0]) - CRM_VERTICALS.indexOf(b[0]))[0][0];
    const withPhone = list.find((h) => normalizePhone(h.phone));
    records.push({
      line: Math.min(...list.map((h) => h.line)),
      sourceRecordId: contractorRecordId(latest.contractor),
      company: latest.contractor,
      contactName: null,
      phone: withPhone?.phone ?? null,
      email: null,
      addressLine: withPhone?.address ?? null,
      city: withPhone?.city ?? null,
      postalCode: withPhone?.zip ?? null,
      county: null,
      vertical,
      tags: [],
      website: null,
      permitCount: list.length,
      lastPermitOn: latest.issued,
      raw: { permits: list.slice(0, 5).map((h) => h.permit).filter(Boolean), permitCount: list.length },
    });
  }
  return records.sort((a, b) => a.line - b.line);
}

const SAN_ANTONIO_TYPES: Record<string, CrmVertical> = {
  "Re-Roof Permit": "roofer",
  "Solar - Photovoltaic Permit": "solar",
  "Foundation Repair Permit": "foundation_repair",
  "Comm Foundation Permit": "foundation_repair",
};

/**
 * San Antonio's permits_issued.csv. The contractor is PRIMARY CONTACT, a name
 * with no telephone; the ADDRESS is the job site, not the contractor's, so it
 * is not stored as the company's address.
 */
export function parseSanAntonioPermits(text: string): ParseResult {
  let rowsRead = 0;
  const hits: PermitHit[] = [];
  const skipped: ImportSkip[] = [];
  for (const { line, row } of csvObjects(text)) {
    rowsRead += 1;
    const vertical = SAN_ANTONIO_TYPES[row["PERMIT TYPE"]];
    if (!vertical) continue;
    const contractor = blank(row["PRIMARY CONTACT"]);
    if (!contractor) {
      skipped.push({ line, sourceRecordId: `permit:${row["PERMIT #"] || line}`, reason: "The permit names no contractor.", raw: { permit: row["PERMIT #"] } });
      continue;
    }
    hits.push({ line, contractor, phone: null, address: null, city: null, zip: null, issued: isoDate(row["DATE ISSUED"]), vertical, permit: blank(row["PERMIT #"]) });
  }
  return { rowsRead, records: foldByContractor(hits), skipped };
}

/** The Socrata query Austin is read with: only the three kinds of work, so the pull is the filter. */
export const AUSTIN_WHERE =
  "work_class = 'Roof' OR (work_class = 'Auxiliary Power' AND (upper(description) like '%SOLAR%' OR upper(description) like '%PV%')) OR (work_class = 'Repair' AND upper(description) like '%FOUNDATION%')";

function austinVertical(r: Record<string, unknown>): CrmVertical | null {
  const wc = String(r.work_class ?? "");
  const d = String(r.description ?? "").toUpperCase();
  if (wc === "Roof") return "roofer";
  if (wc === "Auxiliary Power" && (d.includes("SOLAR") || /\bPV\b/.test(d))) return "solar";
  if (wc === "Repair" && d.includes("FOUNDATION")) return "foundation_repair";
  return null;
}

/** Austin's issued construction permits, as Socrata rows. The contractor's company, phone and address are its own. */
export function parseAustinPermits(rows: Record<string, unknown>[]): ParseResult {
  const hits: PermitHit[] = [];
  const skipped: ImportSkip[] = [];
  rows.forEach((r, i) => {
    const line = i + 1;
    const vertical = austinVertical(r);
    if (!vertical) return;
    const contractor = blank(r.contractor_company_name) ?? blank(r.contractor_full_name);
    if (!contractor) {
      skipped.push({ line, sourceRecordId: `permit:${String(r.permit_number ?? line)}`, reason: "The permit names no contractor.", raw: { permit: r.permit_number } });
      return;
    }
    hits.push({
      line,
      contractor,
      phone: blank(r.contractor_phone),
      address: blank(r.contractor_address1),
      city: blank(r.contractor_city),
      zip: blank(r.contractor_zip),
      issued: isoDate(blank(r.issue_date)),
      vertical,
      permit: blank(r.permit_number),
    });
  });
  return { rowsRead: rows.length, records: foldByContractor(hits), skipped };
}

/* ------------------------------------------------------------ license files */

/** TDLR's electrical contractor file: one company per license not past its expiration on `today`. */
export function parseTdlrElectrical(text: string, today: string): ParseResult {
  let rowsRead = 0;
  const records: ImportRecord[] = [];
  const skipped: ImportSkip[] = [];
  for (const { line, row } of csvObjects(text)) {
    rowsRead += 1;
    const license = blank(row["LICENSE NUMBER"]);
    const expires = isoDate(row["LICENSE EXPIRATION DATE"]);
    if (expires && expires < today) continue;
    const company = blank(row["BUSINESS NAME"]) ?? blank(row["NAME"]);
    if (!license || !company) {
      skipped.push({ line, sourceRecordId: `license:${license ?? line}`, reason: license ? "The license names no business." : "The row carries no license number.", raw: { license } });
      continue;
    }
    const person = blank(row["NAME"]);
    const place = cityStateZip(row["BUSINESS CITY, STATE ZIP"]);
    records.push({
      line,
      sourceRecordId: `license:${license}`,
      company,
      contactName: person && normalizeName(person) !== normalizeName(company) ? person : null,
      phone: blank(row["BUSINESS PHONE"]) ?? blank(row["PHONE NUMBER"]),
      email: null,
      addressLine: blank(row["BUSINESS ADDRESS-LINE1"]),
      city: place.city,
      postalCode: blank(row["BUSINESS ZIP"])?.slice(0, 5) ?? place.postalCode,
      county: blank(row["BUSINESS COUNTY"]),
      vertical: "other",
      tags: ["electrical_contractor"],
      website: null,
      permitCount: null,
      lastPermitOn: null,
      raw: { license, licenseType: blank(row["LICENSE TYPE"]), expires },
    });
  }
  return { rowsRead, records, skipped };
}

/** TDLR's residential solar retailers: one company per Current registration, with its address and phone. */
export function parseTdlrSolarRetailers(text: string): ParseResult {
  let rowsRead = 0;
  const records: ImportRecord[] = [];
  const skipped: ImportSkip[] = [];
  for (const { line, row } of csvObjects(text)) {
    rowsRead += 1;
    if (row["License Status"] !== "Current") continue;
    const license = blank(row["License Number"]);
    const company = blank(row["Licensee"]);
    if (!license || !company) {
      skipped.push({ line, sourceRecordId: `registration:${license ?? line}`, reason: "The registration names no retailer.", raw: { license } });
      continue;
    }
    records.push({
      line,
      sourceRecordId: `registration:${license}`,
      company,
      contactName: null,
      phone: blank(row["Phone"]),
      email: null,
      addressLine: blank(row["Address1"]),
      city: blank(row["City"]),
      postalCode: blank(row["Zip"])?.slice(0, 5) ?? null,
      county: blank(row["County"]),
      vertical: "solar",
      tags: ["solar_retailer"],
      website: null,
      permitCount: null,
      lastPermitOn: null,
      raw: { license, expires: isoDate(row["License Expiration Date"]) },
    });
  }
  return { rowsRead, records, skipped };
}

/** TDLR's residential solar salespeople: one person per Current registration. Name and county only. */
export function parseTdlrSolarSalespeople(text: string): ParseResult {
  let rowsRead = 0;
  const records: ImportRecord[] = [];
  const skipped: ImportSkip[] = [];
  for (const { line, row } of csvObjects(text)) {
    rowsRead += 1;
    if (row["License Status"] !== "Current") continue;
    const license = blank(row["License Number"]);
    const name = personName(row["Licensee"]);
    if (!license || !name) {
      skipped.push({ line, sourceRecordId: `registration:${license ?? line}`, reason: "The registration names nobody.", raw: { license } });
      continue;
    }
    records.push({
      line,
      sourceRecordId: `registration:${license}`,
      company: name,
      contactName: name,
      phone: null,
      email: null,
      addressLine: null,
      city: null,
      postalCode: null,
      county: blank(row["County"]),
      vertical: "solar",
      tags: ["solar_salesperson"],
      website: null,
      permitCount: null,
      lastPermitOn: null,
      raw: { license, expires: isoDate(row["License Expiration Date"]) },
    });
  }
  return { rowsRead, records, skipped };
}

/** The license types and status TREC is read for: "brokers and agents" (R2), active only. */
export const TREC_TYPES = ["Broker Company", "Broker Individual", "Sales Agent"] as const;
export const TREC_WHERE = `status = 'Active' AND license_type in (${TREC_TYPES.map((t) => `'${t}'`).join(", ")})`;

/** TREC's license holders, as Socrata rows. The law removed phone, email and address, so every record has none. */
export function parseTrec(rows: Record<string, unknown>[]): ParseResult {
  const records: ImportRecord[] = [];
  const skipped: ImportSkip[] = [];
  rows.forEach((r, i) => {
    const line = i + 1;
    const type = String(r.license_type ?? "");
    if (r.status !== "Active" || !(TREC_TYPES as readonly string[]).includes(type)) return;
    const license = blank(r.license_number);
    const name = blank(r.full_name);
    if (!license || !name) {
      skipped.push({ line, sourceRecordId: `license:${license ?? line}`, reason: "The license names nobody.", raw: { license } });
      return;
    }
    const county = blank(r.county);
    records.push({
      line,
      sourceRecordId: `license:${license}`,
      company: name,
      contactName: type === "Broker Company" ? null : name,
      phone: null,
      email: null,
      addressLine: null,
      city: null,
      postalCode: null,
      county: county && county.toLowerCase() !== "pending" ? county : null,
      vertical: "real_estate",
      tags: [type === "Sales Agent" ? "sales_agent" : type === "Broker Company" ? "broker_company" : "broker"],
      website: null,
      permitCount: null,
      lastPermitOn: null,
      raw: { license, licenseType: type },
    });
  });
  return { rowsRead: rows.length, records, skipped };
}

/* ------------------------------------------------------- a bought list (CSV) */

const LIST_HEADER: Record<string, RegExp> = {
  company: /^(company|business|company name|business name|organization|organisation|firm)$/,
  contactName: /^(contact|contact name|name|person|contact person|full name)$/,
  phone: /^(phone|phone number|telephone|tel|mobile|cell|number)$/,
  email: /^(email|e-mail|email address|e-mail address)$/,
  city: /^(city|town)$/,
  addressLine: /^(address|street|street address|address line 1|address1)$/,
  postalCode: /^(zip|zip code|postal code|postcode)$/,
  county: /^(county)$/,
  website: /^(website|web site|url|site)$/,
  vertical: /^(vertical|type|kind|category|segment|industry)$/,
};

const VERTICAL_WORDS: Record<CrmVertical, RegExp> = {
  roofer: /^(roofer|roofers|roofing|roofing company|roofing contractor)$/,
  solar: /^(solar|solar installer|solar company|solar contractor)$/,
  manufactured_home_dealer: /^(manufactured home dealer|manufactured home|mobile home dealer|mh dealer|manufactured housing)$/,
  foundation_repair: /^(foundation repair|foundation|foundation contractor)$/,
  real_estate: /^(real estate|realtor|realtors|agent|agents|broker|brokerage|real estate agent)$/,
  lender: /^(lender|lenders|mortgage|mortgage lender|loan officer|bank)$/,
  insurance_agent: /^(insurance|insurance agent|insurance agency|agency)$/,
  other: /^(other|title|title company|contractor|general contractor)$/,
};

export function verticalFrom(value: string | null | undefined): CrmVertical | null {
  const v = (value ?? "").trim().toLowerCase().replace(/_/g, " ");
  if (!v) return null;
  for (const k of CRM_VERTICALS) if (k.replace(/_/g, " ") === v || VERTICAL_WORDS[k].test(v)) return k;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The most rows one bought list takes in a single preview. A bigger file is split, and the screen says so. */
export const LIST_ROW_LIMIT = 20000;

/**
 * A bought list, as CSV, through the same dedupe as every source (R2). A row
 * with no phone and no email is a record like any other and is held by the
 * planner, not refused here, so it waits in Held with the rest.
 */
export function parseBoughtList(text: string, defaultVertical: CrmVertical | null): ParseResult & { error: string | null } {
  let header: string[] | null = null;
  const col: Partial<Record<string, number>> = {};
  let rowsRead = 0;
  const records: ImportRecord[] = [];
  const skipped: ImportSkip[] = [];
  let line = 0;
  for (const cells of csvRows(text)) {
    line += 1;
    if (!header) {
      header = cells.map((h) => h.trim());
      header.forEach((h, i) => {
        const key = Object.keys(LIST_HEADER).find((k) => LIST_HEADER[k].test(h.toLowerCase()));
        if (key && col[key] === undefined) col[key] = i;
      });
      if (col.company === undefined) {
        return { rowsRead: 0, records: [], skipped: [], error: "No company column was found. The first row has to name the columns, and one of them has to be Company." };
      }
      if (col.vertical === undefined && !defaultVertical) {
        return { rowsRead: 0, records: [], skipped: [], error: "The file has no vertical column. Choose a vertical for these companies before checking the file." };
      }
      continue;
    }
    rowsRead += 1;
    if (rowsRead > LIST_ROW_LIMIT) {
      return { rowsRead, records: [], skipped: [], error: `The file has more than ${LIST_ROW_LIMIT.toLocaleString("en-US")} rows. Split it and check each part.` };
    }
    const cell = (k: string) => {
      const i = col[k];
      return i === undefined ? null : blank(cells[i]);
    };
    const company = cell("company");
    const phone = cell("phone");
    const emailRaw = cell("email");
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (!company) {
      skipped.push({ line, sourceRecordId: `line:${line}`, reason: "No company name.", raw: {} });
      continue;
    }
    if (email && !EMAIL.test(email)) {
      skipped.push({ line, sourceRecordId: csvRecordId(company, phone, null), reason: `"${emailRaw}" is not an email address.`, raw: { company } });
      continue;
    }
    const typed = cell("vertical");
    const vertical = typed ? verticalFrom(typed) : defaultVertical;
    if (!vertical) {
      skipped.push({ line, sourceRecordId: csvRecordId(company, phone, email), reason: `"${typed}" is not one of the eight verticals.`, raw: { company } });
      continue;
    }
    records.push({
      line,
      sourceRecordId: csvRecordId(company, phone, email),
      company,
      contactName: cell("contactName"),
      phone,
      email,
      addressLine: cell("addressLine"),
      city: cell("city"),
      postalCode: cell("postalCode")?.slice(0, 5) ?? null,
      county: cell("county"),
      vertical,
      tags: [],
      website: cell("website"),
      permitCount: null,
      lastPermitOn: null,
      raw: { line },
    });
  }
  if (!header) return { rowsRead: 0, records: [], skipped: [], error: "The file is empty." };
  return { rowsRead, records, skipped, error: null };
}

/** Which parser a source's fetched content goes through. */
export function parseSource(source: CrmSource, content: { text?: string; rows?: Record<string, unknown>[] }, today: string): ParseResult {
  switch (source) {
    case "permits_san_antonio":
      return parseSanAntonioPermits(content.text ?? "");
    case "permits_austin":
      return parseAustinPermits(content.rows ?? []);
    case "tdlr_electrical":
      return parseTdlrElectrical(content.text ?? "", today);
    case "tdlr_solar_retailers":
      return parseTdlrSolarRetailers(content.text ?? "");
    case "tdlr_solar_salespeople":
      return parseTdlrSolarSalespeople(content.text ?? "");
    case "trec":
      return parseTrec(content.rows ?? []);
    default:
      throw new Error(`${source} has no parser: it is not a source that runs.`);
  }
}
