/**
 * THE FRANCHISEE RECORD'S RULES, PURE. Robert's overnight orders of 2026-11-10,
 * platform item X1: "a franchise record owning one or more territories, its own
 * technicians and sales reps, its own office NAP." Staff and admin only.
 *
 * Every rule a write obeys is here, with no database and no session, so the
 * proof can call each one directly and the server library (franchisees.ts)
 * cannot drift from what the proof tests. The same rules are also held by 0125's
 * checks, so a write that slipped past this file is still refused by the
 * database.
 */

export const FRANCHISEE_STATUSES = ["onboarding", "operating", "ended"] as const;
export type FranchiseeStatus = (typeof FRANCHISEE_STATUSES)[number];

export const FRANCHISEE_STATUS_LABEL: Record<FranchiseeStatus, string> = {
  onboarding: "Onboarding",
  operating: "Operating",
  ended: "Ended",
};

/** The roles a franchisee's people hold today: its technicians and its sales reps. */
export const FRANCHISEE_MEMBER_ROLES = ["field_tech", "rep"] as const;

export type OfficeInput = { street: string; city: string; postalCode: string; phone: string };
export type Office = { street: string | null; city: string | null; postalCode: string | null; phone: string | null };

const trimmed = (s: string | null | undefined) => (typeof s === "string" ? s.trim() : "");

/** The legal name, as 0125's eng_franchisees_legal_name_shape holds it. */
export function legalNameProblem(name: string | null | undefined): string | null {
  const n = trimmed(name);
  if (n.length < 2) return "Give the franchisee's legal name, as it is registered.";
  if (n.length > 120) return "That name is longer than 120 characters. Give the legal name as registered.";
  return null;
}

/**
 * A telephone number as E.164 (+1 and ten digits), the shape the firm's own is
 * held in. Accepts what a person types: spaces, dashes, dots, brackets, a
 * leading 1. Returns null when it is not a ten digit North American number.
 */
export function e164(phone: string | null | undefined): string | null {
  const digits = trimmed(phone).replace(/[^0-9]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

/**
 * The office NAP, whole or not at all (0125's eng_franchisees_address_whole):
 * all three address parts empty clears the address; any one given needs all
 * three. The phone stands on its own and may be empty.
 */
export function officeFrom(input: OfficeInput): { ok: true; office: Office } | { ok: false; error: string } {
  const street = trimmed(input.street);
  const city = trimmed(input.city);
  const postalCode = trimmed(input.postalCode);
  const phoneTyped = trimmed(input.phone);
  const phone = phoneTyped ? e164(phoneTyped) : null;
  if (phoneTyped && !phone) return { ok: false, error: "The office phone must be a ten digit number, area code first." };
  const any = street || city || postalCode;
  if (!any) return { ok: true, office: { street: null, city: null, postalCode: null, phone } };
  if (street.length < 3 || street.length > 120) return { ok: false, error: "Give the office's street address, or clear all three address boxes." };
  if (city.length < 2 || city.length > 60) return { ok: false, error: "Give the office's city, or clear all three address boxes." };
  if (!/^[0-9]{5}$/.test(postalCode)) return { ok: false, error: "The postal code is five digits." };
  return { ok: true, office: { street, city, postalCode, phone } };
}

/**
 * A change of status. An ended franchisee needs a reason, and only an ended one
 * carries one (0125's eng_franchisees_end_says_why). Ending is final from this
 * screen: an ended record is not reopened, because the history of a
 * relationship that ended is the thing the record keeps.
 */
export function statusChange(
  from: FranchiseeStatus,
  to: string,
  reason: string | null | undefined,
): { ok: true; to: FranchiseeStatus; reason: string | null } | { ok: false; error: string } {
  if (!(FRANCHISEE_STATUSES as readonly string[]).includes(to)) return { ok: false, error: "That is not a status a franchisee can have." };
  const next = to as FranchiseeStatus;
  if (from === "ended") return { ok: false, error: "This franchisee has ended. An ended record is kept as it is and is not reopened." };
  if (next === from) return { ok: false, error: "That is already its status." };
  if (next === "ended") {
    const why = trimmed(reason);
    if (why.length < 3) return { ok: false, error: "Say why the franchisee ended. The reason is kept with the record." };
    if (why.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };
    return { ok: true, to: next, reason: why };
  }
  return { ok: true, to: next, reason: null };
}

/** Whether a person of this role can be one of a franchisee's people. */
export function mayBeMember(role: string | null | undefined): boolean {
  return (FRANCHISEE_MEMBER_ROLES as readonly string[]).includes(String(role ?? ""));
}
