/**
 * ===========================================================================
 * AN ACCOUNT'S CREDIT TERMS. Robert's ruling, 10:52 Central 2026-10-29
 * (issue #1 comment 6501552714), 254-WF-022 step 3.
 * ===========================================================================
 *
 * "An admin panel on /portal/accounts to set an account's credit terms. It is
 * confirmed by password re-entry, the same as the no-charge override, not an
 * authenticator code. The owner's admin account uses none. Audit row on every
 * change. This is a money flow, so it needs its own proof and an injection."
 *
 * A credit limit is the firm deciding how much it is willing to be owed, so the
 * act asks for the administrator's password again in the same step, the way a
 * job at no charge does for the owner (verifyOwnPassword, ops-auth.ts). Here it
 * is the rule for every administrator rather than an override: the ruling says
 * password re-entry and not an authenticator code, and the owner's account has
 * no authenticator to ask.
 *
 * What lives here is everything that can be decided without the database, in
 * one place, so the panel and the server cannot disagree about it. The read,
 * the password check, the record and the write are setAccountTerms in
 * ops-accounts-admin.ts.
 *
 * MONEY STAYS IN CENTS AND IS NEVER ROUNDED. The route this replaces stored
 * Math.round of whatever number arrived, so 1999.5 cents became 2000 without
 * anybody being told. A limit that is not a whole number of cents is refused.
 */

export type BillingMode = "card" | "invoice";

/** The three columns this act may change on eng_customer_accounts. */
export type AccountTerms = {
  billingMode: BillingMode;
  /** Null is NO credit agreed, which is a real setting rather than an omission. */
  creditLimitCents: number | null;
  netDays: number;
};

/** What the panel sends. A field left out is left alone. */
export type TermsChange = {
  billingMode?: unknown;
  creditLimitCents?: unknown;
  netDays?: unknown;
  password?: unknown;
};

/** The range eng_customer_accounts.net_days carries in 0009. */
export const NET_DAYS_MIN = 0;
export const NET_DAYS_MAX = 120;

export const TERMS_AUDIT_ACTION = "account.terms_changed";
export const TERMS_FAILED_ACTION = "account.terms_change_failed";

/** The sentence the panel and the server both give when the password is missing. */
export const TERMS_PASSWORD_MISSING = "Changing an account's terms needs your password, entered again here.";

/**
 * The new terms, or why they are refused. Fields absent from the change keep
 * their current value; the result is the whole set after the change.
 */
export function termsFromChange(
  current: AccountTerms,
  change: TermsChange,
): { ok: true; next: AccountTerms } | { ok: false; error: string } {
  const next: AccountTerms = { ...current };

  if ("billingMode" in change && change.billingMode !== undefined) {
    if (change.billingMode !== "card" && change.billingMode !== "invoice") {
      return { ok: false, error: "Billing is by card or by invoice." };
    }
    next.billingMode = change.billingMode;
  }

  if ("creditLimitCents" in change && change.creditLimitCents !== undefined) {
    const raw = change.creditLimitCents;
    if (raw === null) next.creditLimitCents = null;
    else if (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) next.creditLimitCents = raw;
    else {
      return {
        ok: false,
        error: "A credit limit is a whole number of cents, zero or more, or none for no credit.",
      };
    }
  }

  if ("netDays" in change && change.netDays !== undefined) {
    const raw = change.netDays;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < NET_DAYS_MIN || raw > NET_DAYS_MAX) {
      return { ok: false, error: `Net days are a whole number from ${NET_DAYS_MIN} to ${NET_DAYS_MAX}.` };
    }
    next.netDays = raw;
  }

  return { ok: true, next };
}

/** Each field that moves, with both sides, for the audit row's diff. */
export function termsDiff(
  current: AccountTerms,
  next: AccountTerms,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  if (current.billingMode !== next.billingMode) out.billing_mode = { from: current.billingMode, to: next.billingMode };
  if (current.creditLimitCents !== next.creditLimitCents) {
    out.credit_limit_cents = { from: current.creditLimitCents, to: next.creditLimitCents };
  }
  if (current.netDays !== next.netDays) out.net_days = { from: current.netDays, to: next.netDays };
  return out;
}

/**
 * A limit in cents as the text the limit box starts with: "2500.50", or empty
 * for no credit. Whole cents split by integer arithmetic, never by dividing and
 * rounding, so the box shows exactly what is stored. This is an input value,
 * not a figure for reading, which is money()'s job.
 */
export function dollarsForInput(cents: number | null): string {
  if (cents === null) return "";
  const whole = Math.trunc(cents / 100);
  const part = String(cents % 100).padStart(2, "0");
  return `${whole}.${part}`;
}

/**
 * Dollars as a person types them, to cents, exactly. "1,250" and "1250.5" are
 * read; "12.345" and "-5" are refused rather than rounded. An empty field is
 * no credit agreed, which the panel says beside the box.
 */
export function centsFromDollars(text: string): { ok: true; cents: number | null } | { ok: false; error: string } {
  const t = text.trim().replace(/,/g, "");
  if (t === "") return { ok: true, cents: null };
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return { ok: false, error: "Type the limit in dollars, such as 2500 or 2500.50, or leave it empty for no credit." };
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "That limit is too large." };
  return { ok: true, cents };
}
