import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { holdsLicence, type Actor } from "./ops-authz";
import { verifyFreshCode } from "./ops-mfa";
import type { ProfileRow } from "./ops-auth";
import { readImageForSealing } from "./seal-store";
import { answersFor } from "./ops-file-inputs";
import { transitionFile } from "./ops-crm";
import { orderForFile, settleDecision } from "./ops-payments";
import { writeAudit } from "./ops-audit";
import { DB_NOW } from "./db-now";
import { raise } from "./ops-notify";
import { isPrelaunch, registrationLine, firmName, activeFirmRegistration, licenceIsCurrentToday } from "./launch";
import { verifiedEngineers } from "@/config/credentials";
import { business } from "@/config/business";
import { protocolByDocument } from "@/content/protocols";
import { draftRoofLetter, letterDate, producesLetter, type DraftLine, type LetterFacts, type LetterDraft } from "./letter-draft";
import { draftFoundationLetter, draftPermitLetter, producesFoundationLetter } from "./letter-draft-fc-pl";
import { methodFor } from "@/content/letters/foundation-certification";
import { STRUCTURED_DECLARATIONS } from "@/content/protocols/structured";
import { recordedFactsFor, triageFor } from "./letter-facts";
import { templateToSealFrom } from "./letter-template-sign";
import { letterNeedsTemplate } from "@/content/letters/templates";
import { renderLetterPdf } from "./letter-pdf";
import { LETTERHEAD_MARK } from "@/content/letters/letterhead-mark";

/**
 * ===========================================================================
 * SEALING A LETTER: THE ONE PLACE THE SEAL AND SIGNATURE IMAGES ARE READ.
 * ===========================================================================
 *
 * Sealing piece two, built 2026-10-07 to the controls in
 * docs/sealing-controls.md. In order, and each step refuses with a sentence:
 *
 *   1. the gate is open (a file reaches sealed only when the firm is trading);
 *   2. the actor holds the licence AND is the engineer who recorded this
 *      determination (control 3; 0062 checks the same at the database);
 *   3. the determination is one that produces a letter, and has no live seal;
 *   4. the draft fills every slot from the file (the recipient's address and
 *      salutation are the two the file does not hold, entered by the engineer
 *      here and printed exactly as typed);
 *   5. a FRESH TOTP code, spent atomically (control 4);
 *   6. his current seal and signature images are read from the private bucket,
 *      here and nowhere else (control 2);
 *   7. the PDF is rendered once, hashed, and stored (controls 5, 6, 7);
 *   8. eng_record_letter_seal records the document and the seal act in one
 *      transaction, which the database audits (controls 3, 9);
 *   9. on a passing determination the file moves to sealed and then
 *      delivered, the order settles, and the order is complete.
 *
 * Steps 1 to 6 change nothing. A failure at 7 or 8 removes the object it
 * stored, so no unrecorded PDF sits in the bucket. A failure at 9 does NOT undo
 * the seal: an engineer's sealed document is not contingent on a status move,
 * and the failure is reported so the operator can see it.
 */

const DOCUMENT_BUCKET = "eng-documents";

/** The signed-in person as currentActor() returns them: the grants and the profile row. */
type SignedIn = Actor & ProfileRow;

export type SealInput = {
  determinationId: string;
  code: string;
  recipientAddress: string;
  recipientSalutation: string;
  /* The foundation letter's "Observed condition:", in his words, typed at sealing (template 4). */
  observedCondition?: string;
  context?: { ip?: string | null; userAgent?: string | null };
};

export type SealResult =
  | { ok: true; documentId: string; sha256: string; delivered: boolean; warning: string | null }
  | { ok: false; error: string };

type DeterminationRow = {
  id: string;
  file_id: string;
  protocol_document: string;
  determination: string;
  engineer_id: string;
  decided_at: string;
  /* 0083: a permit letter's option and schedule. */
  letter_option: "A" | "B" | "C" | null;
  letter_conditions: string[] | null;
  /* 0051: the evidence he relied on, which is a desk job's documents schedule (PL-5). */
  relied_on_evidence_ids: string[] | null;
};

async function determination(id: string): Promise<DeterminationRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_determinations")
    .select("id, file_id, protocol_document, determination, engineer_id, decided_at, letter_option, letter_conditions, relied_on_evidence_ids")
    .eq("id", id)
    .maybeSingle();
  return (data as DeterminationRow | null) ?? null;
}

/** The three protocols whose letters are built: roof, and since ruling 7 of 2026-10-23, foundation and permit. */
export const SEALABLE_PROTOCOLS = ["254-RC-001", "254-FC-001", "254-PL-001"] as const;

/**
 * THE VERSION A LETTER PRINTS IS THE ONE THE FILE RAN UNDER. Robert's answer
 * on L2a, 2026-10-25: printed from the file's own protocol_template_id, never
 * the code's current declaration. A file that names no template, names
 * another protocol, or ran under a version other than the transcription this
 * platform carries is refused: its checklist labels would be another
 * version's words, and the letter would state items the job was not run to.
 */
async function versionRunUnder(
  db: NonNullable<ReturnType<typeof supabaseAdmin>>,
  templateId: string | null,
  document: string,
  carried: string,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  if (!templateId) return { ok: false, error: "This file records no protocol it was run under, so the letter cannot state one. Nothing was drafted." };
  const { data, error } = await db
    .from("eng_protocol_templates")
    .select("document_number, version_label")
    .eq("id", templateId)
    .maybeSingle();
  if (error) return { ok: false, error: `The protocol this file ran under could not be read: ${error.message}. Nothing was drafted.` };
  if (!data) return { ok: false, error: "The protocol this file names does not exist, so the letter cannot state one. Nothing was drafted." };
  if (data.document_number !== document) {
    return { ok: false, error: `This file ran under ${data.document_number ?? "an unnumbered protocol"}, not ${document}, so this letter is not drafted.` };
  }
  const version = (data.version_label as string | null) ?? null;
  if (!version) return { ok: false, error: `The protocol this file ran under records no version, so the letter cannot state one. Nothing was drafted.` };
  if (version !== carried) {
    return {
      ok: false,
      error: `This file ran under ${document} version ${version}, and this platform carries version ${carried}, so the letter would state another version's items. Nothing was drafted.`,
    };
  }
  return { ok: true, version };
}

/**
 * THE VISIT AND THE COUNT, FROM THE EVIDENCE THAT STANDS. Robert's answer on
 * L2b, 2026-10-25: the visit date is the technician's recorded visit, in
 * America/Chicago, excluding revision-requested evidence; the evidence count
 * counts only accepted evidence. The visit is the earliest capture among the
 * evidence that was not sent back, printed by letterDate in the firm's zone.
 */
function visitAndCount(evidence: { status?: unknown; captured_at?: unknown }[]): { visitDate: string | null; count: number } {
  const standing = evidence.filter((e) => e.status !== "revision_requested");
  const captured = standing
    .map((e) => e.captured_at as string | null)
    .filter((t): t is string => Boolean(t))
    .sort();
  return {
    visitDate: captured.length ? letterDate(captured[0]) : null,
    count: evidence.filter((e) => e.status === "accepted").length,
  };
}

/** A checklist key with no label in the signed declaration refuses the draft (L2a): a raw key is not his words. */
function unlabelled(keys: string[], checklist: readonly { key: string; label: string }[]): string | null {
  const missing = [...new Set(keys.filter((k) => !checklist.some((i) => i.key === k && i.label)))];
  return missing.length
    ? `The checklist item${missing.length === 1 ? "" : "s"} ${missing.join(", ")} ha${missing.length === 1 ? "s" : "ve"} no label in the signed declaration, so the letter is not drafted.`
    : null;
}

/**
 * Every fact the letter reads from the file, by the sources template 1 section
 * 2.2 names. The two recipient facts the file does not hold are passed in.
 */
export async function letterFactsFor(
  det: DeterminationRow,
  entered: { recipientAddress: string; recipientSalutation: string },
): Promise<{ ok: true; facts: LetterFacts; title: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  const protocol = protocolByDocument(det.protocol_document);
  if (!protocol) return { ok: false, error: `${det.protocol_document} is not a registered protocol.` };
  if (det.protocol_document !== "254-RC-001") {
    return {
      ok: false,
      error: `Only the roof certification letter (template 1) is built. ${det.protocol_document} has no letter yet.`,
    };
  }

  const { data: file, error: fileError } = await db
    .from("eng_files")
    .select("id, file_number, property_address, county, client_id, protocol_template_id")
    .eq("id", det.file_id)
    .maybeSingle();
  if (fileError || !file) return { ok: false, error: "The file this determination belongs to could not be read." };

  const ranUnder = await versionRunUnder(db, (file.protocol_template_id as string | null) ?? null, det.protocol_document, protocol.declaration.version);
  if (!ranUnder.ok) return ranUnder;

  const { data: evidence, error: evidenceError } = await db
    .from("eng_evidence_items")
    .select("captured_at, status")
    .eq("file_id", det.file_id);
  if (evidenceError) return { ok: false, error: `The evidence could not be counted: ${evidenceError.message}` };
  const visit = visitAndCount(evidence ?? []);

  const { data: exceptions, error: exceptionError } = await db
    .from("eng_checklist_exceptions")
    .select("item_key, kind, reason")
    .eq("file_id", det.file_id)
    .eq("kind", "not_observed");
  if (exceptionError) return { ok: false, error: `The items not observed could not be read: ${exceptionError.message}` };
  const missingLabel = unlabelled((exceptions ?? []).map((x) => x.item_key as string), protocol.declaration.checklist);
  if (missingLabel) return { ok: false, error: missingLabel };
  const labelFor = (key: string) => protocol.declaration.checklist.find((i) => i.key === key)!.label;
  const notObserved = (exceptions ?? []).map((x) => `${labelFor(x.item_key as string)} (${(x.reason as string).trim()})`);

  const answers = await answersFor(det.file_id);
  const recipient = answers[`${protocol.fieldPrefix}_q2`] ?? null;

  const facts: LetterFacts = {
    determination_date: letterDate(det.decided_at),
    recipient_name: recipient,
    recipient_address: entered.recipientAddress,
    recipient_salutation: entered.recipientSalutation,
    property_address: file.property_address as string,
    county: file.county as string,
    file_number: file.file_number as string,
    visit_date: visit.visitDate,
    protocol_number: protocol.declaration.documentNumber,
    /* The version the file ran under (L2a), which versionRunUnder has matched to the transcription. */
    protocol_version: ranUnder.version,
    evidence_count: String(visit.count),
    /*
     * "none" when every item was observed. His line reads "Items the protocol
     * required that were not observed, and the reason recorded for each:" and
     * he asked for them to be listed; an empty list would leave the colon
     * answering nothing.
     */
    items_not_observed: notObserved.length ? notObserved.join("; ") : "none",
  };
  return { ok: true, facts, title: `Roof certification, ${file.property_address}, file ${file.file_number}` };
}

/**
 * THE FILE'S COMMON FACTS FOR THE FOUNDATION AND PERMIT LETTERS: the file, the
 * client's name (the requestor), the captures and the items not observed,
 * labelled from the structured declaration he signed.
 */
async function fileFactsFor(det: DeterminationRow, options: { printsProtocolVersion: boolean }) {
  const db = supabaseAdmin();
  if (!db) return { ok: false as const, error: "The database is not configured." };
  const declaration = STRUCTURED_DECLARATIONS.find((d) => d.documentNumber === det.protocol_document);
  if (!declaration) return { ok: false as const, error: `${det.protocol_document} has no signed declaration in this platform.` };
  const { data: file, error: fileError } = await db
    .from("eng_files")
    .select("id, file_number, property_address, county, client_id, protocol_template_id")
    .eq("id", det.file_id)
    .maybeSingle();
  if (fileError || !file) return { ok: false as const, error: "The file this determination belongs to could not be read." };
  /* L2a: only a letter that prints the protocol's version needs to know which one the file ran under. */
  let protocolVersion: string | null = null;
  if (options.printsProtocolVersion) {
    const ranUnder = await versionRunUnder(db, (file.protocol_template_id as string | null) ?? null, det.protocol_document, declaration.version);
    if (!ranUnder.ok) return ranUnder;
    protocolVersion = ranUnder.version;
  }
  const { data: client } = await db.from("eng_clients").select("name").eq("id", file.client_id as string).maybeSingle();
  const { data: evidence, error: evidenceError } = await db
    .from("eng_evidence_items")
    .select("id, item_key, captured_at, status")
    .eq("file_id", det.file_id);
  if (evidenceError) return { ok: false as const, error: `The evidence could not be read: ${evidenceError.message}` };
  const visit = visitAndCount(evidence ?? []);
  const { data: exceptions, error: exceptionError } = await db
    .from("eng_checklist_exceptions")
    .select("item_key, reason")
    .eq("file_id", det.file_id)
    .eq("kind", "not_observed");
  if (exceptionError) return { ok: false as const, error: `The items not observed could not be read: ${exceptionError.message}` };
  const checklist = declaration.checklist as readonly { key: string; label: string }[];
  /* Every not-observed item the letter prints has his label, or nothing is drafted (L2a). */
  const missingLabel = unlabelled((exceptions ?? []).map((x) => x.item_key as string), checklist);
  if (missingLabel) return { ok: false as const, error: missingLabel };
  /* Null for a key with no label; a caller printing one checks with unlabelled first. */
  const labelFor = (key: string) => checklist.find((i) => i.key === key)?.label ?? null;
  const unlabelledOf = (keys: string[]) => unlabelled(keys, checklist);
  return {
    ok: true as const,
    declaration,
    file,
    protocolVersion,
    requestor: (client?.name as string | undefined) ?? null,
    evidence: evidence ?? [],
    /* Accepted evidence only (L2b). */
    evidenceCount: visit.count,
    visitDate: visit.visitDate,
    notObserved: (exceptions ?? []).map((x) => `${labelFor(x.item_key as string)} (${(x.reason as string).trim()})`),
    labelFor,
    unlabelledOf,
  };
}

/** Template 4, ruling FC-1 to FC-4: the facts from the file, the type as he confirmed it, his observation as typed. */
async function foundationDraft(
  det: DeterminationRow,
  entered: { recipientAddress: string; recipientSalutation: string; observedCondition: string },
): Promise<{ ok: true; lines: DraftLine[]; title: string } | { ok: false; error: string }> {
  /* Template 4 prints the protocol's version, so it is the one the file ran under (L2a). */
  const base = await fileFactsFor(det, { printsProtocolVersion: true });
  if (!base.ok) return base;
  const answers = await answersFor(det.file_id);
  const recorded = await recordedFactsFor(det.file_id);
  if (!recorded) return { ok: false, error: "The letter's recorded facts could not be read, so nothing was drafted." };
  /* FC-3: the type that prints is the one he confirmed at review, never the customer's answer alone. */
  const confirmed = recorded.foundation_type?.value ?? null;
  const draft = draftFoundationLetter(
    det.determination,
    {
      determination_date: letterDate(det.decided_at),
      recipient_name: answers.addressed_to ?? null,
      recipient_address: entered.recipientAddress,
      recipient_salutation: entered.recipientSalutation,
      property_address: base.file.property_address as string,
      county: base.file.county as string,
      file_number: base.file.file_number as string,
      purpose_verbatim: answers.reason ?? null,
      requestor_name: base.requestor,
      inspection_date: base.visitDate,
      foundation_type: confirmed,
      method: confirmed ? methodFor(confirmed) : null,
      protocol_number: base.declaration.documentNumber,
      protocol_version: base.protocolVersion,
      evidence_count: String(base.evidenceCount),
      items_not_observed: base.notObserved.length ? base.notObserved.join("; ") : "none",
    },
    entered.observedCondition,
  );
  if (!draft.ok) return { ok: false, error: draft.why };
  return { ok: true, lines: draft.lines, title: `Foundation certification, ${base.file.property_address}, file ${base.file.file_number}` };
}

/** Template 7, rulings of 2026-10-22 and ruling 7: every fact recorded, the basis from his triage only. */
async function permitDraft(det: DeterminationRow): Promise<{ ok: true; lines: DraftLine[]; title: string } | { ok: false; error: string }> {
  /* Template 7 prints no protocol version; a desk job may never have been dispatched under a template. */
  const base = await fileFactsFor(det, { printsProtocolVersion: false });
  if (!base.ok) return base;
  const answers = await answersFor(det.file_id);
  const recorded = await recordedFactsFor(det.file_id);
  if (!recorded) return { ok: false, error: "The letter's recorded facts could not be read, so nothing was drafted." };
  const triage = await triageFor(det.file_id);
  if (!triage.ok) return { ok: false, error: triage.error };
  /* PL-5: a desk job's documents schedule is the evidence he marked relied on in this determination. */
  const relied = new Set(det.relied_on_evidence_ids ?? []);
  const reliedOn = base.evidence.filter((e) => relied.has(e.id as string));
  /* Each document the schedule names has his label, or nothing is drafted (L2a). */
  const missingLabel = base.unlabelledOf(reliedOn.map((e) => e.item_key as string));
  if (missingLabel) return { ok: false, error: missingLabel };
  const documents = reliedOn.map((e) => `${base.labelFor(e.item_key as string)}${e.captured_at ? `, ${letterDate(e.captured_at as string)}` : ""}`);
  const draft = draftPermitLetter({
    determination: det.determination,
    option: det.letter_option,
    conditions: det.letter_conditions ?? [],
    basis: triage.basis,
    documents,
    facts: {
      determination_date: letterDate(det.decided_at),
      authority_name: answers.authority_name ?? null,
      authority_address: recorded.authority_address?.value ?? null,
      authority_salutation: recorded.authority_salutation?.value ?? null,
      /* PL-3: the element as he reviewed it. */
      element_described: recorded.element_described?.value ?? null,
      property_address: base.file.property_address as string,
      county: base.file.county as string,
      permit_number: answers.permit_number ?? null,
      file_number: base.file.file_number as string,
      requestor_name: base.requestor,
      authority_requirement_verbatim: answers.question_text ?? null,
      visit_date: base.visitDate,
      /* Accepted evidence only (L2b). */
      evidence_count: String(base.evidenceCount),
    },
  });
  if (!draft.ok) return { ok: false, error: draft.why };
  return { ok: true, lines: draft.lines, title: `Structural letter for permit, ${base.file.property_address}, file ${base.file.file_number}` };
}

type Entered = { recipientAddress: string; recipientSalutation: string; observedCondition?: string };

/** The draft for any built letter, by its protocol. Roof's path is exactly what it was. */
async function draftFor(det: DeterminationRow, entered: Entered): Promise<{ ok: true; lines: DraftLine[]; title: string } | { ok: false; error: string }> {
  if (det.protocol_document === "254-FC-001") {
    return foundationDraft(det, { ...entered, observedCondition: entered.observedCondition ?? "" });
  }
  if (det.protocol_document === "254-PL-001") return permitDraft(det);
  const facts = await letterFactsFor(det, entered);
  if (!facts.ok) return { ok: false, error: facts.error };
  if (!producesLetter(det.determination)) return { ok: false, error: `A ${det.determination} determination produces no letter.` };
  const draft = draftRoofLetter(det.determination, facts.facts);
  if (!draft.ok) return { ok: false, error: draft.why };
  return { ok: true, lines: draft.lines, title: facts.title };
}

/** Whether a determination of this protocol produces a letter: FC-1 for foundation, 2026-10-22 for permit. */
function determinationProducesLetter(protocol: string, determination: string): boolean {
  if (protocol === "254-FC-001") return producesFoundationLetter(determination);
  if (protocol === "254-PL-001") return determination === "pass" || determination === "repairs-required";
  return producesLetter(determination);
}

/** The draft, for the engineer to read before he seals. Reads no image. */
export async function draftForDetermination(
  actor: SignedIn | null,
  determinationId: string,
  entered: Entered,
): Promise<LetterDraft | { ok: false; why: string; missing: [] }> {
  if (!holdsLicence(actor, "documents.seal")) return { ok: false, why: "Only the engineer of record drafts and seals a letter.", missing: [] };
  const det = await determination(determinationId);
  if (!det) return { ok: false, why: "That determination does not exist.", missing: [] };
  if (det.engineer_id !== actor!.id) {
    return { ok: false, why: "Only the engineer who recorded this determination can draft its letter.", missing: [] };
  }
  const built = await draftFor(det, entered);
  if (!built.ok) return { ok: false, why: built.error, missing: [] };
  return { ok: true, lines: built.lines, determination: det.determination as LetterDraft extends { determination: infer D } ? D : never };
}

export async function sealLetter(actor: SignedIn | null, input: SealInput): Promise<SealResult> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };

  // 1. The gate.
  if (isPrelaunch()) {
    return {
      ok: false,
      error: "The firm cannot issue a sealed document while the launch gate is shut. Nothing was sealed.",
    };
  }

  // 2. Who.
  if (!holdsLicence(actor, "documents.seal")) {
    return { ok: false, error: "Only the engineer of record seals a letter. No other role can stand in for him." };
  }
  const det = await determination(input.determinationId);
  if (!det) return { ok: false, error: "That determination does not exist." };
  if (det.engineer_id !== actor!.id) {
    return { ok: false, error: "Only the engineer who recorded this determination can seal its letter." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return {
      ok: false,
      error: "Your license number on this account does not match the engineer on the firm's register, so nothing is sealed under it.",
    };
  }
  /*
   * AND THE LICENCE IS CURRENT TODAY. Robert's answer on L2e, 2026-10-25:
   * sealing checks the expiry, not only that the number is on the register. An
   * unrecorded expiry is not a current licence (licenceIsCurrent). Read
   * through licenceIsCurrentToday, the one declared reader of "today" for a
   * licence, which judges it on the firm's calendar (finding F6).
   */
  if (!licenceIsCurrentToday(engineer.expires)) {
    return {
      ok: false,
      error: engineer.expires
        ? `The license on the firm's register expired on ${engineer.expires}, so nothing is sealed under it.`
        : "The license on the firm's register has no expiry recorded, and an unrecorded expiry is not a current license, so nothing is sealed under it.",
    };
  }
  const registration = activeFirmRegistration();
  if (!registration) return { ok: false, error: "The firm has no active registration on record, so nothing is sealed." };

  // 3. What.
  if (!(SEALABLE_PROTOCOLS as readonly string[]).includes(det.protocol_document)) {
    return { ok: false, error: `${det.protocol_document} has no letter built, so nothing is sealed.` };
  }
  if (!determinationProducesLetter(det.protocol_document, det.determination)) {
    return { ok: false, error: `A ${det.determination} determination produces no letter.` };
  }
  const { data: live, error: liveError } = await db
    .from("eng_seal_acts")
    .select("id")
    .eq("determination_id", det.id)
    .is("voided_at", null)
    .maybeSingle();
  if (liveError) return { ok: false, error: `Whether this letter is already sealed could not be read: ${liveError.message}` };
  if (live) return { ok: false, error: "This determination's letter is already sealed." };

  // 4. The draft.
  const draft = await draftFor(det, {
    recipientAddress: input.recipientAddress,
    recipientSalutation: input.recipientSalutation,
    observedCondition: input.observedCondition,
  });
  if (!draft.ok) return { ok: false, error: draft.error };
  const facts = { title: draft.title };

  /*
   * 4b. The template he signed, before the code is spent (0088, Robert's
   * instruction of 2026-10-24, narrowed by his ruling 3): a manufactured home,
   * solar or WPI-8E letter seals only from a letter template the engineer has
   * signed, whose words still match the template in code. Every other letter
   * seals exactly as before 0088, through the fifteen-argument door.
   */
  const needsTemplate = letterNeedsTemplate(det.protocol_document);
  const template = needsTemplate ? await templateToSealFrom(det.protocol_document) : null;
  if (template && !template.ok) return { ok: false, error: template.error };

  // 5. A fresh second factor, for this act.
  const fresh = await verifyFreshCode(actor!.id, input.code);
  if (!fresh.ok) return { ok: false, error: fresh.error };

  // 6. His images, read here and only here.
  const seal = await readImageForSealing(actor!.id, "seal");
  if (!seal.ok) return { ok: false, error: seal.error };
  const signature = await readImageForSealing(actor!.id, "signature");
  if (!signature.ok) return { ok: false, error: signature.error };

  // 7. Rendered once, hashed, stored.
  /*
   * The letter is dated by the DATABASE's moment of sealing, the instant the
   * fresh code was spent, which is also the mfa_verified_at the seal act
   * records. Found by db-guard-audit on the integration board of 2026-10-07:
   * this read the process clock, so the date printed on a sealed letter came
   * from whichever machine served the request.
   */
  const sealedOn = letterDate(fresh.verifiedAt);
  /*
   * THE LETTERHEAD MARK, FROM BYTES IN CODE AND CHECKED BEFORE IT IS USED.
   * Operator ruling, 2026-10-22: embedded, never fetched, and its checksum
   * recorded with the seal. The digest is recomputed here rather than trusted
   * from the module, so a mark whose bytes and declared digest disagree seals
   * nothing.
   */
  const markBytes = Buffer.from(LETTERHEAD_MARK.pngBase64, "base64");
  const markSha256 = createHash("sha256").update(markBytes).digest("hex");
  if (markSha256 !== LETTERHEAD_MARK.sha256) {
    return { ok: false, error: "The letterhead mark does not match its recorded checksum, so nothing was sealed." };
  }
  const rendered = await renderLetterPdf({
    /*
     * "254 Engineering", the brand of the 2026-10-10 ruling, restated for letters
     * on 2026-10-22. This read business.name, "254 Engineering Services", which
     * is a DBA on the board's record and stays off every letter.
     */
    brand: business.shortName,
    logoPng: new Uint8Array(markBytes),
    registrationLine: registrationLine(),
    lines: draft.lines,
    sealBlock: {
      name: engineer.name,
      licenseNumber: engineer.licenseNumber,
      role: `Engineer of Record, ${firmName()}`,
      date: sealedOn,
    },
    sealPng: seal.bytes,
    signaturePng: signature.bytes,
    title: facts.title,
  });
  if (!rendered.ok) return { ok: false, error: rendered.why };

  const sha256 = createHash("sha256").update(rendered.bytes).digest("hex");
  const documentId = randomUUID();
  const sealActId = randomUUID();
  const storageKey = `${det.file_id}/${documentId}.pdf`;

  const stored = await db.storage
    .from(DOCUMENT_BUCKET)
    .upload(storageKey, rendered.bytes, { contentType: "application/pdf", upsert: false });
  if (stored.error) return { ok: false, error: `The sealed letter could not be stored: ${stored.error.message}. Nothing was sealed.` };

  // 8. The act, in one transaction, audited by the database.
  const { data: file } = await db.from("eng_files").select("client_id").eq("id", det.file_id).maybeSingle();
  const recorded = await db.rpc("eng_record_letter_seal", {
    p_seal_act_id: sealActId,
    p_document_id: documentId,
    p_file_id: det.file_id,
    p_client_id: (file?.client_id as string | null) ?? null,
    p_title: facts.title,
    p_storage_key: storageKey,
    p_byte_size: rendered.bytes.byteLength,
    p_sha256: sha256,
    p_firm_registration: registration.number,
    p_determination_id: det.id,
    p_sealed_by: actor!.id,
    p_seal_image_id: seal.id,
    p_signature_image_id: signature.id,
    p_mfa_verified_at: fresh.verifiedAt,
    p_letterhead_sha256: markSha256,
    /* Only a three-lines letter names its template (0088's sixteen-argument door); every other letter calls 0081's fifteen. */
    ...(template?.ok ? { p_letter_template_act_id: template.actId } : {}),
  });
  if (recorded.error) {
    /* No unrecorded PDF is left in the bucket: an object with no seal act is a seal nothing vouches for. */
    await db.storage.from(DOCUMENT_BUCKET).remove([storageKey]);
    return { ok: false, error: `The seal could not be recorded: ${recorded.error.message}. Nothing was sealed.` };
  }

  await writeAudit({
    actor,
    action: "letter.sealed",
    entityType: "file",
    entityId: det.file_id,
    summary: `Sealed the ${det.determination} letter, sha256 ${sha256.slice(0, 12)}`,
    ...(input.context ?? {}),
  });

  /*
   * 9. On a pass: the file is sealed and delivered, and the order settles and
   * completes. AND ON A FOUNDATION DECLINE (ruling FC-1, 2026-10-23): option C
   * is a sealed letter and "a C letter is delivered work: no refund", so it is
   * delivered and the order settles as sealed work exactly as a pass does. The
   * decision did not refund it (review.after_decision leaves a foundation
   * decline at review to this letter). Every other letter waits for the work
   * it names, as the roof repairs letter always has.
   */
  const delivers = det.determination === "pass" || (det.protocol_document === "254-FC-001" && det.determination === "decline");
  if (!delivers) {
    return { ok: true, documentId, sha256, delivered: false, warning: null };
  }
  const problems: string[] = [];
  const toSealed = await transitionFile(actor!, det.file_id, "sealed", "Letter sealed in the portal.", input.context ?? {});
  if (!toSealed.ok) problems.push(`the file did not move to sealed: ${toSealed.error}`);
  const toDelivered = toSealed.ok
    ? await transitionFile(actor!, det.file_id, "delivered", "Sealed letter available to the customer.", input.context ?? {})
    : { ok: false as const, error: "not attempted" };
  if (toSealed.ok && !toDelivered.ok) problems.push(`the file did not move to delivered: ${toDelivered.error}`);

  const order = await orderForFile(det.file_id);
  if (order) {
    const settled = await settleDecision({ orderId: order.id as string, outcome: "seal", actorId: actor!.id });
    if (!settled.ok) problems.push(`the order did not settle: ${settled.error}`);
    const completed = await db
      .from("eng_service_orders")
      /* DB_NOW: when an order completed is the database's fact, not this machine's. */
      .update({ status: "complete", completed_at: DB_NOW })
      .eq("id", order.id as string)
      .eq("status", "in_fulfilment")
      .select("id");
    if (completed.error) problems.push(`the order did not complete: ${completed.error.message}`);
    else if (!completed.data?.length) problems.push("the order was not in fulfilment, so it was not marked complete");
  }

  await raiseSealed(det.file_id).catch(() => {});

  return {
    ok: true,
    documentId,
    sha256,
    delivered: problems.length === 0,
    warning: problems.length ? `The letter is sealed. Then ${problems.join("; ")}.` : null,
  };
}

export type AwaitingLetter = {
  determinationId: string;
  fileId: string;
  fileNumber: string;
  propertyAddress: string;
  determination: string;
  decidedAt: string;
  /* Which letter: 254-RC-001, 254-FC-001 or 254-PL-001. */
  protocolDocument: string;
};

/**
 * The letters this engineer has decided and not yet sealed: his determinations
 * that produce a letter and carry no live seal act. Only his own, because only
 * he can seal them (control 3).
 */
export async function lettersAwaitingSeal(actor: SignedIn | null, fileId?: string): Promise<AwaitingLetter[]> {
  const db = supabaseAdmin();
  if (!db || !holdsLicence(actor, "documents.seal")) return [];
  let query = db
    .from("eng_determinations")
    .select("id, file_id, determination, decided_at, protocol_document")
    .eq("engineer_id", actor!.id)
    .in("protocol_document", [...SEALABLE_PROTOCOLS])
    .in("determination", ["pass", "repairs-required", "decline"])
    .order("decided_at", { ascending: true })
    .limit(200);
  if (fileId) query = query.eq("file_id", fileId);
  const { data: read, error } = await query;
  if (error || !read?.length) return [];
  /* A permit letter decline produces no letter (2026-10-22); every other row here does. */
  const dets = read.filter((d) => determinationProducesLetter(d.protocol_document as string, d.determination as string));
  if (!dets.length) return [];

  const ids = dets.map((d) => d.id as string);
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("determination_id")
    .in("determination_id", ids)
    .is("voided_at", null);
  /*
   * A read that failed is not "nothing sealed". Read as an empty set it would
   * list every letter he ever sealed as waiting for his seal again, so it is
   * logged and the list is empty instead.
   */
  if (actsError) {
    console.error(`[letters] the seal acts could not be read: ${actsError.message}`);
    return [];
  }
  const sealed = new Set((acts ?? []).map((a) => a.determination_id as string));
  const open = dets.filter((d) => !sealed.has(d.id as string));
  if (!open.length) return [];

  const { data: files } = await db
    .from("eng_files")
    .select("id, file_number, property_address")
    .in("id", [...new Set(open.map((d) => d.file_id as string))]);
  const fileOf = new Map((files ?? []).map((f) => [f.id as string, f]));
  return open.map((d) => ({
    determinationId: d.id as string,
    fileId: d.file_id as string,
    fileNumber: (fileOf.get(d.file_id as string)?.file_number as string) ?? "",
    propertyAddress: (fileOf.get(d.file_id as string)?.property_address as string) ?? "",
    determination: d.determination as string,
    decidedAt: d.decided_at as string,
    protocolDocument: d.protocol_document as string,
  }));
}

/** review.sealed, now raised when something has in fact been sealed. */
async function raiseSealed(fileId: string) {
  const db = supabaseAdmin();
  if (!db) return;
  const { data: file } = await db
    .from("eng_files")
    .select("file_number, property_address, county")
    .eq("id", fileId)
    .maybeSingle();
  const { data: admins } = await db.from("eng_profiles").select("id").eq("role", "admin").eq("status", "active");
  for (const admin of admins ?? []) {
    await raise({
      profileId: admin.id as string,
      role: "admin",
      kind: "review.sealed",
      title: `${file?.file_number ?? "A file"} was sealed`,
      body: `${file?.property_address ?? ""}, ${file?.county ?? ""} County. The letter is available to the customer.`,
      href: `/portal/files?id=${fileId}`,
      entityType: "file",
      entityId: fileId,
    });
  }
}

/**
 * A sealed letter's bytes, ONLY if they still hash to what was sealed.
 * Control 7: every read recomputes the hash and refuses on a mismatch, so a
 * changed object reads as a void seal rather than as the document.
 */
export async function sealedLetterBytes(
  documentId: string,
): Promise<{ ok: true; bytes: Uint8Array; title: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The document store is not configured." };
  const { data: doc } = await db
    .from("eng_documents")
    .select("id, title, bucket, storage_key, sealed_at, visibility")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc || !doc.sealed_at) return { ok: false, error: "That document is not a sealed letter." };
  const { data: act } = await db
    .from("eng_seal_acts")
    .select("content_sha256")
    .eq("document_id", documentId)
    .is("voided_at", null)
    .maybeSingle();
  if (!act) return { ok: false, error: "This letter's seal is void, so it is not served." };
  const download = await db.storage.from(doc.bucket as string).download(doc.storage_key as string);
  if (download.error || !download.data) return { ok: false, error: "The sealed letter could not be read from storage." };
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== act.content_sha256) {
    return {
      ok: false,
      error: "The stored letter no longer matches what was sealed, so its seal is void and it is not served.",
    };
  }
  return { ok: true, bytes, title: doc.title as string };
}
