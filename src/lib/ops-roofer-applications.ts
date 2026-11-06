import "server-only";
import { randomBytes } from "node:crypto";
import { SITE_KEY, supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import { readEvery } from "./bounded-read";
import { DB_NOW } from "./db-now";
import { createCustomerAccount } from "./account-creation";
import { doorFor } from "./account-doors";
import { safeFilename } from "./uploads";
import {
  CERTIFICATE_MAX_BYTES,
  CERTIFICATE_TYPES,
  certificatePrefix,
  isOwnCertificatePath,
  type RooferApplicationInput,
  type RooferApplicationStatus,
  type RooferMonthlyVolume,
  type RooferService,
  type RooferWorkMix,
} from "./roofer-application";

/**
 * ===========================================================================
 * THE ROOFER APPLICATIONS: WRITTEN BY THE PUBLIC FORM, READ AND DECIDED BY A
 * PERSON HOLDING roofers.review.
 * Robert's rulings of 2026-11-05; the rules are in roofer-application.ts and
 * the table is 0113.
 * ===========================================================================
 *
 * WRITTEN IN ONE TRANSACTION. eng_take_roofer_application (0113) inserts the
 * application, finds or makes its roofer prospect, records the source row and
 * sets the due now review action, so an application never lands without the
 * prospect that puts it on the rep's list.
 *
 * DECIDED ONCE, BY A PERSON, WITH A REASON. Approve opens a B2B account
 * through door 2 exactly as converting a prospect does, and the welcome email
 * carries the set password link. Decline sends one plain email. The table's
 * trigger refuses a second decision, so a double click cannot approve twice.
 */

const BUCKET = "eng-uploads";
const CERTIFICATE_VIEW_SECONDS = 10 * 60;

const refuse = (error: string) => ({ ok: false as const, error });

export type RooferApplicationRow = {
  id: string;
  createdAt: string;
  legalName: string;
  dba: string | null;
  ownerName: string;
  ownerTitle: string;
  email: string;
  phone: string;
  officeCity: string;
  counties: string[];
  yearsInBusiness: number;
  crewCount: number;
  workMix: RooferWorkMix;
  roofsPerYear: number;
  services: RooferService[];
  monthlyVolume: RooferMonthlyVolume;
  insuranceCarrier: string;
  glPerOccurrence: string;
  glAggregate: string;
  reference1Name: string;
  reference1Company: string | null;
  reference1Phone: string;
  reference2Name: string;
  reference2Company: string | null;
  reference2Phone: string;
  certificatePath: string | null;
  prospectId: string;
  status: RooferApplicationStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  decidedByName: string | null;
  decisionReason: string | null;
  accountId: string | null;
};

const SELECT =
  "id, created_at, legal_name, dba, owner_name, owner_title, email, phone, office_city, counties, years_in_business, crew_count, work_mix, roofs_per_year, services, monthly_volume, insurance_carrier, gl_per_occurrence, gl_aggregate, reference1_name, reference1_company, reference1_phone, reference2_name, reference2_company, reference2_phone, certificate_path, prospect_id, status, decided_at, decided_by, decision_reason, account_id, decider:eng_profiles!eng_roofer_applications_decided_by_fkey(display_name)";

function toRow(r: Record<string, unknown>): RooferApplicationRow {
  const decider = r.decider as { display_name?: string } | null;
  return {
    id: String(r.id),
    createdAt: String(r.created_at),
    legalName: String(r.legal_name),
    dba: (r.dba as string | null) ?? null,
    ownerName: String(r.owner_name),
    ownerTitle: String(r.owner_title),
    email: String(r.email),
    phone: String(r.phone),
    officeCity: String(r.office_city),
    counties: (r.counties as string[]) ?? [],
    yearsInBusiness: Number(r.years_in_business),
    crewCount: Number(r.crew_count),
    workMix: r.work_mix as RooferWorkMix,
    roofsPerYear: Number(r.roofs_per_year),
    services: (r.services as RooferService[]) ?? [],
    monthlyVolume: r.monthly_volume as RooferMonthlyVolume,
    insuranceCarrier: String(r.insurance_carrier),
    glPerOccurrence: String(r.gl_per_occurrence),
    glAggregate: String(r.gl_aggregate),
    reference1Name: String(r.reference1_name),
    reference1Company: (r.reference1_company as string | null) ?? null,
    reference1Phone: String(r.reference1_phone),
    reference2Name: String(r.reference2_name),
    reference2Company: (r.reference2_company as string | null) ?? null,
    reference2Phone: String(r.reference2_phone),
    certificatePath: (r.certificate_path as string | null) ?? null,
    prospectId: String(r.prospect_id),
    status: r.status as RooferApplicationStatus,
    decidedAt: (r.decided_at as string | null) ?? null,
    decidedBy: (r.decided_by as string | null) ?? null,
    decidedByName: decider?.display_name ?? null,
    decisionReason: (r.decision_reason as string | null) ?? null,
    accountId: (r.account_id as string | null) ?? null,
  };
}

/* ------------------------------------------------------------- the public half */

/**
 * A signed URL for the certificate, under this application's own prefix, with a
 * random segment so nothing is overwritten (the shape auth audit L3 gave the
 * careers uploads). Counted on the upload limiter by the route before this runs.
 */
export async function signCertificateUpload(input: {
  applicationId: string;
  filename: string;
  contentType: string;
  size: number;
}): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return refuse("Uploads are not configured, so the certificate could not be attached. Send it with your application by email instead.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.applicationId)) {
    return refuse("Malformed application reference.");
  }
  if (!(CERTIFICATE_TYPES as readonly string[]).includes(input.contentType)) {
    return refuse("That file type is not accepted. Attach a PDF or a photo of the certificate.");
  }
  if (!Number.isFinite(input.size) || input.size <= 0) return refuse("That file looks empty.");
  if (input.size > CERTIFICATE_MAX_BYTES) return refuse("That file is over 10MB. Attach a smaller copy, or a photo of the certificate.");

  const path = `${certificatePrefix(SITE_KEY, input.applicationId)}certificate-${randomBytes(4).toString("hex")}-${safeFilename(input.filename)}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (error || !data) return refuse("The upload could not be prepared. Try again, or send the certificate with your application by email.");
  return { ok: true, url: data.signedUrl, path: data.path };
}

/**
 * Write one application, its prospect and its source row in one transaction.
 * A certificate key that is not this application's own is refused before
 * anything is written, so a row can never claim a file another upload made.
 */
export async function takeRooferApplication(
  input: RooferApplicationInput,
  context: { userAgent: string | null },
): Promise<{ ok: true; applicationId: string; prospectId: string } | { ok: false; error: string; status: 409 | 422 | 503 }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The application could not be saved, so nothing was recorded.", status: 503 };
  if (input.certificatePath && !isOwnCertificatePath(input.certificatePath, SITE_KEY, input.applicationId)) {
    return { ok: false, error: "The certificate attached does not belong to this application. Attach it again.", status: 422 };
  }

  const { data, error } = await db.rpc("eng_take_roofer_application", {
    p: {
      id: input.applicationId,
      legal_name: input.legalName,
      dba: input.dba ?? "",
      owner_name: input.ownerName,
      owner_title: input.ownerTitle,
      email: input.email,
      phone: input.phone,
      office_city: input.officeCity,
      counties: input.counties,
      years_in_business: input.yearsInBusiness,
      crew_count: input.crewCount,
      work_mix: input.workMix,
      roofs_per_year: input.roofsPerYear,
      services: input.services,
      monthly_volume: input.monthlyVolume,
      insurance_carrier: input.insuranceCarrier,
      gl_per_occurrence: input.glPerOccurrence,
      gl_aggregate: input.glAggregate,
      reference1_name: input.reference1Name,
      reference1_company: input.reference1Company ?? "",
      reference1_phone: input.reference1Phone,
      reference2_name: input.reference2Name,
      reference2_company: input.reference2Company ?? "",
      reference2_phone: input.reference2Phone,
      certificate_path: input.certificatePath ?? "",
      landing_path: input.landingPath ?? "",
      referrer: input.referrer ?? "",
      user_agent: context.userAgent ?? "",
    },
  });

  if (error) {
    /* The same id twice is a second press of Send after the first landed: it is already saved. */
    if (error.code === "23505" && /eng_roofer_applications_pkey/.test(error.message)) {
      return { ok: false, error: "This application was already received.", status: 409 };
    }
    console.error(`[roofer-application] not saved: ${error.message}`);
    return { ok: false, error: "The application could not be saved, so nothing was recorded.", status: 503 };
  }
  const result = data as { application_id: string; prospect_id: string };

  await writeAudit({
    actor: null,
    action: "roofer_application.received",
    entityType: "roofer_application",
    entityId: result.application_id,
    summary: `A roofer partner application from ${input.legalName} was received.`,
    diff: { prospect_id: result.prospect_id },
    userAgent: context.userAgent,
  });
  return { ok: true, applicationId: result.application_id, prospectId: result.prospect_id };
}

/* --------------------------------------------------------- the reviewer's half */

export type RooferListQuery = {
  status?: RooferApplicationStatus | "all";
  q?: string;
  sort?: "newest" | "oldest" | "company";
};

/** Every application the query names, read whole (no silent cap), newest first by default. */
export async function listRooferApplications(
  actor: Actor | null,
  query: RooferListQuery = {},
): Promise<{ ok: true; rows: RooferApplicationRow[] } | { ok: false; error: string }> {
  if (!actor || !can(actor, "roofers.review")) return refuse("Your role cannot read roofer applications.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so no application could be read.");

  const status = query.status && query.status !== "all" ? query.status : null;
  const read = await readEvery<Record<string, unknown>>((from, to) => {
    let q = db.from("eng_roofer_applications").select(SELECT);
    if (status) q = q.eq("status", status);
    return q.order("created_at", { ascending: query.sort === "oldest" }).order("id", { ascending: true }).range(from, to);
  });
  if (!read.ok) return refuse(`The applications could not be read: ${read.error}`);

  let rows = read.rows.map(toRow);
  const needle = (query.q ?? "").trim().toLowerCase();
  if (needle) {
    const digits = needle.replace(/\D/g, "");
    rows = rows.filter((r) =>
      [r.legalName, r.dba ?? "", r.ownerName, r.email, r.officeCity, r.insuranceCarrier, ...r.counties]
        .some((v) => v.toLowerCase().includes(needle)) ||
      (digits.length >= 3 && [r.phone, r.reference1Phone, r.reference2Phone].some((p) => p.replace(/\D/g, "").includes(digits))),
    );
  }
  if (query.sort === "company") rows = [...rows].sort((a, b) => a.legalName.localeCompare(b.legalName));
  return { ok: true, rows };
}

/** How many wait for a decision, for the home tile and the tab title. Null when unreadable. */
export async function rooferApplicationsWaiting(actor: Actor | null): Promise<number | null> {
  if (!actor || !can(actor, "roofers.review")) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { count, error } = await db
    .from("eng_roofer_applications")
    .select("id", { count: "exact", head: true })
    .eq("status", "received");
  return error || count === null ? null : count;
}

/** One application, with a ten minute link to its certificate when it has one. */
export async function rooferApplicationById(
  actor: Actor | null,
  id: string,
): Promise<{ ok: true; row: RooferApplicationRow; certificateUrl: string | null; certificateError: string | null } | { ok: false; error: string }> {
  if (!actor || !can(actor, "roofers.review")) return refuse("Your role cannot read roofer applications.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so the application could not be read.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return refuse("That is not an application reference.");
  const { data, error } = await db.from("eng_roofer_applications").select(SELECT).eq("id", id).maybeSingle();
  if (error) return refuse(`The application could not be read: ${error.message}`);
  if (!data) return refuse("That application does not exist.");
  const row = toRow(data as Record<string, unknown>);

  let certificateUrl: string | null = null;
  let certificateError: string | null = null;
  if (row.certificatePath) {
    const signed = await db.storage.from(BUCKET).createSignedUrl(row.certificatePath, CERTIFICATE_VIEW_SECONDS);
    if (signed.error || !signed.data) certificateError = "The certificate is on record and could not be opened just now. Reload the page to try again.";
    else certificateUrl = signed.data.signedUrl;
  }
  return { ok: true, row, certificateUrl, certificateError };
}

export type RooferDecision =
  | {
      ok: true;
      decision: "approved";
      accountId: string;
      email: string;
      ownerName: string;
      link: { token: string; expiresIn: string } | null;
    }
  | { ok: true; decision: "declined"; email: string; ownerName: string; legalName: string }
  | { ok: false; error: string };

/**
 * One decision, by a person, with a reason. The reason is the reviewer's note
 * for the firm's record and is never sent to the roofer.
 */
export async function decideRooferApplication(
  actor: (Actor & { email: string }) | null,
  input: { id: string; decision: "approved" | "declined"; reason: string },
): Promise<RooferDecision> {
  if (!actor || !can(actor, "roofers.review")) return refuse("Your role cannot decide roofer applications.");
  const reason = input.reason.trim();
  if (reason.length < 3) return refuse("Write the reason for the decision. It stays on the firm's record and is not sent to the roofer.");
  if (reason.length > 2000) return refuse("Keep the reason under 2,000 characters.");

  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so nothing was decided.");
  const read = await rooferApplicationById(actor, input.id);
  if (!read.ok) return read;
  const app = read.row;
  if (app.status !== "received") return refuse(`This application was already ${app.status}.`);

  const recorded = await writeAuditOrRefuse({
    actor,
    action: input.decision === "approved" ? "roofer_application.approving" : "roofer_application.declining",
    entityType: "roofer_application",
    entityId: app.id,
    summary: `${input.decision === "approved" ? "Approving" : "Declining"} the roofer partner application from ${app.legalName}.`,
  });
  if (!recorded.ok) return recorded;

  if (input.decision === "declined") {
    const { data, error } = await db
      .from("eng_roofer_applications")
      .update({ status: "declined", decided_at: DB_NOW, decided_by: actor.id, decision_reason: reason })
      .eq("id", app.id)
      .eq("status", "received")
      .select("id");
    if (error) return refuse(`The decline could not be recorded: ${error.message}`);
    if (!data || data.length !== 1) return refuse("This application was decided by somebody else a moment ago. Reload to see it.");
    /* The review is done; the company stays on the sales list with no review due. */
    await db
      .from("eng_prospects")
      .update({ next_action_at: null, next_action_kind: null })
      .eq("id", app.prospectId)
      .eq("next_action_kind", "review_application");
    await writeAuditOrRefuse({
      actor,
      action: "roofer_application.declined",
      entityType: "roofer_application",
      entityId: app.id,
      summary: `Declined the roofer partner application from ${app.legalName}.`,
      diff: { reason },
    });
    return { ok: true, decision: "declined", email: app.email, ownerName: app.ownerName, legalName: app.legalName };
  }

  /* Approve: a B2B account through door 2, exactly as converting a prospect opens one. */
  const created = await createCustomerAccount({
    email: app.email,
    displayName: app.ownerName,
    organisation: app.legalName,
    phone: app.phone,
    origin: doorFor("operator_created").origin,
    actor: { id: actor.id, email: actor.email, role: actor.role },
  });
  if (!created.ok) {
    return refuse(
      created.error === "already_exists"
        ? "That email address already has an account. Open it from the account list, then decline this application with that as the reason."
        : created.error,
    );
  }

  const { data: account, error: accountError } = await db
    .from("eng_customer_accounts")
    .select("id, client_id")
    .eq("id", created.accountId)
    .is("superseded_at", null)
    .maybeSingle();
  if (accountError || !account) {
    return refuse(`The account was opened and could not be read back to record the approval: ${accountError?.message ?? "no row"}.`);
  }

  const { data: decided, error: decideError } = await db
    .from("eng_roofer_applications")
    .update({ status: "approved", decided_at: DB_NOW, decided_by: actor.id, decision_reason: reason, account_id: account.id })
    .eq("id", app.id)
    .eq("status", "received")
    .select("id");
  if (decideError || !decided || decided.length !== 1) {
    return refuse(`The account was opened as ${String(account.id)} and the approval could not be recorded: ${decideError?.message ?? "somebody else decided it first"}.`);
  }

  /* The prospect becomes the customer it now is, if it was still open. */
  await db
    .from("eng_prospects")
    .update({
      status: "converted",
      stage: "account_opened",
      converted_at: DB_NOW,
      converted_by: actor.id,
      converted_client_id: account.client_id,
      converted_account_id: account.id,
      next_action_at: null,
      next_action_kind: null,
    })
    .eq("id", app.prospectId)
    .eq("status", "open");

  await writeAuditOrRefuse({
    actor,
    action: "roofer_application.approved",
    entityType: "roofer_application",
    entityId: app.id,
    summary: `Approved the roofer partner application from ${app.legalName}; account ${String(account.id)} opened through door 2.`,
    diff: { account_id: account.id, client_id: account.client_id, reason },
  });
  return { ok: true, decision: "approved", accountId: String(account.id), email: app.email, ownerName: app.ownerName, link: created.link };
}
