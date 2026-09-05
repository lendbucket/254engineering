import "server-only";
import { supabaseAdmin } from "./supabase";
import { missingFor, fieldsFor, type IntakeField, type FieldStage } from "@data/intake-fields";
import { writeAudit } from "./ops-audit";
import { queueEmail } from "./ops-jobs";
import { outstandingInformation } from "./email-templates";
import { deploymentOrigin } from "./site-url";
import type { Author } from "./ops-crm";

/**
 * WHAT A FILE IS STILL MISSING, ASKED IN ONE PLACE.
 *
 * Phase 10 Section 1.5 Section C item 3. The same question is asked on the
 * file, on the dispatch screen and in the review queue, and if each worked it
 * out for itself they would eventually disagree about whether a job is ready.
 *
 * So all three call this, it calls missingFor, and missingFor reads the one
 * definition. Three screens, one answer.
 */

export type FileAnswers = Record<string, string>;

/** Everything recorded against a file, keyed by field id. */
export async function answersFor(fileId: string): Promise<FileAnswers> {
  const db = supabaseAdmin();
  if (!db) return {};

  const { data, error } = await db
    .from("eng_file_inputs")
    .select("field_id, value_text")
    .eq("file_id", fileId);

  /*
   * An error is not an empty file. Returning {} on a failed read would make a
   * complete job look like one nobody had answered anything for, and the
   * screens would start demanding information the customer already gave.
   */
  if (error) {
    console.error(`[file-inputs] could not read ${fileId}: ${error.message}`);
    return {};
  }

  const answers: FileAnswers = {};
  for (const row of data ?? []) {
    if (typeof row.value_text === "string") answers[row.field_id as string] = row.value_text;
  }
  return answers;
}

/**
 * An account's standing answers, keyed by field id.
 *
 * A solar installer's racking specification does not change between jobs, and
 * asking them for it on every order is how a firm trains a customer to stop
 * reading its forms.
 *
 * Absent for most clients, because most clients are homeowners who order once
 * and have no account at all. An empty object is the ordinary case rather than
 * a failure, which is why this returns one on every miss.
 */
export async function defaultAnswersFor(clientId: string | null): Promise<FileAnswers> {
  if (!clientId) return {};

  const db = supabaseAdmin();
  if (!db) return {};

  const { data, error } = await db
    .from("eng_customer_accounts")
    .select("default_answers, status")
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    console.error(`[file-inputs] could not read account defaults: ${error.message}`);
    return {};
  }
  /*
   * A suspended account's preferences do not apply. Whatever the firm decided
   * when it suspended them, quietly carrying on with their standing
   * instructions is not it.
   */
  if (!data || data.status !== "active") return {};

  const out: FileAnswers = {};
  for (const [k, v] of Object.entries((data.default_answers ?? {}) as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v;
  }
  return out;
}

export type Outstanding = {
  /** Blocking right now, at the stage asked about. */
  now: IntakeField[];
  /** Required later, listed so nobody is surprised by it at the last moment. */
  later: IntakeField[];
};

/**
 * What is outstanding on a file, split into what blocks the next step and what
 * is coming.
 *
 * The split is the point. A dispatch screen showing every field a sealing
 * engineer will eventually want would train an operator to ignore it, and a
 * screen showing only what blocks right now lets a job reach the engineer
 * missing something somebody could have asked for on the original call.
 */
export async function outstandingFor(
  fileId: string,
  serviceSlug: string,
  deliverable: string | null,
  stage: FieldStage,
): Promise<Outstanding> {
  if (!deliverable) return { now: [], later: [] };

  const answers = await answersFor(fileId);
  const now = missingFor(serviceSlug, deliverable, answers, stage);
  const everything = missingFor(serviceSlug, deliverable, answers, "seal");

  return {
    now,
    later: everything.filter((f) => !now.some((n) => n.id === f.id)),
  };
}

/**
 * ASK THE CUSTOMER FOR WHAT IS MISSING, ONCE, NAMING IT.
 *
 * Phase 10 Section 1.5 Section C item 4. Chasing by hand is what this whole
 * exercise exists to prevent, and the two ways to get it wrong are asking for
 * nothing and asking for everything. This asks for exactly what is outstanding
 * at the stage that is blocked, using the labels the customer already saw.
 *
 * WHAT IT RECORDS
 * ---------------
 * The audit row names the fields asked for, so "we never asked" and "they never
 * answered" are distinguishable later. That distinction is the whole reason a
 * request is recorded rather than just sent.
 */
export async function requestOutstanding(
  actor: Author,
  input: {
    fileId: string;
    fileNumber: string;
    serviceSlug: string;
    deliverable: string | null;
    propertyAddress: string;
    customerName: string;
    customerEmail: string;
    /** Where the job is, which decides what is blocking. */
    stage: FieldStage;
    /** The customer's own reference, for the link they follow. */
    orderReference: string | null;
  },
): Promise<{ ok: true; asked: string[] } | { ok: false; error: string }> {
  const { now } = await outstandingFor(input.fileId, input.serviceSlug, input.deliverable, input.stage);

  /*
   * Nothing outstanding is a refusal, not a no op that reports success. An
   * operator pressing this and being told "sent" when no email went anywhere is
   * the failure mode this repository keeps finding.
   */
  if (now.length === 0) {
    return { ok: false, error: "Nothing is outstanding at this stage, so there is nothing to ask for." };
  }
  if (!input.customerEmail) {
    return { ok: false, error: "That client has no email address, so there is nowhere to send it." };
  }

  const whenFor = (stage: FieldStage) =>
    stage === "dispatch" ? "Before a technician is sent" : stage === "seal" ? "Before it can be sealed" : "To open the job";

  await queueEmail(
    outstandingInformation({
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      fileNumber: input.fileNumber,
      propertyAddress: input.propertyAddress,
      items: now.map((f) => ({ label: f.label, when: whenFor(f.stage) })),
      holdingUp: input.stage === "dispatch" ? "a technician can be sent" : "it can be sealed",
      /*
       * The customer's existing order page, which is the only surface they
       * already have and already reach by reference. A new one time link would
       * be another credential to issue, expire and support.
       */
      supplyUrl: `${deploymentOrigin()}/order/${input.orderReference ?? input.fileNumber}`,
    }),
  );

  const asked = now.map((f) => f.id);

  await writeAudit({
    actor,
    action: "file.information_requested",
    entityType: "file",
    entityId: input.fileId,
    summary: `${input.fileNumber}: asked ${input.customerEmail} for ${now.map((f) => f.label).join(", ")}.`,
    diff: { asked, stage: input.stage },
  });

  return { ok: true, asked };
}

/**
 * The answers a file HAS, labelled, for showing on a record rather than
 * checking. Ordered by the definition so two files read the same way.
 */
export async function answeredFor(
  fileId: string,
  serviceSlug: string,
  deliverable: string | null,
): Promise<{ field: IntakeField; value: string }[]> {
  if (!deliverable) return [];
  const answers = await answersFor(fileId);
  return fieldsFor(serviceSlug, deliverable)
    .filter((f) => typeof answers[f.id] === "string" && answers[f.id].trim() !== "")
    .map((f) => ({ field: f, value: answers[f.id] }));
}
