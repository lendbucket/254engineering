import type { CrmSource, CrmVertical } from "@/lib/crm-rules";

/**
 * WHERE THE SALES LIST IMPORTS FROM, AND UNDER WHAT TERMS. Robert's sales CRM
 * ruling of 2026-11-02, item R2: "Read each portal's terms before the first
 * pull and record the URL and terms date in docs/crm-sources.md; skip any
 * source whose terms forbid storage."
 *
 * This file is the code twin of docs/crm-sources.md. A source runs only when
 * it is READY, its terms were read on a recorded date, and those terms allow
 * storing what it gives (sourceRefusal below, asserted by a proof). Nothing
 * else decides it, so a source cannot be switched on by a schedule or a button
 * that forgot to ask.
 *
 * His answers of 2026-11-02 that shape the states:
 * - build San Antonio, Austin, TDLR and TREC first (answer 7); Houston,
 *   Dallas, Fort Worth and Corpus Christi wait for the open records letters he
 *   is sending, and are declared here so the screen says why they wait;
 * - Austin stays on hold until he records its terms date, because its terms
 *   PDF could not be read here;
 * - TDLR's two residential solar files join beside the electrical contractor
 *   file (his answer to 6588393366), vertical solar, the same terms;
 * - scheduled runs only preview, a person presses Write (answer 4).
 */

export type CrmSourceState = "ready" | "hold" | "skip";

export type CrmSourceDecl = {
  key: CrmSource;
  label: string;
  /** The dataset page a person opens to see it. */
  datasetUrl: string;
  /** What the job fetches. A Socrata resource for "soda", a file for "csv". */
  fetchUrl: string | null;
  format: "csv" | "soda" | null;
  termsUrl: string | null;
  /** The day the terms were read, YYYY-MM-DD, or null when they were not. */
  termsReadOn: string | null;
  /** Whether the terms allow storing what the source gives. Null when not established. */
  allowed: boolean | null;
  state: CrmSourceState;
  /** Why the source is in its state, in a sentence the import screen prints. */
  why: string;
  /** Scheduled previews. Only a ready source is ever queued. */
  schedule: "daily" | null;
  /** The vertical every record from this source carries, or null when it is read per row. */
  vertical: CrmVertical | null;
  /** Named on every row stored from this source, where the terms require it. */
  attribution: string | null;
  /** What is kept, in words, matching docs/crm-sources.md. */
  filter: string;
};

const TDLR_TERMS = "https://www.tdlr.texas.gov/disclaimer.htm";
const TDLR_ATTRIBUTION = "Source: Texas Department of Licensing and Regulation (tdlr.texas.gov). Presented as read, not altered in meaning.";

export const CRM_SOURCE_DECLS: readonly CrmSourceDecl[] = [
  {
    key: "permits_san_antonio",
    label: "San Antonio building permits",
    datasetUrl: "https://data.sanantonio.gov/dataset/building-permits",
    fetchUrl: "https://data.sanantonio.gov/dataset/05012dcb-ba1b-4ade-b5f3-7403bc7f52eb/resource/c21106f9-3ef5-4f3a-8604-f992b4db7512/download/permits_issued.csv",
    format: "csv",
    termsUrl: "http://www.opendefinition.org/licenses/cc-by",
    termsReadOn: "2026-11-02",
    allowed: true,
    state: "ready",
    why: "Creative Commons Attribution on the dataset page, read 2026-11-02. The file names the contractor only, with no telephone, so most companies wait in Held until a phone is found.",
    schedule: "daily",
    vertical: null,
    attribution: "Source: City of San Antonio, Development Services, building permits (data.sanantonio.gov), CC BY.",
    filter: "Permit types Re-Roof Permit, Solar - Photovoltaic Permit, Foundation Repair Permit and Comm Foundation Permit, grouped by the contractor named as primary contact.",
  },
  {
    key: "permits_austin",
    label: "Austin building permits",
    datasetUrl: "https://data.austintexas.gov/d/3syk-w9eu",
    fetchUrl: "https://data.austintexas.gov/resource/3syk-w9eu.json",
    format: "soda",
    termsUrl: "https://data.austintexas.gov/download/2z87-8uh7/application/pdf",
    termsReadOn: null,
    allowed: null,
    state: "hold",
    why: "It runs once Robert records the City of Austin's open data terms: the terms PDF could not be read here. The dataset's own license reads public domain, which is not the City's terms.",
    schedule: null,
    vertical: null,
    attribution: "Source: City of Austin, issued construction permits (data.austintexas.gov).",
    filter: "Work class Roof; Auxiliary Power whose description names solar or PV; Repair whose description names foundation. Grouped by contractor company.",
  },
  {
    key: "permits_dallas",
    label: "Dallas building permits",
    datasetUrl: "https://www.dallasopendata.com/d/e7gq-4sah",
    fetchUrl: null,
    format: null,
    termsUrl: null,
    termsReadOn: null,
    allowed: null,
    state: "hold",
    why: "Waiting for the open records request Robert is sending: the dataset carries no license and its terms page was not found.",
    schedule: null,
    vertical: null,
    attribution: null,
    filter: "Roofing, solar and foundation repair permits, by contractor, once the terms are known.",
  },
  {
    key: "permits_fort_worth",
    label: "Fort Worth building permits",
    datasetUrl: "https://data.fortworthtexas.gov/d/quz7-xnsy",
    fetchUrl: null,
    format: null,
    termsUrl: "https://mapit.fortworthtexas.gov/disclaimer.pdf",
    termsReadOn: null,
    allowed: null,
    state: "hold",
    why: "Waiting for the open records request Robert is sending: the dataset moved and its fields could not be read, and it reportedly names no contractor.",
    schedule: null,
    vertical: null,
    attribution: null,
    filter: "Roofing, solar and foundation repair permits, by contractor, once a contractor field exists.",
  },
  {
    key: "permits_houston",
    label: "Houston building permits",
    datasetUrl: "https://www.houstonpermittingcenter.org/news-events/permit-activity-reports-now-available",
    fetchUrl: null,
    format: null,
    termsUrl: null,
    termsReadOn: null,
    allowed: null,
    state: "skip",
    why: "Houston publishes no permit-level dataset, only reports by ZIP code. The open records request Robert is sending asks for one.",
    schedule: null,
    vertical: null,
    attribution: null,
    filter: "None until a permit-level export with contractor names exists.",
  },
  {
    key: "permits_corpus_christi",
    label: "Corpus Christi building permits",
    datasetUrl: "https://www.corpuschristitx.gov/department-directory/development-services/reports/fiscal-permit-history-reports-by-month",
    fetchUrl: null,
    format: null,
    termsUrl: null,
    termsReadOn: null,
    allowed: null,
    state: "hold",
    why: "Waiting for the open records request Robert is sending: monthly reports exist, and their fields and terms were not read.",
    schedule: null,
    vertical: null,
    attribution: null,
    filter: "Roofing, solar and foundation repair permits, by contractor, once the fields and terms are known.",
  },
  {
    key: "tdlr_electrical",
    label: "TDLR electrical contractors",
    datasetUrl: "https://www.tdlr.texas.gov/LicenseSearch/licfile.asp",
    fetchUrl: "https://www.tdlr.texas.gov/dbproduction2/Lteecele.csv",
    format: "csv",
    termsUrl: TDLR_TERMS,
    termsReadOn: "2026-11-02",
    allowed: true,
    state: "ready",
    why: "TDLR's terms, read 2026-11-02, allow copying published information presented in a non-misleading way and naming TDLR as the source. Every row carries that attribution.",
    schedule: "daily",
    vertical: "other",
    attribution: TDLR_ATTRIBUTION,
    filter: "Every electrical contractor license not past its expiration date, one company per license, with its business name, address and phone.",
  },
  {
    key: "tdlr_solar_retailers",
    label: "TDLR residential solar retailers",
    datasetUrl: "https://www.tdlr.texas.gov/LicenseSearch/licfile.asp",
    fetchUrl: "https://www.tdlr.texas.gov/dbproduction2/vsResidentialSolarRetailers.csv",
    format: "csv",
    termsUrl: TDLR_TERMS,
    termsReadOn: "2026-11-02",
    allowed: true,
    state: "ready",
    why: "Added by Robert on 2026-11-02 (answer to 6588393366), under the same TDLR terms read that day. Every row carries the TDLR attribution.",
    schedule: "daily",
    vertical: "solar",
    attribution: TDLR_ATTRIBUTION,
    filter: "Registrations whose status is Current, one company per registration, with its address and phone.",
  },
  {
    key: "tdlr_solar_salespeople",
    label: "TDLR residential solar salespeople",
    datasetUrl: "https://www.tdlr.texas.gov/LicenseSearch/licfile.asp",
    fetchUrl: "https://www.tdlr.texas.gov/dbproduction2/vsResidentialSolarSalesperson.csv",
    format: "csv",
    termsUrl: TDLR_TERMS,
    termsReadOn: "2026-11-02",
    allowed: true,
    state: "ready",
    why: "Added by Robert on 2026-11-02 (answer to 6588393366), under the same TDLR terms. The file names the person and county only, with no telephone, so each waits in Held until a phone is found.",
    schedule: "daily",
    vertical: "solar",
    attribution: TDLR_ATTRIBUTION,
    filter: "Registrations whose status is Current, one person per registration.",
  },
  {
    key: "tdhca_mh",
    label: "TDHCA manufactured housing licensees",
    datasetUrl: "https://mhweb.tdhca.state.tx.us/mhweb/home_prod_summary.jsp",
    fetchUrl: null,
    format: null,
    termsUrl: null,
    termsReadOn: null,
    allowed: null,
    state: "hold",
    why: "The download page shows no fields, date or terms, and the agency's terms have not been read.",
    schedule: null,
    vertical: "manufactured_home_dealer",
    attribution: null,
    filter: "Licensed manufactured housing retailers, once the terms are read.",
  },
  {
    key: "trec",
    label: "TREC brokers and sales agents",
    datasetUrl: "https://data.texas.gov/dataset/Broker-and-Sales-Agent-License-Holder-Information/s7ft-44qi",
    fetchUrl: "https://data.texas.gov/resource/s7ft-44qi.json",
    format: "soda",
    termsUrl: "https://www.trec.texas.gov/public/high-value-data-sets",
    termsReadOn: "2026-11-02",
    allowed: true,
    state: "ready",
    why: "Published by TREC as a high value data set under Texas Government Code 2054.1265, with no restriction found, read 2026-11-02. The law removed phone, email and address, so every record waits in Held until a phone is found.",
    schedule: "daily",
    vertical: "real_estate",
    attribution: "Source: Texas Real Estate Commission license holder data (data.texas.gov).",
    filter: "Active broker companies, individual brokers and sales agents, one per license.",
  },
];

/** The declaration for a source, or null when the source has none (the spreadsheet and typed-in rows). */
export function sourceDecl(key: string): CrmSourceDecl | null {
  return CRM_SOURCE_DECLS.find((d) => d.key === key) ?? null;
}

/**
 * WHETHER A SOURCE MAY RUN, OR THE SENTENCE THAT REFUSES IT. Ready, terms read
 * on a recorded date, storage allowed, and something to fetch: all four, or it
 * does not run. Asserted by a proof against every declaration.
 */
export function sourceRefusal(decl: CrmSourceDecl | null): string | null {
  if (!decl) return "That is not a source the sales list imports from.";
  if (decl.state === "skip") return `${decl.label} is skipped. ${decl.why}`;
  if (decl.state !== "ready") return `${decl.label} is on hold. ${decl.why}`;
  if (!decl.termsReadOn || !/^\d{4}-\d{2}-\d{2}$/.test(decl.termsReadOn)) return `${decl.label} does not run: its terms have no recorded read date.`;
  if (decl.allowed !== true) return `${decl.label} does not run: its terms are not recorded as allowing storage.`;
  if (!decl.fetchUrl || !decl.format) return `${decl.label} does not run: nothing is declared to fetch.`;
  return null;
}

/** The sources a scheduled preview is queued for: ready, runnable and on a daily schedule. */
export function scheduledSources(): CrmSourceDecl[] {
  return CRM_SOURCE_DECLS.filter((d) => d.schedule === "daily" && sourceRefusal(d) === null);
}
