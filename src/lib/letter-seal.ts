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
import { isPrelaunch, registrationLine, firmName, activeFirmRegistration } from "./launch";
import { verifiedEngineers } from "@/config/credentials";
import { business } from "@/config/business";
import { protocolByDocument } from "@/content/protocols";
import { draftRoofLetter, letterDate, producesLetter, type LetterFacts, type LetterDraft } from "./letter-draft";
import { renderLetterPdf } from "./letter-pdf";

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
};

async function determination(id: string): Promise<DeterminationRow | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_determinations")
    .select("id, file_id, protocol_document, determination, engineer_id, decided_at")
    .eq("id", id)
    .maybeSingle();
  return (data as DeterminationRow | null) ?? null;
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
    .select("id, file_number, property_address, county, client_id")
    .eq("id", det.file_id)
    .maybeSingle();
  if (fileError || !file) return { ok: false, error: "The file this determination belongs to could not be read." };

  const { data: evidence, error: evidenceError } = await db
    .from("eng_evidence_items")
    .select("captured_at")
    .eq("file_id", det.file_id);
  if (evidenceError) return { ok: false, error: `The evidence could not be counted: ${evidenceError.message}` };
  const captured = (evidence ?? [])
    .map((e) => e.captured_at as string | null)
    .filter((t): t is string => Boolean(t))
    .sort();

  const { data: exceptions, error: exceptionError } = await db
    .from("eng_checklist_exceptions")
    .select("item_key, kind, reason")
    .eq("file_id", det.file_id)
    .eq("kind", "not_observed");
  if (exceptionError) return { ok: false, error: `The items not observed could not be read: ${exceptionError.message}` };
  const labelFor = (key: string) => protocol.declaration.checklist.find((i) => i.key === key)?.label ?? key;
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
    visit_date: captured.length ? letterDate(captured[0]) : null,
    protocol_number: protocol.declaration.documentNumber,
    protocol_version: protocol.declaration.version,
    evidence_count: String((evidence ?? []).length),
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

/** The draft, for the engineer to read before he seals. Reads no image. */
export async function draftForDetermination(
  actor: SignedIn | null,
  determinationId: string,
  entered: { recipientAddress: string; recipientSalutation: string },
): Promise<LetterDraft | { ok: false; why: string; missing: [] }> {
  if (!holdsLicence(actor, "documents.seal")) return { ok: false, why: "Only the engineer of record drafts and seals a letter.", missing: [] };
  const det = await determination(determinationId);
  if (!det) return { ok: false, why: "That determination does not exist.", missing: [] };
  if (det.engineer_id !== actor!.id) {
    return { ok: false, why: "Only the engineer who recorded this determination can draft its letter.", missing: [] };
  }
  const facts = await letterFactsFor(det, entered);
  if (!facts.ok) return { ok: false, why: facts.error, missing: [] };
  return draftRoofLetter(det.determination, facts.facts);
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
  const registration = activeFirmRegistration();
  if (!registration) return { ok: false, error: "The firm has no active registration on record, so nothing is sealed." };

  // 3. What.
  if (!producesLetter(det.determination)) {
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
  const facts = await letterFactsFor(det, {
    recipientAddress: input.recipientAddress,
    recipientSalutation: input.recipientSalutation,
  });
  if (!facts.ok) return { ok: false, error: facts.error };
  const draft = draftRoofLetter(det.determination, facts.facts);
  if (!draft.ok) return { ok: false, error: draft.why };

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
  const rendered = await renderLetterPdf({
    brand: business.name,
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

  // 9. On a pass: the file is sealed and delivered, and the order settles and completes.
  if (det.determination !== "pass") {
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
    .eq("protocol_document", "254-RC-001")
    .in("determination", ["pass", "repairs-required", "decline"])
    .order("decided_at", { ascending: true })
    .limit(200);
  if (fileId) query = query.eq("file_id", fileId);
  const { data: dets, error } = await query;
  if (error || !dets?.length) return [];

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
