import "server-only";
import { isPrelaunch } from "./launch";
import { business } from "@/config/business";
import { queueEmail } from "./ops-jobs";
import { launchAnnouncement } from "./email-templates";
import { copyVerdict } from "./partner-copy";
import { isSuppressed, unsubscribeUrl } from "./marketing-suppression";

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
  if (isPrelaunch()) {
    return (
      "The firm's registration with the Texas Board of Professional Engineers and Land Surveyors " +
      "is pending. The launch announcement says the firm is open for orders, which is a present " +
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
