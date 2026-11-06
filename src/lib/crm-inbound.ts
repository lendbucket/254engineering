import { verifySvix, type SvixHeaders } from "./crm-inbound-rules";
import { companyFromRecipients } from "./crm-email-rules";

/**
 * A REPLY TO A SALES EMAIL ARRIVES. Robert's sales CRM ruling of 2026-11-02,
 * item R7: "a reply to any email lands in the existing inbox linked to the
 * company", with his answer 1 (6587550325): a reply subdomain on Resend
 * Inbound, the support mailbox until then.
 *
 * THE PATH, from Resend's receiving documentation (read 2026-11-02; the DNS
 * note posted for Robert is issue #1 comment 6588394106):
 *   1. CLOSED unless RESEND_WEBHOOK_SECRET is set: the route answers 404, the
 *      way the cron routes answer with no secret, so a door that is not built
 *      out yet is indistinguishable from no door.
 *   2. The Svix signature is checked on the raw body. A failure is a 400 and
 *      records nothing.
 *   3. Only email.received is handled; any other event is acknowledged and
 *      ignored.
 *   4. The webhook carries metadata only, so the body is fetched from
 *      Resend by the email id.
 *   5. The company is matched by the crm+<company id> tag in a recipient
 *      first, by the sender's address against the people on file second (a
 *      sender at exactly one company); otherwise it is recorded as matching
 *      none and still lands in the inbox, said as such.
 *   6. The reply is recorded once, keyed on the webhook's event id (0117
 *      refuses a second row), so a redelivery writes nothing twice.
 *   7. A matched company's sequence is paused for a person. The stage moves to
 *      connected when a rep reads the reply (src/lib/crm-email.ts readReply),
 *      because every stage change is written to the contact log by a person.
 *
 * Written with its effects passed in, so the proof can drive every branch
 * without a database or the network; the route supplies the real ones.
 */

export type InboundDeps = {
  /** RESEND_WEBHOOK_SECRET, or null when unset. */
  secret: string | null;
  /** CRM_REPLY_DOMAIN, or null before the subdomain exists. */
  replyDomain: string | null;
  now: Date;
  /** GET https://api.resend.com/emails/receiving/{id}. */
  fetchReceived: (emailId: string) => Promise<{ ok: true; from: string | null; to: string[]; subject: string | null; text: string | null } | { ok: false; error: string }>;
  /** Whether a company with this id exists on the sales list. */
  companyExists: (id: string) => Promise<{ ok: true; exists: boolean } | { ok: false; error: string }>;
  /** The companies one of whose people has this address. */
  companiesWithAddress: (address: string) => Promise<{ ok: true; ids: string[] } | { ok: false; error: string }>;
  /** Insert the reply row; "duplicate" when the event id is already recorded. */
  recordReply: (row: {
    event_id: string;
    email_id: string | null;
    prospect_id: string | null;
    matched_by: "tag" | "sender" | "none";
    from_address: string | null;
    subject: string | null;
    body_text: string | null;
    received_at: string | null;
  }) => Promise<{ ok: true } | { ok: false; duplicate: boolean; error: string }>;
  /** Set sequence_paused_at on the company. */
  pauseSequence: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
};

export type InboundAnswer = { status: number; body: Record<string, unknown> };

function addressOf(raw: string | null): string | null {
  if (!raw) return null;
  const inner = raw.match(/<([^>]+)>/)?.[1] ?? raw;
  const address = inner.trim().toLowerCase();
  return address.includes("@") ? address : null;
}

export async function handleInbound(headers: SvixHeaders, rawBody: string, deps: InboundDeps): Promise<InboundAnswer> {
  if (!deps.secret) return { status: 404, body: { ok: false } };
  const verdict = verifySvix(deps.secret, headers, rawBody, deps.now);
  if (!verdict.ok) return { status: 400, body: { ok: false, error: "The signature did not verify." } };

  let event: { type?: string; created_at?: string; data?: { email_id?: string; from?: string; to?: string[]; subject?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { status: 400, body: { ok: false, error: "The body is not JSON." } };
  }
  if (event.type !== "email.received") return { status: 200, body: { ok: true, ignored: event.type ?? "no type" } };
  const emailId = event.data?.email_id ?? null;
  if (!emailId) return { status: 400, body: { ok: false, error: "The event names no email." } };

  /* The body is not in the webhook. A failed fetch answers 500 so Resend redelivers; nothing is recorded yet. */
  const received = await deps.fetchReceived(emailId);
  if (!received.ok) return { status: 500, body: { ok: false, error: `The reply could not be fetched: ${received.error}` } };
  const recipients = received.to.length ? received.to : event.data?.to ?? [];
  const from = addressOf(received.from ?? event.data?.from ?? null);

  let prospectId: string | null = null;
  let matchedBy: "tag" | "sender" | "none" = "none";
  const tagged = deps.replyDomain ? companyFromRecipients(recipients, deps.replyDomain) : null;
  if (tagged) {
    const exists = await deps.companyExists(tagged);
    if (!exists.ok) return { status: 500, body: { ok: false, error: exists.error } };
    if (exists.exists) {
      prospectId = tagged;
      matchedBy = "tag";
    }
  }
  if (!prospectId && from) {
    const found = await deps.companiesWithAddress(from);
    if (!found.ok) return { status: 500, body: { ok: false, error: found.error } };
    const ids = [...new Set(found.ids)];
    if (ids.length === 1) {
      prospectId = ids[0];
      matchedBy = "sender";
    }
  }

  const recorded = await deps.recordReply({
    event_id: headers.id as string,
    email_id: emailId,
    prospect_id: prospectId,
    matched_by: matchedBy,
    from_address: from,
    subject: received.subject ?? event.data?.subject ?? null,
    body_text: received.text,
    received_at: event.created_at ?? null,
  });
  if (!recorded.ok && !recorded.duplicate) return { status: 500, body: { ok: false, error: recorded.error } };
  /*
   * A redelivery writes no second row. It still pauses the sequence, which is
   * idempotent, so a first delivery whose pause failed (answered 500) is
   * finished by the redelivery rather than left half done.
   */
  if (prospectId) {
    const paused = await deps.pauseSequence(prospectId);
    if (!paused.ok) return { status: 500, body: { ok: false, error: `The reply is recorded and the sequence could not be paused: ${paused.error}` } };
  }
  return recorded.ok ? { status: 200, body: { ok: true, matched: matchedBy } } : { status: 200, body: { ok: true, already: true } };
}
