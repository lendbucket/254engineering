import "server-only";
import { supabaseAdmin } from "./supabase";
import { serviceLineIsOffered } from "./launch";
import { verifiedEngineers } from "@/config/credentials";
import { protocolForLine } from "@/content/protocols";
import { SIGNABLE_PROTOCOLS } from "@/content/protocols/signable";
import { signatureStatus } from "./protocol-sign";
import { orderBlockedReason, type CatalogEntry, type OrderGateMode } from "@data/catalog";
import { allLineOffers, headlineEntry, lineOffer, type LineOffer } from "./ordering";
import { addendumRequired, deliverableKey, linePayFor } from "./line-addendum";
import { deskLines, offeredServiceLines } from "@/config/launch-conditions";
import { designPaymentRefusal, type DesignAddendum } from "./quote-rules";

/**
 * ===========================================================================
 * IS THIS LINE SELLABLE RIGHT NOW? Ruling 11 of 2026-10-06, the money doors.
 * ===========================================================================
 *
 * CLAUDE.md section 1, "THE ONE STATED EXCEPTION: A SIGNED PROTOCOL": a line is
 * sellable only when it is offered in configuration, which takes a deploy and
 * the operator's word, AND its protocol is signed in the database with a hash
 * that matches the transcription in code. A signature alone never opens a line.
 * A voided signature closes it at once, without a deploy. A failed or timed out
 * read closes it, and the order page says so in plain words.
 *
 * Every door that takes money awaits this before it does (ruling 13): the
 * order page, the order flow and placeOrder, /account/order, the v1 ordering
 * API, bulk ordering, job billing and phone intake. The display surfaces
 * (OfferCta, lineOffer) keep reading configuration alone, so a voided line can
 * still show an Order button whose page then refuses; that was ruled and
 * recorded on 2026-10-06.
 *
 * THE TWO KINDS OF SIGNED RECORD, each compared with what the code holds:
 *   - 254-RC-001, signed on paper and approved in the platform on 2026-09-22:
 *     its published eng_protocol_templates row must name the version the
 *     transcription is, carry the SHA-256 of the PDF the transcription is
 *     proved against, and name an approver whose licence is on the register.
 *   - the v1.1 protocols, signed in the portal: a live seal act whose hash is
 *     the transcription's own text today (src/lib/protocol-sign.ts).
 *
 * STAGE A, 2026-10-07. This sits ON TOP of serviceLineIsOffered, which still
 * reads the typed approval list in src/config/launch-readiness.ts. Stage B
 * removes that list; until then a line needs both, which is the closing
 * direction and is never looser than either alone.
 */

/*
 * `says` is the customer's sentence when it is not the catalogue's protocol
 * sentence: a line shut for want of a scope addendum reads as not available
 * yet, because the reason is the engineer's agreement and is internal.
 */
export type Sellable = { ok: true } | { ok: false; why: string; unreadable: boolean; says?: string };

const READ_LIMIT_MS = 4000;

const closed = (why: string, unreadable = false, says?: string): Sellable => ({ ok: false, why, unreadable, says });

/** The catalogue's own words for a deliverable the agreement does not cover yet (data/catalog.ts). */
const NOT_AVAILABLE_YET =
  "This service is not available to order yet. Call the office or send a message and somebody will take the details.";

/**
 * SIGNED, TRAINED, AND COVERED BY HIS AGREEMENT. Robert's ruling of 2026-10-26,
 * 07:10 Central (0095): a deliverable listed in SCOPE_ADDENDUM_REQUIRED opens
 * only on a live signed per_job addendum for that deliverable, read here at
 * every money door BEFORE the protocol and the training. A deliverable that
 * needs none costs no read.
 *
 * FIRST, NOT LAST, and the proof found why. Its protocol (254-WP-001) cannot
 * be in force without the addendum (0096), so asked last the door refused with
 * the protocol sentence, "No protocol for this service line has been approved",
 * which is untrue of a line whose completed construction protocol is approved.
 * Asked first, the customer reads the catalogue's own "not available yet".
 */
async function signedAndCovered(serviceSlug: string, tier: string | null | undefined): Promise<Sellable> {
  if (addendumRequired(serviceSlug, tier)) {
    const pay = await linePayFor(deliverableKey(serviceSlug, tier));
    if (pay.state === "unknown") return closed("The order system cannot confirm the engineer's scope addendum right now.", true);
    if (pay.state === "unsigned") {
      return closed(`No signed scope addendum covers ${deliverableKey(serviceSlug, tier)}.`, false, NOT_AVAILABLE_YET);
    }
  }
  return signedInDatabase(serviceSlug, tier);
}

async function rc001Signed(documentNumber: string): Promise<Sellable> {
  const entry = protocolForLine("roof-inspections");
  const db = supabaseAdmin();
  if (!entry || entry.declaration.documentNumber !== documentNumber) return closed(`${documentNumber} is not registered.`);
  if (!db) return closed("The order system cannot confirm the engineer's approval right now.", true);
  const current = entry.versions.find((v) => v.supersededOn === null);
  if (!current) return closed(`${documentNumber} has no version in force in code.`);

  const { data, error } = await db
    .from("eng_protocol_templates")
    .select("version_label, status, approved_by, approved_by_license, document_sha256")
    .eq("document_number", documentNumber)
    .eq("status", "published");
  if (error) return closed("The order system cannot confirm the engineer's approval right now.", true);
  const row = (data ?? []).find((r) => r.version_label === entry.declaration.version);
  if (!row) return closed(`${documentNumber} v${entry.declaration.version} is not approved in the platform.`);
  if (!row.approved_by) return closed(`${documentNumber} v${entry.declaration.version} names no approver.`);
  if (!verifiedEngineers.some((e) => e.licenseNumber === row.approved_by_license)) {
    return closed(`${documentNumber} was approved under a licence that is not on the firm's register.`);
  }
  if (row.document_sha256 !== current.sha256) {
    return closed(`${documentNumber}'s approved record is for a different document than the one the platform runs.`);
  }
  return { ok: true };
}

async function signedInDatabase(serviceSlug: string, tier: string | null | undefined): Promise<Sellable> {
  const registered = protocolForLine(serviceSlug);
  if (registered?.declaration.documentNumber === "254-RC-001") return rc001Signed("254-RC-001");

  /* The same list the engineer signs from (signable.ts), so a superseded version cannot open a line. */
  const received = SIGNABLE_PROTOCOLS.find(
    (p) => p.serviceSlug === serviceSlug && p.serviceTier === (tier ?? null),
  ) ?? SIGNABLE_PROTOCOLS.find((p) => p.serviceSlug === serviceSlug && !p.serviceTier);
  if (!received) return closed("This service line has no protocol, so it cannot be ordered.");

  const status = await signatureStatus(received.documentNumber, received.version);
  if (status.state === "unknown") return closed("The order system cannot confirm the engineer's signature right now.", true);
  if (status.state === "void") return closed(`${received.documentNumber}'s signature no longer covers its text.`);
  if (status.state !== "signed") return closed(`${received.documentNumber} has not been signed by the engineer of record.`);
  return trainedInDatabase(serviceSlug, received.documentNumber, received.version);
}

/**
 * SIGNED IS NOT ENOUGH: SOMEBODY MUST BE TRAINED ON THAT VERSION. Operator
 * ruling of 2026-10-23, migration 0084. Asked of the template in force for the
 * document and version the engineer signed, so training on another version
 * opens nothing, and through eng_line_is_trained, which counts only an approved
 * record for an active technician. 254-RC-001 never reaches here: roof keeps
 * its own path, exactly as it is. A failed read closes the line, as every read
 * at a money door does.
 */
async function trainedInDatabase(serviceSlug: string, documentNumber: string, version: string): Promise<Sellable> {
  const db = supabaseAdmin();
  if (!db) return closed("The order system cannot confirm the training record right now.", true);
  const { data: template, error: tError } = await db
    .from("eng_protocol_templates")
    .select("id")
    .eq("document_number", documentNumber)
    .eq("version_label", version)
    .eq("status", "published")
    .maybeSingle();
  if (tError) return closed("The order system cannot confirm the training record right now.", true);
  if (!template) return closed(`${documentNumber} v${version} is not in force in the platform.`);
  const { data: trained, error } = await db.rpc("eng_line_is_trained", {
    p_service_slug: serviceSlug,
    p_template_id: template.id,
  });
  if (error) return closed("The order system cannot confirm the training record right now.", true);
  if (trained !== true) return closed(`Nobody is yet trained on ${documentNumber} v${version}, so this service cannot be ordered.`);
  return { ok: true };
}

export async function lineIsSellable(serviceSlug: string, tier?: string | null): Promise<Sellable> {
  /*
   * A DESK LINE HAS ONE MONEY DOOR, ITS ACCEPTED QUOTE. Robert's answer 1 of
   * 2026-10-27: design is paid without a protocol or training, once its quote
   * is accepted and the engineer has signed its scope addendum. Every other
   * door refuses it here, by name, and designQuoteBlocked below is the door.
   */
  if (deskLines.includes(serviceSlug)) {
    return closed(`${serviceSlug} is paid only from its accepted quote, once the engineer has signed that quote's scope addendum.`);
  }
  if (!serviceLineIsOffered(serviceSlug)) {
    return closed("This service line is not offered for ordering yet.");
  }
  const timeout = new Promise<Sellable>((resolve) =>
    setTimeout(() => resolve(closed("The order system could not confirm the engineer's approval in time.", true)), READ_LIMIT_MS),
  );
  try {
    return await Promise.race([signedAndCovered(serviceSlug, tier), timeout]);
  } catch {
    return closed("The order system cannot confirm the engineer's approval right now.", true);
  }
}

/**
 * WHAT EVERY MONEY DOOR CALLS. The catalogue's own reason, with the signed
 * record read only when everything else would let the order through: a shut
 * gate answers first and costs no database read.
 */
export async function orderBlockedNow(entry: CatalogEntry | undefined, mode: OrderGateMode): Promise<string | null> {
  if (!entry || mode !== "open") return orderBlockedReason(entry, mode, false);
  const sellable = await lineIsSellable(entry.serviceSlug, entry.tier);
  /* ok here means the protocol, the training and, where one is required, the scope addendum (0095). */
  return sellable.ok ? orderBlockedReason(entry, mode, true, true) : sellableRefusal(sellable, orderBlockedReason(entry, mode, false));
}

/**
 * The sentence a door shows when the signed-record check closed the line.
 * A read that could not be made says so in plain words, ruling 11; a line
 * that is simply not signed reads as not available, the catalogue's own words.
 */
export function sellableRefusal(sellable: Sellable, catalogueReason: string | null): string | null {
  if (sellable.ok) return catalogueReason;
  if (sellable.says) return sellable.says;
  if (sellable.unreadable) {
    return "Online ordering for this service is paused because the platform could not confirm the engineer's approval just now. Nothing has been charged. Try again in a few minutes, or call the office.";
  }
  return catalogueReason ?? "This service cannot be ordered online yet.";
}

/**
 * EVERY LINE AS /order OFFERS IT, ASKED AT THE MONEY DOOR. Robert's ruling of
 * 2026-10-24: an unsigned template shuts its own line, never the gate, and an
 * unsigned line is not offered on /order or any order route. Configuration says
 * which lines may be orderable; for each of those this asks lineIsSellable, and
 * a line its door refuses, or cannot answer for, is offered as a quote instead,
 * with no price and no link to a checkout. A line configuration already shuts
 * costs no read. Roof is asked the same way and sells when its record stands.
 */
export async function sellableLineOffers(): Promise<LineOffer[]> {
  return Promise.all(
    allLineOffers().map(async (offer) => {
      if (!offer.orderable) return offer;
      /*
       * ASKED FOR THE TIER THE ROW IS PRICED FROM. Robert's ruling of
       * 2026-10-25, 23:50 Central, put WPI-8 on sale, whose two tiers run
       * under two protocols (254-WS-001 completed, 254-WP-001 ongoing). Asked
       * with no tier, the door found no protocol for the line and the row was
       * a quote; it is now asked for the tier the row's price is read from.
       */
      const sellable = await lineIsSellableForDisplay(offer.slug, headlineEntry(offer.slug)?.tier ?? null);
      return sellable.ok ? offer : lineOffer(offer.slug, false);
    }),
  );
}

/*
 * ===========================================================================
 * WHAT A PAGE SHOWS MAY BE A MINUTE OLD. WHAT TAKES MONEY NEVER IS.
 * ===========================================================================
 *
 * Robert, 2026-10-25, from the Ahrefs crawl: /order took 1.4 seconds and
 * /order/start/* 1.1 seconds to first byte, every one of them reading the
 * signed record for every line. The answer a page DISPLAYS is now kept for at
 * most 60 seconds, per server instance. The answer that TAKES MONEY is not:
 * orderBlockedNow, which placeOrder, the v1 API, bulk ordering, job billing,
 * phone intake and /account/order call, reads lineIsSellable live every time,
 * as ruling 11 requires.
 *
 * So for up to a minute after a signature is voided, /order can still show the
 * line as orderable, and its checkout refuses. That is the same shape as the
 * display surfaces ruled on 2026-10-06 (a voided line may show an Order button
 * whose door then refuses), bounded now to a minute.
 *
 * Only a definite answer is kept. An answer the database could not give
 * (unreadable) is never cached, so a failed read is asked again on the next
 * request instead of shutting the line for a minute on one bad moment.
 *
 * scripts/proofs/a-voided-signature-is-refused-at-checkout-inside-the-cache.mjs
 * proves the money door stays live while the display is cached.
 */
export const DISPLAY_ANSWER_MS = 60_000;
const displayAnswers = new Map<string, { at: number; answer: Sellable }>();

export async function lineIsSellableForDisplay(serviceSlug: string, tier?: string | null): Promise<Sellable> {
  const key = `${serviceSlug}\u0000${tier ?? ""}`;
  const hit = displayAnswers.get(key);
  if (hit && Date.now() - hit.at < DISPLAY_ANSWER_MS) return hit.answer;
  const answer = await lineIsSellable(serviceSlug, tier);
  if (answer.ok || !answer.unreadable) displayAnswers.set(key, { at: Date.now(), answer });
  else displayAnswers.delete(key);
  return answer;
}

/** orderBlockedNow for a page that only DISPLAYS whether a line can be ordered. Never for a door that takes money. */
export async function orderBlockedForDisplay(entry: CatalogEntry | undefined, mode: OrderGateMode): Promise<string | null> {
  if (!entry || mode !== "open") return orderBlockedReason(entry, mode, false);
  const sellable = await lineIsSellableForDisplay(entry.serviceSlug, entry.tier);
  return sellable.ok ? orderBlockedReason(entry, mode, true, true) : sellableRefusal(sellable, orderBlockedReason(entry, mode, false));
}

/**
 * ===========================================================================
 * A QUOTE REQUEST IS NOT A MONEY DOOR. Robert's addendum of 2026-10-25, item 3.
 * ===========================================================================
 *
 * "Fix requestQuote so design and the other quote lines can actually be
 * requested (today line-gate refuses every quote entry)." Every quote entry in
 * the catalogue is a design deliverable, and design is not in
 * offeredServiceLines, so lineIsSellable answered "not offered for ordering
 * yet" to every one: a request that takes no money was refused by the check
 * that exists to stop money being taken.
 *
 * WHAT STILL HOLDS IT. The gate: a quote request is the firm taking work, so
 * prelaunch and trading refuse it with the catalogue's own sentences, as
 * before. A deliverable that is not a quote is refused by requestQuote with its
 * own sentence. A deliverable needing a scope addendum stays refused here, in
 * the closing direction, because the read that would open it belongs to the
 * money door.
 *
 * WHAT MOVED, AND WHERE IT WENT. The signed record (ruling 11) is read where
 * money is taken: acceptQuote calls orderBlockedNow before it converts a quote
 * into an order and opens checkout. Nothing about a line's sellability is
 * loosened; the question is asked at the moment the money is.
 */
export function quoteRequestBlocked(entry: CatalogEntry | undefined, mode: OrderGateMode): string | null {
  if (!entry || mode !== "open") return orderBlockedReason(entry, mode, false);
  if (entry.orderType !== "quote") return null;
  /* Not the protocol question, which is the money door's: the addendum check and the quote answer are what remain. */
  return orderBlockedReason(entry, mode, true, false);
}

/**
 * ===========================================================================
 * THE MONEY DOOR FOR A DESK LINE: ITS ACCEPTED QUOTE AND HIS SIGNED ADDENDUM.
 * ===========================================================================
 *
 * Robert's answer 1 of 2026-10-27, 11:48 Central: "A design quote can be paid
 * once (a) the customer has accepted it, and (b) the engineer has signed that
 * quote's design_share scope addendum (0082, eng_design_pay returns a row).
 * Without both, payment refuses and says which is missing."
 *
 * The gate answers first, as at every door. Then the quote's stored status and
 * eng_design_pay are read live, never cached, under the same four second bound
 * as lineIsSellable; a read that fails or times out is "unknown", and unknown
 * closes. The decision itself is designPaymentRefusal in quote-rules.ts.
 *
 * `acceptingNow` is acceptQuote asking before it records the customer's
 * acceptance: the acceptance is the act being made, so only the addendum and
 * the gate can refuse there. placeOrder asks again with the stored status, so
 * an unaccepted quote never reaches checkout.
 */
export async function designQuoteBlocked(
  entry: CatalogEntry | undefined,
  quoteId: string,
  mode: OrderGateMode,
  acceptingNow = false,
): Promise<string | null> {
  if (!entry || mode !== "open") return orderBlockedReason(entry, mode, false);
  if (!deskLines.includes(entry.serviceSlug)) return "Only a design quote is paid through this door.";

  const read = async (): Promise<{ accepted: boolean; addendum: DesignAddendum }> => {
    const db = supabaseAdmin();
    if (!db) return { accepted: false, addendum: "unknown" };
    let accepted = acceptingNow;
    if (!acceptingNow) {
      const { data, error } = await db.from("eng_quote_requests").select("status").eq("id", quoteId).maybeSingle();
      if (error || !data) return { accepted: false, addendum: "unknown" };
      accepted = data.status === "accepted";
    }
    const { data: pay, error: payError } = await db.rpc("eng_design_pay", { p_quote_id: quoteId });
    if (payError) return { accepted, addendum: "unknown" };
    return { accepted, addendum: Array.isArray(pay) && pay.length > 0 ? "signed" : "unsigned" };
  };
  const timeout = new Promise<{ accepted: boolean; addendum: DesignAddendum }>((resolve) =>
    setTimeout(() => resolve({ accepted: false, addendum: "unknown" }), READ_LIMIT_MS),
  );
  let facts: { accepted: boolean; addendum: DesignAddendum };
  try {
    facts = await Promise.race([read(), timeout]);
  } catch {
    facts = { accepted: false, addendum: "unknown" };
  }
  return designPaymentRefusal({ offered: offeredServiceLines.includes(entry.serviceSlug), ...facts });
}

/** What the order start page shows for one deliverable: a quote is asked as a request, everything else as an order. */
export async function deliverableBlockedForDisplay(entry: CatalogEntry | undefined, mode: OrderGateMode): Promise<string | null> {
  if (entry?.orderType === "quote") return quoteRequestBlocked(entry, mode);
  return orderBlockedForDisplay(entry, mode);
}
