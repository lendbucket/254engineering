/**
 * A tel: link for a number somebody else gave us: a customer, a prospect, a
 * technician. Office ready (2026-10-20): every phone number staff see is one
 * click from dialling.
 *
 * Not telHref in src/config/contact.ts, which is the FIRM's own number and
 * reads FIRM_PHONE. This takes the number as stored, which may be typed any
 * way at all, and returns null rather than guessing when it is not a North
 * American number with ten digits. A link that dials the wrong place is worse
 * than plain text, because the person clicking it trusts it.
 *
 * Client safe: no server imports.
 */
export function telLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return null;
}
