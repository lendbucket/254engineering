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

/**
 * The result of a send attempt.
 *
 * `outcome` is the four way answer the log line reports. `sent` stays as the
 * boolean the routes already branch on, so adding the detail did not change any
 * caller.
 */
export type NotifyOutcome = "ok" | "skipped" | "error" | "no content";
type NotifyResult = { sent: boolean; outcome: NotifyOutcome; reason?: string };

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
  if (!mailer) {
    return log(email, { sent: false, outcome: "skipped", reason: "RESEND_API_KEY is not set" });
  }

  // A rendered message with no body is a template bug, and sending it would put
  // an empty email in front of the one person who reads these. Caught here
  // rather than at the template, because this is the last point before it leaves.
  if (!email.text || email.text.trim() === "") {
    return log(email, { sent: false, outcome: "no content", reason: "rendered body was empty" });
  }

  try {
    const { error } = await mailer.emails.send({
      from: FROM,
      to: email.to ?? business.notificationEmail,
      subject: email.subject,
      replyTo: email.replyTo,
      text: email.text,
    });
    if (error) return log(email, { sent: false, outcome: "error", reason: error.message });
    return log(email, { sent: true, outcome: "ok" });
  } catch (err) {
    return log(email, {
      sent: false,
      outcome: "error",
      reason: err instanceof Error ? err.message : "unknown send failure",
    });
  }
}

/**
 * One line per send attempt, whatever happened.
 *
 * WHY EVERY OUTCOME LOGS, INCLUDING THE GOOD ONE
 * -----------------------------------------------
 * The routes already logged their failures, which meant a working send produced
 * no evidence at all. That is the wrong way round for a path this quiet: the
 * question somebody actually asks at three in the afternoon is "did the
 * notification for that enquiry go out", and silence answers it ambiguously. It
 * could mean sent, or it could mean the code never reached the send.
 *
 * Four outcomes, deliberately distinct, because they need different responses:
 *
 *   ok         It went. Nothing to do.
 *   skipped    No API key. A configuration gap, not a fault. This is what the
 *              whole of production logged before the key was set.
 *   error      Resend rejected it or the call threw. Investigate.
 *   no content The template rendered empty. A code defect, and the only one of
 *              the four that means the email would have been useless anyway.
 *
 * The subject is included and the body is not. The subject carries the name and
 * the service, which is enough to tie a log line to a row, and the body carries
 * whatever the person typed, which does not belong in a log.
 */
function log(email: RenderedEmail, result: NotifyResult): NotifyResult {
  const line = `[notify] ${result.outcome} template=${email.id} subject=${JSON.stringify(email.subject)}${result.reason ? ` reason=${JSON.stringify(result.reason)}` : ""}`;
  if (result.outcome === "ok") console.log(line);
  else console.error(line);
  return result;
}
