import "server-only";
import { Resend } from "resend";
import { business } from "@/config/business";
import type { RenderedEmail } from "./email-templates";

/**
 * Notification email for form submissions.
 *
 * WHY EVERY CALLER IGNORES THE RESULT
 * -----------------------------------
 * The database write is the record. The email is how somebody finds out about it
 * today. Those are different obligations and they should fail independently: a
 * Resend outage, an unset key, or a bounced address must never turn a captured
 * enquiry into a 500 for the person who submitted it, because they will not fill
 * the form in twice.
 *
 * So this never throws. It reports what happened through its return value, the
 * routes log it, and the row is already safe either way.
 *
 * The body is plain text. These go to one operator, not to a marketing list, and
 * a plain text notification is readable on a phone lock screen, quotable into a
 * reply, and immune to the image blocking that would hide half an HTML one.
 */

type NotifyResult = { sent: boolean; reason?: string };

let resend: Resend | null = null;

function client(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

/**
 * The From address.
 *
 * OWNER VERIFICATION: notifications@254engineering.com requires the domain to be
 * verified in Resend before anything sends. Until that is done this returns
 * `sent: false` with the reason, and the rows still land.
 */
const FROM = `254 Engineering Services <notifications@${business.domain}>`;

/**
 * Send an already rendered message.
 *
 * The rendering lives in src/lib/email-templates.ts and this function does not
 * compose copy. That separation is what lets scripts/email-audit.mjs check every
 * outbound template without a network, a key, or a send: it renders the same
 * functions this route does and reads the result.
 */
export async function notify(email: RenderedEmail): Promise<NotifyResult> {
  const mailer = client();
  if (!mailer) return { sent: false, reason: "RESEND_API_KEY is not set" };

  try {
    const { error } = await mailer.emails.send({
      from: FROM,
      to: business.notificationEmail,
      subject: email.subject,
      replyTo: email.replyTo,
      text: email.text,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "unknown send failure" };
  }
}
