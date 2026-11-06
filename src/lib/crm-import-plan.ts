import { normalizeAddress, normalizeName, normalizePhone, territoryFor, type CrmSource } from "./crm-rules";
import type { ImportRecord, ImportSkip } from "./crm-import-parse";

/**
 * DECIDING WHAT AN IMPORT WILL DO, BEFORE IT DOES ANYTHING. Robert's sales CRM
 * ruling of 2026-11-02, item R2: "a dry run that reports adds, merges and
 * conflicts before writing ... Dedupe by normalized name, phone and address;
 * merge keeps every source."
 *
 * Pure: the records a source gave and an index of the list as it is, in; one
 * verdict per record, out. The preview is this function run once; Write runs
 * it again over the stored records against the list as it is then, and writes
 * only if every verdict is the same (staleLines). So the preview a person read
 * is the import that happens.
 *
 * The order of the questions is the order of how sure each answer is:
 *   1. this source already gave this record: it is refreshed (merge);
 *   2. the same normalized name AND telephone: the company (merge);
 *   3. the same telephone: one company is a merge, two are a conflict;
 *   4. the same normalized name, where county and address do not disagree:
 *      one company is a merge, two are a conflict;
 *   5. an earlier record in this run with the same name and telephone: the
 *      same new company (merge into that line);
 *   6. otherwise a phone or an email makes it an add, and neither makes it
 *      held: the reachable check on eng_prospects stays (his answer 3) and the
 *      record waits on the import screen until a phone is found.
 */

export type Verdict = "add" | "merge" | "conflict" | "held" | "skip";

export type ExistingCompany = {
  id: string;
  nameKey: string;
  phoneKey: string | null;
  county: string | null;
  addressKey: string | null;
  permitCount: number;
  lastPermitOn: string | null;
};

export type ListIndex = {
  /** "source|record id" to the company holding that source record. */
  bySource: Map<string, string>;
  /** "name|phone" to the company (unique on the list, 0112). */
  byNamePhone: Map<string, string>;
  /** Telephone to every company carrying it, on the company row or one of its people. */
  byPhone: Map<string, string[]>;
  /** Normalized name to every company of that name. */
  byName: Map<string, ExistingCompany[]>;
  companies: Map<string, ExistingCompany>;
};

export type PlannedRow = {
  line: number;
  sourceRecordId: string;
  verdict: Verdict;
  prospectId: string | null;
  candidateIds: string[];
  reason: string | null;
  /** For a merge into a company this run adds: the line that adds it. */
  mergeLine: number | null;
  payload: ImportRecord | { skipped: true; raw: Record<string, unknown> };
};

export const HELD_REASON = "No phone and no email, so nobody can call them yet. Add a phone to bring them onto the list.";

/** Build the index from the rows read off the list. Pure, so a proof builds one by hand. */
export function buildIndex(
  companies: { id: string; nameKey: string | null; phoneKey: string | null; county: string | null; addressLine: string | null; permitCount?: number | null; lastPermitOn?: string | null }[],
  sources: { source: string; sourceRecordId: string; prospectId: string }[],
  contactPhones: { prospectId: string; phoneKey: string | null }[],
): ListIndex {
  const index: ListIndex = { bySource: new Map(), byNamePhone: new Map(), byPhone: new Map(), byName: new Map(), companies: new Map() };
  const addPhone = (phone: string | null, id: string) => {
    if (!phone) return;
    const list = index.byPhone.get(phone) ?? [];
    if (!list.includes(id)) list.push(id);
    index.byPhone.set(phone, list);
  };
  for (const c of companies) {
    const company: ExistingCompany = {
      id: c.id,
      nameKey: c.nameKey ?? "",
      phoneKey: c.phoneKey,
      county: c.county ? c.county.toLowerCase() : null,
      addressKey: c.addressLine ? normalizeAddress(c.addressLine) || null : null,
      permitCount: c.permitCount ?? 0,
      lastPermitOn: c.lastPermitOn ?? null,
    };
    index.companies.set(c.id, company);
    if (company.nameKey && company.phoneKey) index.byNamePhone.set(`${company.nameKey}|${company.phoneKey}`, c.id);
    addPhone(company.phoneKey, c.id);
    if (company.nameKey) {
      const list = index.byName.get(company.nameKey) ?? [];
      list.push(company);
      index.byName.set(company.nameKey, list);
    }
  }
  for (const p of contactPhones) addPhone(p.phoneKey, p.prospectId);
  for (const s of sources) index.bySource.set(`${s.source}|${s.sourceRecordId}`, s.prospectId);
  return index;
}

/** Whether a company found by name alone could be this record: nothing on either side contradicts it. */
function nameMatchFits(record: ImportRecord, c: ExistingCompany): boolean {
  const county = record.county ? (territoryFor(record.county)?.county ?? record.county).toLowerCase() : null;
  if (county && c.county && county !== c.county) return false;
  const address = record.addressLine ? normalizeAddress(record.addressLine) : null;
  if (address && c.addressKey && address !== c.addressKey) return false;
  return true;
}

export function planRecords(source: CrmSource, records: ImportRecord[], skipped: ImportSkip[], index: ListIndex): PlannedRow[] {
  const rows: PlannedRow[] = [];
  const addedInRun = new Map<string, number>();
  const sortedRecords = [...records].sort((a, b) => a.line - b.line);
  for (const r of sortedRecords) {
    const base = { line: r.line, sourceRecordId: r.sourceRecordId, candidateIds: [] as string[], mergeLine: null as number | null, payload: r };
    const nameKey = normalizeName(r.company);
    const phoneKey = normalizePhone(r.phone);

    const seen = index.bySource.get(`${source}|${r.sourceRecordId}`);
    if (seen) {
      rows.push({ ...base, verdict: "merge", prospectId: seen, reason: "This source gave this record before; it is refreshed on the same company." });
      continue;
    }
    if (nameKey && phoneKey) {
      const exact = index.byNamePhone.get(`${nameKey}|${phoneKey}`);
      if (exact) {
        rows.push({ ...base, verdict: "merge", prospectId: exact, reason: "The same company and telephone are already on the list." });
        continue;
      }
    }
    if (phoneKey) {
      const byPhone = index.byPhone.get(phoneKey) ?? [];
      if (byPhone.length === 1) {
        rows.push({ ...base, verdict: "merge", prospectId: byPhone[0], reason: "The same telephone is already on the list." });
        continue;
      }
      if (byPhone.length > 1) {
        rows.push({ ...base, verdict: "conflict", prospectId: null, candidateIds: [...byPhone].sort(), reason: `${byPhone.length} companies on the list carry this telephone. Choose the one it belongs to.` });
        continue;
      }
    }
    if (nameKey) {
      const byName = (index.byName.get(nameKey) ?? []).filter((c) => nameMatchFits(r, c));
      if (byName.length === 1) {
        rows.push({ ...base, verdict: "merge", prospectId: byName[0].id, reason: "A company of the same name, in no other county or address, is already on the list." });
        continue;
      }
      if (byName.length > 1) {
        rows.push({ ...base, verdict: "conflict", prospectId: null, candidateIds: byName.map((c) => c.id).sort(), reason: `${byName.length} companies on the list have this name. Choose the one it belongs to.` });
        continue;
      }
    }
    if (nameKey && phoneKey) {
      const earlier = addedInRun.get(`${nameKey}|${phoneKey}`);
      if (earlier !== undefined) {
        rows.push({ ...base, verdict: "merge", prospectId: null, mergeLine: earlier, reason: `The same company as line ${earlier} of this import.` });
        continue;
      }
    }
    if (phoneKey || r.email) {
      if (nameKey && phoneKey) addedInRun.set(`${nameKey}|${phoneKey}`, r.line);
      rows.push({ ...base, verdict: "add", prospectId: null, reason: null });
      continue;
    }
    rows.push({ ...base, verdict: "held", prospectId: null, reason: HELD_REASON });
  }
  for (const s of skipped) {
    rows.push({ line: s.line, sourceRecordId: s.sourceRecordId, verdict: "skip", prospectId: null, candidateIds: [], mergeLine: null, reason: s.reason, payload: { skipped: true, raw: s.raw } });
  }
  return rows.sort((a, b) => a.line - b.line);
}

export function tally(rows: PlannedRow[]): { adds: number; merges: number; conflicts: number; held: number; skipped: number } {
  const t = { adds: 0, merges: 0, conflicts: 0, held: 0, skipped: 0 };
  for (const r of rows) {
    if (r.verdict === "add") t.adds += 1;
    else if (r.verdict === "merge") t.merges += 1;
    else if (r.verdict === "conflict") t.conflicts += 1;
    else if (r.verdict === "held") t.held += 1;
    else t.skipped += 1;
  }
  return t;
}

/**
 * HOW MANY HELD ROWS A RUN STORES. TREC alone gives well over a hundred
 * thousand records with no phone; storing every one on every run would grow a
 * table for no reader. So a run stores the first HELD_KEEP held rows by line
 * and counts every one: the run row carries both numbers, and the screen says
 * "the first N of M". Every other verdict is stored in full, because Write
 * acts on it.
 */
export const HELD_KEEP = 500;

export function rowsToStore(rows: PlannedRow[]): PlannedRow[] {
  let held = 0;
  return rows.filter((r) => {
    if (r.verdict !== "held") return true;
    held += 1;
    return held <= HELD_KEEP;
  });
}

/**
 * THE STALENESS TEST. The lines whose verdict, company, candidates or
 * in-run target would now be different. Write refuses unless this is empty,
 * so the list cannot have moved under a preview a person read.
 */
export function staleLines(stored: PlannedRow[], replanned: PlannedRow[]): number[] {
  const now = new Map(replanned.map((r) => [r.line, r]));
  const out: number[] = [];
  for (const s of stored) {
    if (s.verdict === "held" || s.verdict === "skip") continue;
    const r = now.get(s.line);
    if (
      !r ||
      r.verdict !== s.verdict ||
      (r.prospectId ?? null) !== (s.prospectId ?? null) ||
      (r.mergeLine ?? null) !== (s.mergeLine ?? null) ||
      [...r.candidateIds].sort().join(",") !== [...s.candidateIds].sort().join(",")
    ) {
      out.push(s.line);
    }
  }
  return out;
}
