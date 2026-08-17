import "server-only";
import { Resend } from "resend";
import { business } from "@/config/business";

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

export async function notify(params: {
  subject: string;
  lines: [string, string | null | undefined][];
  replyTo?: string;
}): Promise<NotifyResult> {
  const mailer = client();
  if (!mailer) return { sent: false, reason: "RESEND_API_KEY is not set" };

  // Empty values are dropped rather than rendered as a blank line, so the
  // notification reads as what was submitted rather than as a form with holes.
  const body = params.lines
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([label, value]) => `${label}: ${String(value).trim()}`)
    .join("\n");

  try {
    const { error } = await mailer.emails.send({
      from: FROM,
      to: business.notificationEmail,
      subject: params.subject,
      replyTo: params.replyTo,
      text: `${body}\n\nSubmitted through ${business.domain}.`,
    });
    if (error) return { sent: false, reason: error.message };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "unknown send failure" };
  }
}
