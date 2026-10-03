import { displayPhone } from "@/config/contact";

/**
 * ===========================================================================
 * A TELEPHONE NUMBER NEVER BREAKS ACROSS TWO LINES.
 * Operator ruling, 2026-10-03, from reading a capture at 390.
 * ===========================================================================
 *
 * The chooser rendered
 *
 *     If you would rather talk it through, call (281) 940-
 *     4490.
 *
 * because the hyphen in a North American number is a break opportunity and 390
 * is narrow. A number split over two lines is not a number: it cannot be read
 * aloud, it cannot be copied, and on the one page where somebody standing on a
 * roof wants to dial, it is the thing they came for.
 *
 * WHY A COMPONENT AND NOT whitespace-nowrap AT SIX CALL SITES. Six places render
 * this string: the footer, the hero, the generic call to action, the chooser,
 * the firm's own location page, and the customer login. Six copies of the rule
 * is five chances to forget it, and the seventh render added next month would
 * start wrong. The number has one deriver in `contact.ts`; this gives it one
 * renderer.
 *
 * IT RETURNS NULL WHEN THERE IS NO NUMBER, matching every call site it replaces.
 * `displayPhone()` is null while FIRM_PHONE is unset, and the standing rule in
 * OfferCta is that the button does not exist until the number does: a call
 * affordance is the easiest thing on this site to fake.
 *
 * THE PREFIX IS DELIBERATELY OUTSIDE IT. "Call " and "call us on " may wrap; the
 * digits may not. Wrapping the whole phrase would push a long label onto its own
 * line for no reason.
 */
export function PhoneNumber({ className }: { className?: string }) {
  const phone = displayPhone();
  if (!phone) return null;
  return <span className={`whitespace-nowrap${className ? ` ${className}` : ""}`}>{phone}</span>;
}
