/**
 * WHERE REPLIES TO SALES EMAILS GO. Robert's answer 1 of 2026-11-02 to issue
 * #1 comment 6587550325: "yes, reply subdomain with Resend Inbound; post the
 * exact DNS records for me on issue #1; support mailbox until then."
 *
 * The records are posted (6588394106). Until Robert says they are in place
 * and verified in Resend, this is null, a sequence email's Reply-To is the
 * support mailbox (the human sender's default in email-identity.ts), and no
 * crm+<company> tag is sent. Setting it is one deliberate edit, made when the
 * subdomain reads verified: from then a sequence email's Reply-To is
 * crm+<company id>@<this domain>, and the reply webhook
 * (/api/inbound/resend, closed until RESEND_WEBHOOK_SECRET is set) matches the
 * reply to its company by that tag first, by the sender's address second.
 */
export const CRM_REPLY_DOMAIN: string | null = null;
