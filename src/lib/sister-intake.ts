import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "./supabase";

/**
 * The intake API the sister brands post to.
 *
 * WHY IT EXISTS
 * -------------
 * sealedengineering and stampmyplans write `eng_leads` directly, with a service
 * role key for the Supabase project this firm calls production. Three
 * deployments hold one database's master credential, and 254's portal is the
 * shared inbox that reads all three brands' rows with no site filter.
 *
 * That arrangement is what makes the database cutover a coordination problem:
 * move 254 alone and the sisters keep writing to the old project while the only
 * screen anybody opens reads the new one. No error, no gap in a sequence, and
 * it surfaces as a customer who was never called back.
 *
 * The cutover plan lists three options and this is the third, chosen by the
 * operator: the sisters POST a lead rather than writing Supabase. It removes
 * the shared table coupling permanently, and it takes a service role key out of
 * two deployments that never needed one. After it ships, a sister that is
 * pointed at nothing gets an error it can see, rather than writing rows into a
 * database nobody reads.
 *
 * THE SITE COMES FROM THE KEY, NEVER FROM THE REQUEST
 * ---------------------------------------------------
 * The same sentence the ordering API is built on, and the same reason: there is
 * no field in which a caller could ask to write as another brand, so the answer
 * is not "we check", it is "there is nothing to check". A body claiming
 * `site: "254"` changes nothing.
 *
 * KEYS ARE ENVIRONMENT VARIABLES, NOT ROWS
 * ----------------------------------------
 * There are two callers and there will not be many more. A table would buy
 * revocation without a deploy and cost a migration, an admin screen and a way
 * to be misconfigured; a variable is set once per sister in Vercel and rotating
 * one is a redeploy of one site. Same model as CRON_SECRET, and the same
 * refusal shape: an unset key is a 404, indistinguishable from a route that
 * does not exist, because a configured-but-wrong key and a missing feature
 * should not look the same to somebody probing.
 */

/** Which brand a key belongs to. The value written to `site`. */
export type SisterSite = "sealed" | "stamp";

/**
 * The variable each sister's key lives in.
 *
 * Named rather than derived from the site string, so a typo in one is a missing
 * key rather than a key that silently belongs to nobody.
 */
export const SISTER_KEY_ENV: Record<SisterSite, string> = {
  sealed: "INTAKE_KEY_SEALED",
  stamp: "INTAKE_KEY_STAMP",
};

/** How the sister identifies itself. A header, not a body field, and not a query string. */
export const SISTER_KEY_HEADER = "x-intake-key";

/**
 * How many leads one brand may send in a minute.
 *
 * Counted from the rows themselves rather than from a counter in memory, which
 * is the same reasoning migration 0010 records for the ordering API: a limit
 * enforced per function instance is the limit times however many instances are
 * warm, which is not a limit.
 *
 * Twenty is far above anything either site produces and far below a loop. It
 * exists for a retry storm or a leaked key, not for traffic.
 */
export const SISTER_RATE_PER_MINUTE = 20;

/**
 * How long an identical submission is treated as the same one.
 *
 * A sister that times out waiting for this endpoint will retry, and the write
 * may already have happened. Without this, a network hiccup produces two rows
 * and the operator rings the same person twice.
 *
 * Ten minutes, matched on the brand, the form and the address plus a hash of
 * the message. The cost of the window is that somebody who genuinely sends the
 * same enquiry twice inside ten minutes is recorded once, which is a smaller
 * harm than a duplicate and is stated here rather than discovered.
 */
export const SISTER_DEDUPE_MINUTES = 10;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Which brand this key belongs to, or null.
 *
 * Constant time, and it compares hashes rather than strings so a length
 * difference does not leak through the comparison itself. Every configured key
 * is checked even after a match, so the time taken does not say which one hit.
 */
export function siteForKey(
  provided: string,
  env: Record<string, string | undefined> = process.env,
): SisterSite | null {
  if (!provided) return null;
  const given = digest(provided);

  let found: SisterSite | null = null;
  for (const [site, variable] of Object.entries(SISTER_KEY_ENV) as [SisterSite, string][]) {
    const expected = env[variable];
    if (!expected || expected.trim().length < 24) continue;
    if (timingSafeEqual(given, digest(expected))) found = site;
  }
  return found;
}

/** Is any sister key configured at all. Nothing is configured means the route does not exist. */
export function intakeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Object.values(SISTER_KEY_ENV).some((v) => (env[v] ?? "").trim().length >= 24);
}

export type SisterLead = {
  form: "contact" | "waitlist";
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  city?: string;
  service?: string;
  message?: string;
  landingPath?: string;
  referrer?: string;
  userAgent?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

/**
 * What a submission has to carry to be a lead at all.
 *
 * Pure, so the rule can be exercised without a database. A lead with no way to
 * reach the person is not an enquiry, it is a row: the operator cannot act on
 * it and would not know it was incomplete until they tried.
 */
export function leadProblem(lead: SisterLead): string | null {
  if (lead.form !== "contact" && lead.form !== "waitlist") {
    return "form must be contact or waitlist";
  }
  const reachable = [lead.email, lead.phone].some((v) => (v ?? "").trim().length > 0);
  if (!reachable) return "a lead needs an email address or a telephone number";
  if ((lead.email ?? "").length > 0 && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email ?? "")) {
    return "that email address is not one";
  }
  const tooLong = Object.entries(lead).find(
    ([, v]) => typeof v === "string" && v.length > 4000,
  );
  if (tooLong) return `${tooLong[0]} is longer than this endpoint accepts`;
  return null;
}

/** A stable fingerprint of one submission, for the dedupe window. */
export function fingerprintOf(site: SisterSite, lead: SisterLead): string {
  return createHash("sha256")
    .update(
      [site, lead.form, (lead.email ?? "").toLowerCase(), lead.phone ?? "", lead.message ?? ""].join(
        "\0",
      ),
      "utf8",
    )
    .digest("hex")
    .slice(0, 32);
}

export type IntakeOutcome =
  | { ok: true; status: 200; duplicate: boolean; id: string | null }
  | { ok: false; status: 400 | 401 | 404 | 429 | 503; error: string };

/**
 * Take one lead from a sister brand.
 *
 * The order of the checks is the order of the answers: what the caller is
 * before what they sent, what they sent before whether it is a repeat, and the
 * repeat before the write. Each refusal says which it was, because a caller
 * that cannot tell a bad key from a bad body retries the wrong thing.
 */
export async function acceptSisterLead(
  site: SisterSite,
  lead: SisterLead,
): Promise<IntakeOutcome> {
  const problem = leadProblem(lead);
  if (problem) return { ok: false, status: 400, error: problem };

  const db = supabaseAdmin();
  if (!db) return { ok: false, status: 503, error: "The intake database is not reachable." };

  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count, error: countError } = await db
    .from("eng_leads")
    .select("id", { count: "exact", head: true })
    .eq("site", site)
    .gte("created_at", minuteAgo);

  /* A count that could not be read is not zero: read as one, the limit opened (audit of 2026-10-24). */
  if (countError || typeof count !== "number") {
    return { ok: false, status: 503, error: "The intake could not check its own rate just now. Nothing was saved; send it again." };
  }
  if (count >= SISTER_RATE_PER_MINUTE) {
    return {
      ok: false,
      status: 429,
      error: `More than ${SISTER_RATE_PER_MINUTE} submissions in a minute from this brand. Nothing was saved.`,
    };
  }

  /*
   * THE DEDUPE READ IS BY CONTENT, because the sister has no id to give us that
   * we would trust: an idempotency key chosen by the caller is a key the caller
   * can reuse across two different enquiries by accident.
   */
  const since = new Date(Date.now() - SISTER_DEDUPE_MINUTES * 60_000).toISOString();
  const { data: recent } = await db
    .from("eng_leads")
    .select("id, form, email, phone, message")
    .eq("site", site)
    .gte("created_at", since)
    .limit(50);

  const fingerprint = fingerprintOf(site, lead);
  const already = (recent ?? []).find(
    (r) =>
      fingerprintOf(site, {
        form: (r.form as SisterLead["form"]) ?? "contact",
        email: (r.email as string) ?? undefined,
        phone: (r.phone as string) ?? undefined,
        message: (r.message as string) ?? undefined,
      }) === fingerprint,
  );
  if (already) return { ok: true, status: 200, duplicate: true, id: already.id as string };

  const { data, error } = await db
    .from("eng_leads")
    .insert({
      /*
       * FROM THE KEY. The body is never consulted for this, and there is no
       * parameter that could carry it.
       */
      site,
      form: lead.form,
      name: lead.name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      company: lead.company || null,
      city: lead.city || null,
      service: lead.service || null,
      message: lead.message || null,
      landing_path: lead.landingPath || null,
      referrer: lead.referrer || null,
      user_agent: lead.userAgent || null,
      utm_source: lead.utmSource || null,
      utm_medium: lead.utmMedium || null,
      utm_campaign: lead.utmCampaign || null,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, status: 503, error: `The lead was not saved: ${error.message}` };

  return { ok: true, status: 200, duplicate: false, id: (data?.id as string) ?? null };
}
