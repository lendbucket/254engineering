import { business } from "./business";

/**
 * Who each outbound email comes from, and who signs it.
 *
 * WHY THIS IS A CONFIG AND NOT A STRING IN EACH TEMPLATE
 * ------------------------------------------------------
 * A name and a title appear in three places per human facing email: the From
 * display name, the signature block, and sometimes the body copy. Written by
 * hand in each template, they drift the moment a title changes, and the symptom
 * is an email signed by a Founder that arrives from a display name that says
 * something else. email-audit asserts the signature matches this file, so a
 * template cannot invent its own identity.
 *
 * NOTHING HERE IS ASPIRATIONAL
 * ----------------------------
 * The same rule as src/config/business.ts. "Founder" is a true description of
 * the operator's relationship to the firm today and needs no registration to be
 * accurate, which is why it is usable while the TBPELS registration is pending.
 * A title implying licensure, engineering authority, or a role nobody holds
 * would be a regulated claim, and the voice audit's regulatory patterns cover
 * the rendered output of these templates for exactly that reason.
 *
 * REPLY-TO IS A REAL MAILBOX, NOT THE PRETTY ONE
 * ----------------------------------------------
 * Human facing mail is sent from the firm domain because that is what is
 * verified with the sending provider and what a recipient should see. Replies go
 * to a mailbox that is read today. When a firm mailbox exists, one line changes
 * here and every template follows.
 */

export type SenderPurpose = "operator" | "human";

/**
 * THE FROM NAME AND THE REPLY-TO, DEFINED ONCE.
 *
 * Operator ruling, 2026-09-08. Every email this firm sends is FROM "254
 * Engineering" and replies to the firm's own support mailbox. Two constants
 * rather than a value per sender, because the previous shape let the two
 * purposes drift into two identities, and a customer who gets a confirmation
 * from one name and an alert from another is looking at two firms.
 *
 * WHAT THIS REPLACES, AND WHY IT WAS ALWAYS TEMPORARY.
 * The human sender used to reply to ceo@36west.org, a mailbox on another
 * domain, and the note beside it said in plain terms: replace with the firm
 * address the moment one exists, nothing else has to change. That moment is
 * now, and nothing else had to change.
 *
 * ceo@36west.org must not appear on any 254 email, and email-audit asserts it
 * over every template rather than trusting this file.
 */
export const FROM_DISPLAY_NAME = "254 Engineering";
export const REPLY_TO = `support@${business.domain}`;

/**
 * THE TEMPLATES THAT REPLY SOMEWHERE ELSE, AND WHY EACH ONE DOES.
 *
 * The From name has no exceptions and takes none. Reply-To has six, and they
 * are declared here with reasons rather than left as whatever each template
 * happened to do, because an exception nobody wrote down is indistinguishable
 * from a mistake. Same idiom as the cast allowlist and the sign in allowlist:
 * the rule is enforced, and getting out of it costs a sentence.
 *
 * Anything not named here replies to the firm's support mailbox, and
 * email-audit fails on any template that quietly adds itself.
 */
export const REPLY_TO_EXCEPTIONS: Record<string, string> = {
  "lead.contact":
    "replies to the enquirer. An operator reading this on a phone answers a new enquiry by pressing reply, and that is the whole workflow.",
  "lead.waitlist": "replies to the enquirer, for the same reason as lead.contact.",
  "apply.notification":
    "replies to the applicant, so the operator can answer a candidate from the notification itself.",
  "onboarding.submitted":
    "replies to the person who submitted, so a question about their paperwork reaches them.",
  /*
   * The three machine alerts USED to be here, replying to info@. Operator
   * ruling, 2026-09-08: they collapse to the firm address like everything else.
   * One firm address for anything a human might reply to, and info@ is not a
   * confirmed mailbox, so an alert inviting a reply to it invites one nobody
   * reads. They are checked by the rule now rather than exempt from it.
   */
};

export const emailIdentity = {
  /** The person who signs anything a candidate or client receives. */
  signer: {
    name: "Robert Reyna",
    title: "Founder",
  },

  senders: {
    /**
     * Machine to operator: form notifications, submissions, internal packages.
     * Unsigned in the body, which is where the two purposes still differ. The
     * headers no longer do.
     */
    operator: {
      displayName: FROM_DISPLAY_NAME,
      address: `notifications@${business.domain}`,
      replyTo: REPLY_TO,
    },
    /**
     * Anything a person outside the firm reads. The signature block in the body
     * is what makes this one personal now, rather than the From header: a named
     * From that replies to a mailbox nobody watches is worse than a firm From
     * that replies to one somebody does.
     */
    human: {
      displayName: FROM_DISPLAY_NAME,
      address: `notifications@${business.domain}`,
      replyTo: REPLY_TO,
    },
  },
} as const;

/** The From header for a purpose, in the form a mail provider expects. */
export function fromHeader(purpose: SenderPurpose): string {
  const s = emailIdentity.senders[purpose];
  return `${s.displayName} <${s.address}>`;
}

/**
 * The signature block, as lines.
 *
 * Returned as an array rather than a string so the HTML layout can set each line
 * differently while the plaintext part joins them with newlines, and neither can
 * fall out of step with the other.
 */
export function signatureLines(): string[] {
  return [
    emailIdentity.signer.name,
    emailIdentity.signer.title,
    business.name,
    business.url,
  ];
}

/**
 * The postal address commercial mail is expected to carry.
 *
 * Read from MAIL_FROM_ADDRESS_LINE rather than committed, because the firm has
 * no published premises yet and inventing one would be the exact class of
 * fabrication the placeholder audit exists to catch. Absent means the footer
 * omits the line rather than rendering an empty row.
 */
export function mailingAddressLine(): string | null {
  const raw = process.env.MAIL_FROM_ADDRESS_LINE?.trim();
  return raw && raw.length > 0 ? raw : null;
}
