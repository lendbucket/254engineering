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

export const emailIdentity = {
  /** The person who signs anything a candidate or client receives. */
  signer: {
    name: "Robert Reyna",
    title: "Founder",
  },

  senders: {
    /**
     * Machine to operator: form notifications, submissions, internal packages.
     * No personal name, because nobody signs a notification to themselves.
     */
    operator: {
      displayName: business.name,
      address: `notifications@${business.domain}`,
    },
    /**
     * Anything a person outside the firm reads. Named, because an application
     * confirmation from a no-reply address is how a firm tells somebody their
     * application went into a queue rather than to a person.
     */
    human: {
      displayName: `Robert Reyna, ${business.name}`,
      address: `notifications@${business.domain}`,
      /**
       * OWNER VERIFICATION: this is a mailbox on another domain, used because it
       * is read today and a firm mailbox is not yet provisioned. Replace with
       * the firm address the moment one exists; nothing else has to change.
       */
      replyTo: business.notificationEmail,
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
