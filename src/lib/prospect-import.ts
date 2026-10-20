/**
 * READING A SPREADSHEET OF PROSPECTS. Pure, so a proof can drive it row by row.
 *
 * Operator ruling, 2026-10-20: a rep imports a spreadsheet of prospects with
 * company, contact, phone, email and city, into the sales list.
 *
 * CSV, which every spreadsheet program saves. Not .xlsx: reading that format
 * needs a library this repository does not carry, and adding one to parse a
 * file a person can save as CSV in two clicks is a dependency bought for
 * nothing. The import screen says how, in those words.
 *
 * EVERY ROW GETS AN ANSWER. A row that cannot be imported is returned with the
 * reason, in plain words, rather than skipped: an import that silently drops
 * the eleventh row is a list somebody believes is complete.
 */

export const PROSPECT_TYPES = ["roofer", "agent", "title", "contractor"] as const;
export type ProspectType = (typeof PROSPECT_TYPES)[number];

export const PROSPECT_TYPE_LABEL: Record<ProspectType, string> = {
  roofer: "Roofer",
  agent: "Real estate agent",
  title: "Title company",
  contractor: "Contractor",
};

/** The most rows one import takes. A bigger file is split, and the screen says so. */
export const IMPORT_ROW_LIMIT = 5000;

export type ParsedProspect = {
  company: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  prospectType: ProspectType;
};

export type ImportRow =
  | { line: number; ok: true; prospect: ParsedProspect }
  | { line: number; ok: false; reason: string };

/** RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
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
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Which column holds which field, from the header row, forgiving of how people title columns. */
const HEADER: Record<keyof ParsedProspect, RegExp> = {
  company: /^(company|business|company name|business name|organization|organisation|firm)$/,
  contactName: /^(contact|contact name|name|person|contact person|full name)$/,
  phone: /^(phone|phone number|telephone|tel|mobile|cell|number)$/,
  email: /^(email|e-mail|email address|e-mail address)$/,
  city: /^(city|town|location)$/,
  prospectType: /^(type|kind|category|segment|prospect type)$/,
};

const TYPE_WORDS: Record<ProspectType, RegExp> = {
  roofer: /^(roofer|roofers|roofing|roofing company|roofing contractor)$/,
  agent: /^(agent|agents|realtor|realtors|real estate|real estate agent|broker)$/,
  title: /^(title|title company|title companies|title agent|escrow)$/,
  contractor: /^(contractor|contractors|general contractor|gc|builder|remodeler)$/,
};

export function typeFrom(value: string): ProspectType | null {
  const v = value.trim().toLowerCase();
  for (const t of PROSPECT_TYPES) if (TYPE_WORDS[t].test(v)) return t;
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Turn the file into one answer per data row. `defaultType` is the type the
 * person chose on the screen, used where the file has no type column or a row
 * leaves it blank; a row whose type is present and unrecognised is refused
 * rather than defaulted, because that is the row somebody meant something by.
 */
export function readProspectFile(text: string, defaultType: ProspectType | null): { header: string[]; rows: ImportRow[]; error: string | null } {
  const grid = parseCsv(text);
  if (grid.length === 0) return { header: [], rows: [], error: "The file is empty." };
  const header = grid[0].map((h) => h.trim());
  const col: Partial<Record<keyof ParsedProspect, number>> = {};
  header.forEach((h, i) => {
    const key = (Object.keys(HEADER) as (keyof ParsedProspect)[]).find((k) => HEADER[k].test(h.toLowerCase()));
    if (key && col[key] === undefined) col[key] = i;
  });
  if (col.company === undefined) {
    return { header, rows: [], error: "No company column was found. The first row has to name the columns, and one of them has to be Company." };
  }
  if (col.phone === undefined && col.email === undefined) {
    return { header, rows: [], error: "No phone or email column was found. A prospect nobody can reach cannot be called." };
  }
  if (col.prospectType === undefined && !defaultType) {
    return { header, rows: [], error: "The file has no type column. Choose a type for these prospects before importing." };
  }
  const body = grid.slice(1);
  if (body.length > IMPORT_ROW_LIMIT) {
    return { header, rows: [], error: `The file has ${body.length} rows. One import takes up to ${IMPORT_ROW_LIMIT}; split it and import each part.` };
  }

  const cell = (r: string[], k: keyof ParsedProspect) => {
    const i = col[k];
    const v = i === undefined ? "" : (r[i] ?? "").trim();
    return v.length ? v : null;
  };

  const rows: ImportRow[] = body.map((r, index) => {
    const line = index + 2;
    const company = cell(r, "company");
    if (!company) return { line, ok: false, reason: "No company name." };
    const phone = cell(r, "phone");
    const emailRaw = cell(r, "email");
    const email = emailRaw ? emailRaw.toLowerCase() : null;
    if (email && !EMAIL.test(email)) return { line, ok: false, reason: `"${emailRaw}" is not an email address.` };
    if (!phone && !email) return { line, ok: false, reason: "No phone and no email, so nobody can reach them." };
    const typed = cell(r, "prospectType");
    let prospectType: ProspectType | null = defaultType;
    if (typed) {
      prospectType = typeFrom(typed);
      if (!prospectType) return { line, ok: false, reason: `"${typed}" is not a type. Use roofer, agent, title or contractor.` };
    }
    if (!prospectType) return { line, ok: false, reason: "No type, and none was chosen for the import." };
    return {
      line,
      ok: true,
      prospect: { company, contactName: cell(r, "contactName"), phone, email, city: cell(r, "city"), prospectType },
    };
  });
  return { header, rows, error: null };
}

/** The key two rows are the same prospect by: the email, else the phone's digits. */
export function sameProspectKeys(p: { email: string | null; phone: string | null }): string[] {
  const keys: string[] = [];
  if (p.email) keys.push(`e:${p.email.trim().toLowerCase()}`);
  const digits = (p.phone ?? "").replace(/[^0-9]/g, "").replace(/^1(?=[0-9]{10}$)/, "");
  if (digits.length >= 7) keys.push(`p:${digits}`);
  return keys;
}
