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

/**
 * The number as a person reads it. Only the platform's own stored shape, E.164
 * for North America (+1 and ten digits, as 0126 holds a franchisee's office),
 * is rewritten, to (361) 555-0142; anything typed any other way is returned
 * exactly as typed, because rewriting what a person entered is a different
 * decision from printing what the platform stored.
 */
export function phoneForReading(phone: string): string {
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(phone.trim());
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : phone;
}
