import "server-only";
import { supabaseAdmin } from "./supabase";
import { missingFor, fieldsFor, type IntakeField, type FieldStage } from "@data/intake-fields";
import { writeAudit } from "./ops-audit";
import { queueEmail } from "./ops-jobs";
import { outstandingInformation } from "./email-templates";
import { issueCustomerLink } from "./ops-intake";
import { customerStatusUrl } from "./customer-link-url";
import type { Author } from "./ops-crm";

/**
 * The tokened status link for the order behind a file, or null when the file
 * has no order (a job taken by telephone and not yet paid) or the link could
 * not be issued. Never the bare reference, which opens nothing.
 */
export async function supplyUrlFor(fileId: string): Promise<string | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data: order, error } = await db
    .from("eng_service_orders")
    .select("id, reference")
    .eq("file_id", fileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !order) return null;
  const link = await issueCustomerLink({ orderId: order.id as string });
  return link ? customerStatusUrl(order.reference as string, link.token) : null;
}

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

/**
 * A FAILED READ OF A FILE'S ANSWERS REFUSES; IT IS NEVER AN EMPTY FILE.
 * Robert's audit of 2026-10-24, finding F12. This said so in a comment and then
 * returned {} on the next line, and holdFor read that as "nobody answered yes",
 * so a job that should wait for the engineer could be dispatched. Every caller
 * now gets this error instead: holdFor turns it into "could not be checked",
 * which dispatch refuses on, and a screen or a letter says the read failed
 * rather than showing blanks or asking a customer again for what they gave.
 */
export class AnswersUnreadable extends Error {
  constructor(fileId: string, what: string) {
    super(`The answers recorded for this file could not be read (${what}), so nothing is shown in their place.`);
    this.name = "AnswersUnreadable";
    void fileId;
  }
}

/** For a screen: the answers, or the sentence saying they could not be read. Never an empty record on failure. */
export async function readAnswers(fileId: string): Promise<{ ok: true; answers: FileAnswers } | { ok: false; error: string }> {
  try {
    return { ok: true, answers: await answersFor(fileId) };
  } catch (err) {
    if (err instanceof AnswersUnreadable) return { ok: false, error: err.message };
    throw err;
  }
}

/** Everything recorded against a file, keyed by field id. Throws AnswersUnreadable when any read fails. */
export async function answersFor(fileId: string): Promise<FileAnswers> {
  const db = supabaseAdmin();
  if (!db) throw new AnswersUnreadable(fileId, "the database is not configured");

  const { data, error } = await db
    .from("eng_file_inputs")
    .select("field_id, value_text")
    .eq("file_id", fileId);

  if (error) {
    console.error(`[file-inputs] could not read ${fileId}: ${error.message}`);
    throw new AnswersUnreadable(fileId, error.message);
  }

  /*
   * THE ORDER'S ANSWERS FIRST, THE FILE'S OWN ON TOP. Found 2026-10-07 by the
   * order path walk: a job placed on the site keeps the customer's answers in
   * eng_order_inputs, checkout evidence written once, and nothing ever put
   * them on the file. So every screen that asks what a file has been told (the
   * letter, what is missing, the review queue) read an empty record for every
   * web order, and the letter could never be drafted. 0016 keeps the two tables
   * apart on purpose; this reads both, with the file's working record winning,
   * because that is where a late answer or a correction lands. A failed read of
   * the order's answers is not "nothing was answered" either: the customer's
   * yes to an engineer hold question lives there, so it refuses like the read
   * above.
   */
  const answers: FileAnswers = {};
  const { data: orders, error: orderError } = await db.from("eng_service_orders").select("id").eq("file_id", fileId);
  if (orderError) {
    console.error(`[file-inputs] could not read the orders for ${fileId}: ${orderError.message}`);
    throw new AnswersUnreadable(fileId, orderError.message);
  }
  const orderIds = (orders ?? []).map((o) => o.id as string);
  if (orderIds.length) {
    const { data: given, error: givenError } = await db
      .from("eng_order_inputs")
      .select("key, value_text")
      .in("order_id", orderIds)
      .eq("kind", "input");
    if (givenError) {
      console.error(`[file-inputs] could not read the order answers for ${fileId}: ${givenError.message}`);
      throw new AnswersUnreadable(fileId, givenError.message);
    }
    for (const row of given ?? []) {
      if (typeof row.value_text === "string") answers[row.key as string] = row.value_text;
    }
  }
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
    /* A superseded duplicate's standing answers are not the customer's. */
    .is("superseded_at", null)
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
       * THE CUSTOMER'S TOKENED STATUS PAGE, WHERE THE DOCUMENTS ARE UPLOADED.
       * Robert's addendum of 2026-10-25, item 4: this was the bare order page,
       * /order/<reference> with no token, and that page opens nothing without
       * one: it answers that the link does not open an order. The token is
       * minted here the way every other customer email mints its own
       * (statusUrlFor in ops-payments), because a stored token cannot be read
       * back. A job with no order has no status page, so it gets no button.
       */
      supplyUrl: await supplyUrlFor(input.fileId),
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
