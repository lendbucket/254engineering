import { phoneForReading, telLink } from "@/lib/phone-link";

/**
 * A phone number staff can dial with one click. Office ready, 2026-10-20:
 * "Every phone number is a tel: link." telLink returns null rather than
 * guessing at a number that is not ten North American digits, and then this
 * prints the number as plain text, because a link that dials the wrong place
 * is worse than none.
 *
 * A number the platform STORED in E.164 reads as a person writes it, since
 * 2026-11-12: the franchise walk (Robert's order of that day, item 2) found a
 * franchisee's office printed "+13615550142" on the list, the record and the
 * owner's screen, because 0126 keeps it in E.164 and this printed it as
 * stored. A number somebody typed is still printed as they typed it.
 */
export function PhoneLink({ phone, className = "font-semibold text-[var(--navy)] underline" }: { phone: string | null | undefined; className?: string }) {
  if (!phone) return null;
  const href = telLink(phone);
  return href ? (
    <a href={href} className={className}>
      {phoneForReading(phone)}
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
