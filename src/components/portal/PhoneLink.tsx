import { telLink } from "@/lib/phone-link";

/**
 * A phone number staff can dial with one click. Office ready, 2026-10-20:
 * "Every phone number is a tel: link." telLink returns null rather than
 * guessing at a number that is not ten North American digits, and then this
 * prints the number as plain text, because a link that dials the wrong place
 * is worse than none.
 */
export function PhoneLink({ phone, className = "font-semibold text-[var(--navy)] underline" }: { phone: string | null | undefined; className?: string }) {
  if (!phone) return null;
  const href = telLink(phone);
  return href ? (
    <a href={href} className={className}>
      {phone}
    </a>
  ) : (
    <>{phone}</>
  );
}

/**
 * A line of details joined by a separator, as the screens already print them,
 * with the phone number among them dialable. Empty parts are left out, exactly
 * as `.filter(Boolean).join(sep)` did.
 */
export function JoinedWithPhone({ parts, sep }: { parts: (string | null | undefined | { phone: string | null | undefined })[]; sep: string }) {
  const present = parts.filter((p) => (typeof p === "object" && p !== null ? Boolean(p.phone) : Boolean(p)));
  return (
    <>
      {present.map((p, i) => (
        <span key={i}>
          {i > 0 ? sep : ""}
          {typeof p === "object" && p !== null ? <PhoneLink phone={p.phone} /> : p}
        </span>
      ))}
    </>
  );
}
