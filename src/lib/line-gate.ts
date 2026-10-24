import "server-only";
import { supabaseAdmin } from "./supabase";
import { serviceLineIsOffered } from "./launch";
import { verifiedEngineers } from "@/config/credentials";
import { protocolForLine } from "@/content/protocols";
import { SIGNABLE_PROTOCOLS } from "@/content/protocols/signable";
import { signatureStatus } from "./protocol-sign";
import { orderBlockedReason, type CatalogEntry, type OrderGateMode } from "@data/catalog";
import { allLineOffers, lineOffer, type LineOffer } from "./ordering";

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

export type Sellable = { ok: true } | { ok: false; why: string; unreadable: boolean };

const READ_LIMIT_MS = 4000;

const closed = (why: string, unreadable = false): Sellable => ({ ok: false, why, unreadable });

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
  if (!serviceLineIsOffered(serviceSlug)) {
    return closed("This service line is not offered for ordering yet.");
  }
  const timeout = new Promise<Sellable>((resolve) =>
    setTimeout(() => resolve(closed("The order system could not confirm the engineer's approval in time.", true)), READ_LIMIT_MS),
  );
  try {
    return await Promise.race([signedInDatabase(serviceSlug, tier), timeout]);
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
  return sellable.ok ? orderBlockedReason(entry, mode, true) : sellableRefusal(sellable, orderBlockedReason(entry, mode, false));
}

/**
 * The sentence a door shows when the signed-record check closed the line.
 * A read that could not be made says so in plain words, ruling 11; a line
 * that is simply not signed reads as not available, the catalogue's own words.
 */
export function sellableRefusal(sellable: Sellable, catalogueReason: string | null): string | null {
  if (sellable.ok) return catalogueReason;
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
      const sellable = await lineIsSellable(offer.slug);
      return sellable.ok ? offer : lineOffer(offer.slug, false);
    }),
  );
}
