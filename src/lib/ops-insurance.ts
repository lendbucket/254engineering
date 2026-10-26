import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";
import { raise } from "./ops-notify";
import { todayInFirmCalendar } from "./firm-calendar";
import { DB_NOW } from "./db-now";
import { insuranceOverride } from "@/config/credentials";

/**
 * ===========================================================================
 * THE INSURANCE REGISTER. Robert's addendum of 2026-10-25, item 1; 0090.
 * ===========================================================================
 *
 * A policy is recorded from its certificate: carrier, policy number, kind, the
 * per claim and aggregate limits, the named insureds, the effective and expiry
 * dates, and the certificate PDF itself, kept in the private eng-insurance
 * bucket with its SHA-256 on the row. The row is never edited or deleted (the
 * database refuses both); a policy recorded in error or replaced is withdrawn
 * with a reason.
 *
 * The office and the owner (insurance.manage) record and withdraw, and are
 * told at 45, 14 and 1 days before a policy in force expires, by the daily
 * sweep below.
 *
 * WHAT IT DOES NOT DECIDE YET. Robert ruled on 2026-10-25, 23:49 Central:
 * ordering stays live, the owner's override runs to 2026-12-31 and its expiry
 * is the only hard close, and when a policy is recorded here the gate counts
 * it while the register never closes the gate. How the gate counts it is put
 * back to him (BACKLOG.md), because the gate is read at build and the one
 * database read it may make is a signed protocol's. Until then a policy
 * recorded here drives the warnings and opens nothing and closes nothing.
 *
 * AND THE OWNER IS REMINDED 14 DAYS BEFORE THE OVERRIDE EXPIRES, by the same
 * sweep, once (the same ruling).
 */

export const INSURANCE_BUCKET = "eng-insurance";
export const INSURANCE_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;
export const ALERT_THRESHOLDS = [45, 14, 1] as const;

export type InsuranceKind = "professional_liability" | "general_liability";
export const INSURANCE_KIND_LABEL: Record<InsuranceKind, string> = {
  professional_liability: "Professional liability",
  general_liability: "General liability",
};

export type InsurancePolicy = {
  id: string;
  createdAt: string;
  kind: InsuranceKind;
  carrier: string;
  policyNumber: string;
  limitPerClaimCents: number;
  limitAggregateCents: number;
  namedInsureds: string[];
  effectiveOn: string;
  expiresOn: string;
  certificateKey: string;
  certificateSha256: string;
  withdrawnAt: string | null;
  withdrawnReason: string | null;
};

export type PolicyInput = {
  kind: string;
  carrier: string;
  policyNumber: string;
  limitPerClaim: string;
  limitAggregate: string;
  namedInsureds: string;
  effectiveOn: string;
  expiresOn: string;
};

type Valid = {
  kind: InsuranceKind;
  carrier: string;
  policyNumber: string;
  limitPerClaimCents: number;
  limitAggregateCents: number;
  namedInsureds: string[];
  effectiveOn: string;
  expiresOn: string;
};

/**
 * A dollar figure as the certificate prints it, to cents. Commas and a leading
 * dollar sign are allowed; anything else, a blank included, is refused rather
 * than read as zero (the sweep's M-partner-blank defect, not repeated here).
 */
export function dollarsToCentsStrict(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const realDate = (d: string) => ISO_DATE.test(d) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`)) && new Date(`${d}T12:00:00Z`).toISOString().slice(0, 10) === d;

/** Every field as the certificate states it, or the first reason it cannot be recorded. Pure. */
export function validatePolicy(input: PolicyInput): { ok: true; value: Valid } | { ok: false; error: string } {
  if (input.kind !== "professional_liability" && input.kind !== "general_liability") {
    return { ok: false, error: "Choose whether this is professional liability or general liability cover." };
  }
  const carrier = input.carrier.trim();
  if (!carrier) return { ok: false, error: "Enter the carrier exactly as the certificate names it." };
  const policyNumber = input.policyNumber.trim();
  if (!policyNumber) return { ok: false, error: "Enter the policy number exactly as the certificate prints it." };
  const perClaim = dollarsToCentsStrict(input.limitPerClaim);
  if (perClaim === null) return { ok: false, error: "Enter the per claim limit in dollars, as the certificate states it." };
  const aggregate = dollarsToCentsStrict(input.limitAggregate);
  if (aggregate === null) return { ok: false, error: "Enter the aggregate limit in dollars, as the certificate states it." };
  if (aggregate < perClaim) return { ok: false, error: "The aggregate limit cannot be less than the per claim limit. Check both against the certificate." };
  const namedInsureds = input.namedInsureds.split("\n").map((n) => n.trim()).filter(Boolean);
  if (namedInsureds.length === 0) return { ok: false, error: "Enter each named insured on its own line, as the certificate lists them." };
  if (!realDate(input.effectiveOn)) return { ok: false, error: "Enter the effective date." };
  if (!realDate(input.expiresOn)) return { ok: false, error: "Enter the expiry date." };
  if (input.expiresOn <= input.effectiveOn) return { ok: false, error: "The expiry date must be after the effective date." };
  return {
    ok: true,
    value: {
      kind: input.kind,
      carrier,
      policyNumber,
      limitPerClaimCents: perClaim,
      limitAggregateCents: aggregate,
      namedInsureds,
      effectiveOn: input.effectiveOn,
      expiresOn: input.expiresOn,
    },
  };
}

const isPdf = (bytes: Uint8Array) =>
  bytes.length > 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

/** Records a policy from its certificate. The PDF is stored first; a row that cannot be written removes it again. */
export async function recordPolicy(
  actor: Actor | null,
  input: PolicyInput,
  certificate: Uint8Array,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!can(actor, "insurance.manage")) return { ok: false, error: "Only the office or the owner records the firm's insurance." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const valid = validatePolicy(input);
  if (!valid.ok) return valid;
  if (certificate.length === 0) return { ok: false, error: "Attach the certificate of insurance as a PDF." };
  if (certificate.length > INSURANCE_CERTIFICATE_MAX_BYTES) return { ok: false, error: "That certificate is over 10 MB. Send the carrier's PDF as issued." };
  if (!isPdf(certificate)) return { ok: false, error: "The certificate must be a PDF." };

  const sha256 = createHash("sha256").update(certificate).digest("hex");
  const key = `policies/${randomUUID()}.pdf`;
  const { error: uploadError } = await db.storage
    .from(INSURANCE_BUCKET)
    .upload(key, certificate, { contentType: "application/pdf", upsert: false });
  if (uploadError) return { ok: false, error: `The certificate could not be stored, so nothing was recorded (${uploadError.message}).` };

  const v = valid.value;
  const { data, error } = await db
    .from("eng_insurance_policies")
    .insert({
      kind: v.kind,
      carrier: v.carrier,
      policy_number: v.policyNumber,
      limit_per_claim_cents: v.limitPerClaimCents,
      limit_aggregate_cents: v.limitAggregateCents,
      named_insureds: v.namedInsureds,
      effective_on: v.effectiveOn,
      expires_on: v.expiresOn,
      certificate_key: key,
      certificate_sha256: sha256,
      certificate_bytes: certificate.length,
      recorded_by: actor!.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    const { error: removeError } = await db.storage.from(INSURANCE_BUCKET).remove([key]);
    return {
      ok: false,
      error: `The policy was not recorded (${error?.message ?? "no row came back"})${
        removeError ? `, and its certificate could not be removed again (${removeError.message}); tell the operator the key ${key}` : ""
      }.`,
    };
  }
  return { ok: true, id: data.id as string };
}

/** Withdraws a policy with a reason. The row is kept as it was. */
export async function withdrawPolicy(
  actor: Actor | null,
  id: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!can(actor, "insurance.manage")) return { ok: false, error: "Only the office or the owner withdraws a policy." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const why = reason.trim();
  if (!why) return { ok: false, error: "Say why the policy is withdrawn, for example that it was replaced or recorded in error." };
  const { data, error } = await db
    .from("eng_insurance_policies")
    .update({ withdrawn_at: DB_NOW, withdrawn_by: actor!.id, withdrawn_reason: why })
    .eq("id", id)
    .is("withdrawn_at", null)
    .select("id");
  if (error) return { ok: false, error: `The policy was not withdrawn (${error.message}).` };
  if (!data?.length) return { ok: false, error: "That policy is not on the register, or is already withdrawn." };
  return { ok: true };
}

type PolicyRow = {
  id: string; created_at: string; kind: InsuranceKind; carrier: string; policy_number: string;
  limit_per_claim_cents: number; limit_aggregate_cents: number; named_insureds: string[];
  effective_on: string; expires_on: string; certificate_key: string; certificate_sha256: string;
  withdrawn_at: string | null; withdrawn_reason: string | null;
};

const toPolicy = (r: PolicyRow): InsurancePolicy => ({
  id: r.id,
  createdAt: r.created_at,
  kind: r.kind,
  carrier: r.carrier,
  policyNumber: r.policy_number,
  limitPerClaimCents: Number(r.limit_per_claim_cents),
  limitAggregateCents: Number(r.limit_aggregate_cents),
  namedInsureds: r.named_insureds ?? [],
  effectiveOn: r.effective_on,
  expiresOn: r.expires_on,
  certificateKey: r.certificate_key,
  certificateSha256: r.certificate_sha256,
  withdrawnAt: r.withdrawn_at,
  withdrawnReason: r.withdrawn_reason,
});

/** Every policy on the register, newest expiry first, or a failed read said as one. */
export async function listPolicies(actor: Actor | null): Promise<{ ok: true; policies: InsurancePolicy[] } | { ok: false; error: string }> {
  if (!can(actor, "insurance.manage")) return { ok: false, error: "Only the office or the owner sees the firm's insurance." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<PolicyRow>((from, to) =>
    db
      .from("eng_insurance_policies")
      .select("id, created_at, kind, carrier, policy_number, limit_per_claim_cents, limit_aggregate_cents, named_insureds, effective_on, expires_on, certificate_key, certificate_sha256, withdrawn_at, withdrawn_reason")
      .order("expires_on", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return read.ok ? { ok: true, policies: read.rows.map(toPolicy) } : { ok: false, error: read.error };
}

/** A five minute link to a certificate, for the office and the owner only. */
export async function certificateLink(actor: Actor | null, id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!can(actor, "insurance.manage")) return { ok: false, error: "Only the office or the owner opens a certificate." };
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const { data, error } = await db.from("eng_insurance_policies").select("certificate_key").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: `The policy could not be read (${error.message}).` };
  if (!data) return { ok: false, error: "That policy is not on the register." };
  const { data: signed, error: signError } = await db.storage.from(INSURANCE_BUCKET).createSignedUrl(data.certificate_key as string, 300);
  if (signError || !signed?.signedUrl) return { ok: false, error: `The certificate could not be opened (${signError?.message ?? "no link came back"}).` };
  return { ok: true, url: signed.signedUrl };
}

/** Whole days from today to the expiry date, on the firm's calendar. Negative once it has passed. */
export function daysToExpiry(expiresOn: string, today: string = todayInFirmCalendar()): number {
  return Math.round((Date.parse(`${expiresOn}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/**
 * The one threshold due for a policy today, or null. Pure. A policy in force
 * that expires within a threshold, and whose tightest such threshold has not
 * been sent, is due for that threshold only: a policy recorded nine days from
 * expiry is warned once at 14 rather than at 45 and 14 together, and the 45
 * day warning is then never sent, which is the truth (it was not given).
 * Nothing is due for a withdrawn policy or one already expired.
 */
export function alertDue(policy: Pick<InsurancePolicy, "expiresOn" | "withdrawnAt">, sent: number[], today: string): number | null {
  if (policy.withdrawnAt) return null;
  const left = daysToExpiry(policy.expiresOn, today);
  if (left < 0) return null;
  const tightest = [...ALERT_THRESHOLDS].sort((a, b) => a - b).find((t) => left <= t);
  if (tightest === undefined || sent.includes(tightest)) return null;
  return tightest;
}

/*
 * WHO IS WARNED, AND WHY NOT EVERYBODY ON DEVELOPMENT. The office and the owner
 * are every active profile whose role is admin or ops_manager. Outside
 * production the sweep warns only probe accounts (audit-probe.invalid), so no
 * run against development can email a real person (Robert's standing rule).
 */
const PROBE_DOMAIN = "@audit-probe.invalid";

/** The daily sweep: records each due warning before raising it, so a threshold is sent once. */
export async function sendInsuranceExpiryAlerts(
  today: string = todayInFirmCalendar(),
): Promise<{ ok: true; sent: number } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const policies = await readEvery<PolicyRow>((from, to) =>
    db
      .from("eng_insurance_policies")
      .select("id, created_at, kind, carrier, policy_number, limit_per_claim_cents, limit_aggregate_cents, named_insureds, effective_on, expires_on, certificate_key, certificate_sha256, withdrawn_at, withdrawn_reason")
      .is("withdrawn_at", null)
      .order("id", { ascending: true })
      .range(from, to),
  );
  if (!policies.ok) return { ok: false, error: `the policies could not be read (${policies.error})` };
  const alerts = await readEvery<{ policy_id: string; days_before: number }>((from, to) =>
    db.from("eng_insurance_alerts").select("policy_id, days_before").order("policy_id", { ascending: true }).range(from, to),
  );
  if (!alerts.ok) return { ok: false, error: `the warnings already sent could not be read (${alerts.error})` };
  const people = await readEvery<{ id: string; role: string; email: string | null }>((from, to) =>
    db.from("eng_profiles").select("id, role, email").in("role", ["admin", "ops_manager"]).eq("status", "active").order("id", { ascending: true }).range(from, to),
  );
  if (!people.ok) return { ok: false, error: `the office and the owner could not be read (${people.error})` };
  const production = process.env.VERCEL_ENV === "production";
  const recipients = people.rows.filter((p) => production || String(p.email ?? "").toLowerCase().endsWith(PROBE_DOMAIN));

  let sent = 0;
  for (const row of policies.rows) {
    const policy = toPolicy(row);
    const due = alertDue(policy, alerts.rows.filter((a) => a.policy_id === policy.id).map((a) => a.days_before), today);
    if (due === null) continue;
    /* Recorded first: the primary key refuses a second send of this threshold. */
    const { error: recordError } = await db.from("eng_insurance_alerts").insert({ policy_id: policy.id, days_before: due });
    if (recordError) continue;
    const left = daysToExpiry(policy.expiresOn, today);
    for (const person of recipients) {
      await raise({
        profileId: person.id,
        role: person.role,
        kind: "insurance.expiring",
        title: `${INSURANCE_KIND_LABEL[policy.kind]} policy ${policy.policyNumber} expires ${policy.expiresOn}`,
        body:
          `${left === 0 ? "Today is its last day" : `${left} day${left === 1 ? "" : "s"} left`}. ` +
          `Record the renewal's certificate on the insurance register before then.`,
        href: "/portal/insurance",
        entityType: "insurance_policy",
        entityId: policy.id,
      });
    }
    sent += 1;
  }

  /*
   * THE OVERRIDE'S REMINDER, TO THE OWNER, ONCE. Robert's ruling of
   * 2026-10-25, 23:49 Central: the owner gets a reminder email 14 days before
   * the override expires. The override is not a policy row, so its once is
   * recorded in eng_alert_state under a key naming the expiry, inserted before
   * anything is raised: a second sweep finds the key and sends nothing, and a
   * new expiry is a new key.
   */
  if (insuranceOverride) {
    const left = daysToExpiry(insuranceOverride.expires, today);
    if (left >= 0 && left <= OVERRIDE_REMINDER_DAYS) {
      const { error: stampError } = await db.from("eng_alert_state").insert({
        key: overrideReminderKey(insuranceOverride.expires),
        last_alerted_at: DB_NOW,
        detail: `the insurance override expiring ${insuranceOverride.expires}, ${left} day(s) left`,
        updated_at: DB_NOW,
      });
      if (!stampError) {
        for (const person of recipients.filter((p) => p.role === "admin")) {
          await raise({
            profileId: person.id,
            role: person.role,
            kind: "insurance.expiring",
            title: `The insurance override expires ${insuranceOverride.expires}`,
            body:
              `${left === 0 ? "Today is its last day" : `${left} day${left === 1 ? "" : "s"} left`}. ` +
              "When it expires the firm stops taking orders unless a policy is in force on the record.",
            href: "/portal/insurance",
            entityType: "insurance_override",
            entityId: insuranceOverride.expires,
          });
        }
        sent += 1;
      }
    }
  }
  return { ok: true, sent };
}

/** 14 days, Robert's ruling of 2026-10-25, 23:49 Central. */
export const OVERRIDE_REMINDER_DAYS = 14;

/** One key per expiry, so the reminder for one override date is sent once and a new date is reminded afresh. */
export const overrideReminderKey = (expires: string) => `insurance.override.reminder:${expires}`;
