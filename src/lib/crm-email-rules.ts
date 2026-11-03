import { CRM_EMAILS, type EmailVariant } from "@/content/crm-emails";
import { SCRIPT_LINE, SOLAR_WIND_LOAD_CITIES } from "@/content/crm-scripts";
import { fillScript } from "./crm-script-render";
import { firmClock, nextStepAfter, currentStep, OFF_QUEUE_STAGES } from "./crm-queue-rules";
import type { CrmStage, CrmVertical } from "./crm-rules";

/**
 * THE SEQUENCE EMAIL'S RULES. Robert's sales CRM ruling of 2026-11-02, item
 * R7, with the sequence and the templates he approved as drafted the same day
 * (issue #1 comment 6587551356) and his answer 6 (6587550325): a rep presses
 * Send on each email, nothing sends by itself.
 *
 * Client safe and free of the database: which email a company is due, what it
 * says, and where the sequence goes after it. The writes are in crm-email.ts.
 */

/* ------------------------------------------------------------------ the day */

/** The firm's calendar day an instant falls on, America/Chicago: the unit of "one send per address per day". */
export function firmDay(at: Date): string {
  return firmClock(at).date;
}

/** An address as the send ledger keys it: trimmed and lower case (0115 checks the same). */
export function ledgerAddress(email: string): string {
  return email.trim().toLowerCase();
}

/* ---------------------------------------------------------------- the email */

export type EmailCard = {
  vertical: CrmVertical;
  rep: string;
  contact: string | null;
  company: string;
  city: string | null;
  /** The firm's site, `business.url`, passed in so this stays free of config reads. */
  siteUrl: string;
  /** displayPhone(), or null when the firm has no published number. */
  phone: string | null;
};

export type RenderedSequenceEmail =
  | { ok: true; variant: "open" | "prelaunch"; usedVertical: CrmVertical; subject: string; paragraphs: string[]; signOff: string; orderUrl: string }
  | { ok: false; error: string };

/** The line's order start page, the one the order flow serves for the vertical's line. */
export function orderUrlFor(siteUrl: string, vertical: CrmVertical): string {
  return `${siteUrl.replace(/\/$/, "")}/order/start/${SCRIPT_LINE[vertical].serviceSlug}`;
}

/** Whether Robert's ruling of 2026-10-30 turns this solar company to the general email. */
export function solarWindCity(vertical: CrmVertical, city: string | null): boolean {
  if (vertical !== "solar" || !city) return false;
  return SOLAR_WIND_LOAD_CITIES.some((c) => c.toLowerCase() === city.trim().toLowerCase());
}

/**
 * Fill one string. {{order_url}} and {{phone}} are the email's own; everything
 * else goes through the call scripts' filler, which reads the price book and
 * refuses a placeholder it does not know, so an email can never show a stale
 * figure or a raw "{{price:...}}".
 */
function fill(text: string, card: EmailCard, orderUrl: string): { ok: true; text: string } | { ok: false; error: string } {
  if (text.includes("{{phone}}") && !card.phone) {
    return { ok: false, error: "The email signs off with the firm's telephone number, and none is published, so it is not sent." };
  }
  const own = text.replace(/\{\{order_url\}\}/g, orderUrl).replace(/\{\{phone\}\}/g, card.phone ?? "");
  return fillScript(own, { vertical: card.vertical, rep: card.rep, contact: card.contact, company: card.company, city: card.city });
}

/**
 * The email a company is sent. `sellable` is the server's answer for the
 * vertical's line, the same one the call script reads; the solar ruling turns
 * a solar company in a listed city to the general email.
 */
export function renderSequenceEmail(card: EmailCard, sellable: boolean): RenderedSequenceEmail {
  const usedVertical: CrmVertical = solarWindCity(card.vertical, card.city) ? "other" : card.vertical;
  const variant = sellable ? "open" : "prelaunch";
  const template: EmailVariant = CRM_EMAILS[usedVertical][variant];
  const orderUrl = orderUrlFor(card.siteUrl, usedVertical);
  const target = { ...card, vertical: usedVertical };
  const subject = fill(template.subject, target, orderUrl);
  if (!subject.ok) return subject;
  const paragraphs: string[] = [];
  for (const p of template.body) {
    const filled = fill(p, target, orderUrl);
    if (!filled.ok) return filled;
    paragraphs.push(filled.text);
  }
  const signOff = fill(template.signOff, target, orderUrl);
  if (!signOff.ok) return signOff;
  return { ok: true, variant, usedVertical, subject: subject.text, paragraphs, signOff: signOff.text, orderUrl };
}

/* ------------------------------------------------------------- the decision */

export type EmailDueState = {
  stage: CrmStage;
  sequenceStep: number;
  nextActionKind: "call" | "email" | null;
  nextActionAt: string | null;
  sequencePausedAt: string | null;
};

/** Whether a company is due its sequence email now. Pure: the screen lists these, and Send asks again. */
export function emailDue(s: EmailDueState, now: Date): { ok: true } | { ok: false; error: string } {
  if (OFF_QUEUE_STAGES.includes(s.stage)) return { ok: false, error: "This company is not on the sequence any more." };
  if (s.sequencePausedAt) return { ok: false, error: "This company replied, so its sequence waits for a person. Read the reply first." };
  if (s.nextActionKind !== "email") return { ok: false, error: "This company's next step is not an email." };
  if (!s.nextActionAt || Date.parse(s.nextActionAt) > now.getTime()) return { ok: false, error: "This company's email is not due yet." };
  if (currentStep(s.sequenceStep).kind !== "email") return { ok: false, error: "This company's sequence step is not an email step." };
  return { ok: true };
}

export type AfterEmail = {
  stage: CrmStage;
  nextActionAt: string | null;
  nextActionKind: "call" | "email" | null;
  sequenceStep: number;
  said: string;
};

/**
 * Where the sequence goes after an email step, the approved table:
 *   email step sent                 attempted if it was new; the next step
 *   bounced, suppressed, no address none sent; a note says why; the next step
 * The next step after an email is always a call (day 5 after day 2, day 14
 * after day 9), on the firm's calendar, off weekends and the firm holidays,
 * at 9:00 AM Central.
 */
export function planAfterEmail(s: { stage: CrmStage; sequenceStep: number }, sent: boolean, now: Date): AfterEmail {
  const today = firmDay(now);
  const step = Math.max(1, s.sequenceStep);
  const next = nextStepAfter(step, today);
  const stage: CrmStage = sent && s.stage === "new" ? "attempted" : s.stage;
  if (!next) {
    return { stage: "dormant", nextActionAt: null, nextActionKind: null, sequenceStep: step, said: "That was the last step. The company is dormant now." };
  }
  return {
    stage,
    nextActionAt: next.dueAt,
    nextActionKind: next.step.kind,
    sequenceStep: next.step.step,
    said: sent ? "Sent. The next call is scheduled." : "Not sent, and the reason is in the history. The next call is scheduled.",
  };
}

/* ------------------------------------------------------- the reply address */

/**
 * The Reply-To tag a sequence email carries once the reply subdomain exists:
 * crm+<company id>@<domain>. Until then (Robert's answer 1) Reply-To is the
 * support mailbox and no tag is sent.
 */
export function replyTagAddress(prospectId: string, domain: string): string {
  return `crm+${prospectId}@${domain}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The company id a reply was addressed to, read from a crm+<id>@<domain> recipient; null when none carries one. */
export function companyFromRecipients(recipients: readonly string[], domain: string): string | null {
  const suffix = `@${domain.toLowerCase()}`;
  for (const raw of recipients) {
    const address = (raw.match(/<([^>]+)>/)?.[1] ?? raw).trim().toLowerCase();
    if (!address.endsWith(suffix)) continue;
    const local = address.slice(0, -suffix.length);
    const m = local.match(/^crm\+(.+)$/);
    if (m && UUID.test(m[1])) return m[1];
  }
  return null;
}
