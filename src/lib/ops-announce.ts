import "server-only";
import { isOpen } from "./launch";
import { business } from "@/config/business";
import { queueEmail } from "./ops-jobs";
import { launchAnnouncement } from "./email-templates";
import { copyVerdict } from "./partner-copy";
import { isSuppressed, unsubscribeUrl } from "./marketing-suppression";
import { createHash } from "node:crypto";
import { emailIdentity } from "@/config/email-identity";
import { supabaseAdmin } from "./supabase";
import { readEvery } from "./bounded-read";
import { can, type Actor } from "./ops-authz";
import { writeAudit, writeAuditOrRefuse } from "./ops-audit";
import { verifyOwnPassword } from "./ops-auth";
import { isProbeAddress } from "./ops-files";

/**
 * THE ONLY SEND IN THIS BUILD THAT GOES TO A LIST.
 *
 * Everything else this firm sends is about one person's own record. This is
 * addressed to people who put their name on a waitlist and have no order, no
 * account and no relationship beyond that, which is what makes it marketing.
 *
 * FOUR REFUSALS, AND EVERY ONE OF THEM REFUSES LOUDLY
 * ----------------------------------------------------
 * A bulk send is the one thing here that cannot be taken back. Once it has
 * left, a wrong claim is in a thousand inboxes and a missing unsubscribe is a
 * sending domain heading for a block list. So this refuses rather than
 * degrades, and says which of the four stopped it:
 *
 *   the compliance gate      no announcement while registration is pending
 *   the copy checks          the same ones a partner asset has to pass
 *   the unsubscribe link     no marketing send without a way out of it
 *   the suppression list     nobody who has already asked to stop
 *
 * THE GATE IS FIRST AND IT IS THE ONE THAT MATTERS
 * -------------------------------------------------
 * "254 Engineering is open for orders" is a present tense service claim to
 * every person on the list. Under the gate it is also false, and it is exactly
 * the claim the whole regulatory section of CLAUDE.md exists to prevent. This
 * is the send that would do the most damage on the wrong day, so the refusal
 * lives in the send path rather than in the template: the template still
 * RENDERS under the gate, which is what lets email-audit hold its voice and
 * layout to the same standard as everything else while it cannot be sent.
 *
 * launch-audit proves the refusal by attempting the send in prelaunch and
 * requiring it to be refused, rather than by reading this comment.
 */

export type AnnounceRefusal =
  | { ok: true; queued: number; skipped: number }
  | { ok: false; error: string };

/** What a single recipient looks like to this module. */
export type Recipient = { name: string; email: string };

/**
 * Whether the announcement may be sent at all, ignoring who it would go to.
 *
 * Separated from the send so the reason can be shown on a screen before
 * somebody presses anything, and so launch-audit can ask the question without
 * queueing mail.
 */
export function announcementBlockedReason(): string | null {
  if (!isOpen()) {
    return (
      "The firm is not yet accepting engagements. The launch announcement says the firm is open for orders, which is a present " +
      "tense service claim and is not true today. It cannot be sent until the gate lifts."
    );
  }
  return null;
}

/**
 * Send the announcement to a list.
 *
 * Returns how many were queued and how many were skipped as suppressed, because
 * "sent to 400 of 512" is the number somebody needs and "sent" is not.
 */
export async function sendLaunchAnnouncement(recipients: Recipient[]): Promise<AnnounceRefusal> {
  const blocked = announcementBlockedReason();
  if (blocked) return { ok: false, error: blocked };

  if (recipients.length === 0) {
    return { ok: false, error: "There is nobody to announce to, so nothing was sent." };
  }

  let queued = 0;
  let skipped = 0;

  for (const person of recipients) {
    /*
     * The suppression list, consulted before anything is composed. isSuppressed
     * fails CLOSED, so a database it cannot read means nobody is sent to rather
     * than everybody, and the count at the end says so.
     */
    if (await isSuppressed(person.email)) {
      skipped += 1;
      continue;
    }

    /*
     * No unsubscribe link means no send, for this person and for anybody. A
     * marketing email with a dead one is worse than no email: it is the thing
     * that gets a domain blocked, and it asks somebody to click a control that
     * does nothing, which is the defect class this build keeps finding.
     */
    const unsubscribe = unsubscribeUrl(person.email);
    if (!unsubscribe) {
      return {
        ok: false,
        error:
          "No unsubscribe link could be signed, which means OPS_SESSION_SECRET is missing on this " +
          "deployment. Nothing was sent. A marketing email with no way out of it is not one this " +
          "firm sends.",
      };
    }

    const message = launchAnnouncement({
      name: person.name,
      email: person.email,
      unsubscribeUrl: unsubscribe,
      orderUrl: `${business.url}/services`,
    });

    /*
     * The copy is held to the partner asset library's checks, so an
     * announcement cannot say something a partner would be refused for saying.
     * Checked per message rather than once, because the name is interpolated
     * and a name is somebody else's text.
     */
    const verdict = copyVerdict(`${message.subject}\n${message.text}`);
    if (!verdict.ok) {
      return {
        ok: false,
        error: `The announcement copy did not pass the regulated checks, so nothing was sent: ${verdict.summary}`,
      };
    }

    const result = await queueEmail(message);
    if (!result.ok) {
      return { ok: false, error: `The announcement could not be queued: ${result.error}` };
    }
    queued += 1;
  }

  return { ok: true, queued, skipped };
}

/*
 * =============================================================================
 * THE "WE ARE OPEN" BUTTON ON /portal/launch, PREVIEW FIRST.
 * =============================================================================
 *
 * Robert, 10:52 Central 2026-10-29 (issue #1 comment 6501552714), 254-WF-024
 * step 4: "a waitlist 'we are open' email button on /portal/launch. It is
 * enabled only when the gate reads live, and sends Robert a preview first.
 * Never sent by a board or a probe."
 *
 * TWO ACTS, BOUND BY WHAT WAS READ. The preview goes to the firm's own
 * notification address (`business.notificationEmail`, the address every
 * operator notice already reaches), never to an address typed on a screen. The
 * send to the list is refused unless a preview of the SAME CONTENT was sent
 * first, and the content is named by a hash of the template rendered with
 * placeholders. So a template edited after the preview needs a new preview: the
 * thing Robert read is the thing that goes.
 *
 * Both acts are the administrator's (`roles.manage`, the grant the launch
 * screen itself is behind), both take the person's own password again, and
 * both are refused for a probe account, which is how every board and audit run
 * signs in. Each writes its record first and refuses without it.
 *
 * AND IT GOES ONCE PER CONTENT. A send of content already sent is refused, so
 * a second press cannot mail the list twice.
 */

/** The template's own text, rendered with placeholders, which is what a preview and a send are bound by. */
export function announcementContentHash(): string {
  const sample = launchAnnouncement({
    name: "{name}",
    email: "{email}",
    unsubscribeUrl: "{unsubscribe}",
    orderUrl: `${business.url}/services`,
  });
  return createHash("sha256").update(`${sample.subject}\n${sample.text}\n${sample.html ?? ""}`).digest("hex");
}

export type AnnounceStep =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string };

/** Who may press either button, and the password, in the order both acts ask it. */
async function announcerRefusal(actor: Actor | null, password: string): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  if (!actor) return { ok: false, status: 401, error: "Not signed in." };
  if (!can(actor, "roles.manage")) return { ok: false, status: 403, error: "Not permitted. Only the administrator tells the waitlist the firm is open." };

  const blocked = announcementBlockedReason();
  if (blocked) return { ok: false, status: 409, error: blocked };

  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The database is not configured." };
  const { data: profile, error } = await db.from("eng_profiles").select("email").eq("id", actor.id).maybeSingle();
  if (error) return { ok: false, status: 503, error: `Your account could not be read, so nothing was sent: ${error.message}` };
  const email = (profile?.email as string | null) ?? "";
  if (isProbeAddress(email)) {
    return { ok: false, status: 403, error: "An audit or probe account cannot send the launch announcement. It is sent only by the operator." };
  }

  const checked = await verifyOwnPassword(actor.id, password);
  if (!checked.ok) return { ok: false, status: 403, error: checked.error };
  return { ok: true, email };
}

/** Whether a preview of this content was sent, and whether this content was already sent to the list. */
export async function announcementHistory(contentHash: string): Promise<{ ok: true; previewed: boolean; sent: boolean } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db
    .from("eng_audit_events")
    .select("action")
    .in("action", ["announcement.previewed", "announcement.sent"])
    .contains("diff", { contentHash });
  if (error) return { ok: false, error: `The record of earlier previews could not be read: ${error.message}` };
  const actions = new Set((data ?? []).map((r) => String(r.action)));
  return { ok: true, previewed: actions.has("announcement.previewed"), sent: actions.has("announcement.sent") };
}

/** Everybody who joined the waitlist, once each, read in full. */
export async function waitlistRecipients(): Promise<{ ok: true; recipients: Recipient[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<Record<string, unknown>>((from, to) =>
    db.from("eng_leads").select("name, email").eq("form", "waitlist").order("created_at", { ascending: true }).range(from, to),
  );
  if (!read.ok) return { ok: false, error: `The waitlist could not be read: ${read.error}` };
  const seen = new Set<string>();
  const recipients: Recipient[] = [];
  for (const row of read.rows) {
    const email = String(row.email ?? "").trim();
    if (!email || seen.has(email.toLowerCase())) continue;
    seen.add(email.toLowerCase());
    recipients.push({ name: String(row.name ?? "").trim() || "there", email });
  }
  return { ok: true, recipients };
}

/** Step one: the announcement, as the list would get it, to the firm's own notification address. */
export async function sendAnnouncementPreview(actor: Actor | null, password: string): Promise<AnnounceStep> {
  const who = await announcerRefusal(actor, password);
  if (!who.ok) return who;

  const to = business.notificationEmail;
  const unsubscribe = unsubscribeUrl(to);
  if (!unsubscribe) {
    return { ok: false, status: 503, error: "No unsubscribe link could be signed on this deployment, so no preview was sent." };
  }
  const message = launchAnnouncement({ name: emailIdentity.signer.name, email: to, unsubscribeUrl: unsubscribe, orderUrl: `${business.url}/services` });
  const verdict = copyVerdict(`${message.subject}\n${message.text}`);
  if (!verdict.ok) return { ok: false, status: 409, error: `The announcement copy did not pass the regulated checks, so no preview was sent: ${verdict.summary}` };

  const contentHash = announcementContentHash();
  const recorded = await writeAuditOrRefuse({
    actor: { id: actor!.id, role: actor!.role, email: who.email },
    action: "announcement.previewed",
    entityType: "announcement",
    entityId: "marketing.launch",
    summary: `Sent the launch announcement preview to ${to}`,
    diff: { contentHash, to },
  });
  if (!recorded.ok) return { ok: false, status: 503, error: recorded.error };

  const queued = await queueEmail({ ...message, to, subject: `Preview: ${message.subject}` });
  if (!queued.ok) return { ok: false, status: 502, error: `The preview could not be queued: ${queued.error}` };
  return { ok: true, message: `A preview was queued to ${to}. Read it, then send to the waitlist.` };
}

/** Step two: the list, only for content previewed and not already sent. */
export async function sendAnnouncementToWaitlist(actor: Actor | null, password: string, contentHash: string): Promise<AnnounceStep> {
  const who = await announcerRefusal(actor, password);
  if (!who.ok) return who;

  const current = announcementContentHash();
  if (contentHash !== current) {
    return { ok: false, status: 409, error: "The announcement changed after the preview you read. Send a new preview first; nothing was sent." };
  }
  const history = await announcementHistory(current);
  if (!history.ok) return { ok: false, status: 503, error: history.error };
  if (!history.previewed) return { ok: false, status: 409, error: "No preview of this announcement was sent. Send the preview first; nothing was sent to the list." };
  if (history.sent) return { ok: false, status: 409, error: "This announcement was already sent to the waitlist. Nothing was sent again." };

  const list = await waitlistRecipients();
  if (!list.ok) return { ok: false, status: 503, error: list.error };

  const recorded = await writeAuditOrRefuse({
    actor: { id: actor!.id, role: actor!.role, email: who.email },
    action: "announcement.sent",
    entityType: "announcement",
    entityId: "marketing.launch",
    summary: `Sent the launch announcement to the waitlist, ${list.recipients.length} address(es)`,
    diff: { contentHash: current, recipients: list.recipients.length },
  });
  if (!recorded.ok) return { ok: false, status: 503, error: recorded.error };

  const sent = await sendLaunchAnnouncement(list.recipients);
  await writeAudit({
    actor: { id: actor!.id, role: actor!.role, email: who.email },
    action: sent.ok ? "announcement.queued" : "announcement.send_failed",
    entityType: "announcement",
    entityId: "marketing.launch",
    summary: sent.ok ? `Queued ${sent.queued}, skipped ${sent.skipped} on the suppression list` : sent.error,
    diff: sent.ok ? { contentHash: current, queued: sent.queued, skipped: sent.skipped } : { contentHash: current },
  });
  if (!sent.ok) return { ok: false, status: 502, error: sent.error };
  return { ok: true, message: `Queued to ${sent.queued} on the waitlist; ${sent.skipped} skipped because they asked not to be contacted.` };
}
