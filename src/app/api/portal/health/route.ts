import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Can this deployment reach its database?
 *
 * WHY THIS EXISTS, AND THE INCIDENT THAT PRODUCED IT
 * --------------------------------------------------
 * On 2026-09-03 production's SUPABASE_SERVICE_ROLE_KEY was wrong. Every request
 * that touched the database failed with "Invalid API key", so nobody could sign
 * in, a valid one time password link reported itself invalid, and the failed
 * sign ins wrote no audit rows because the write that records them failed too.
 *
 * security-audit ran against that host and passed all 126 checks.
 *
 * It was not lying. Every check it makes asks whether a signed out client is
 * refused, and a deployment that cannot reach a database refuses everybody. A
 * closed portal and a broken one are indistinguishable from outside, and the
 * broken one scores better on a perimeter audit than a healthy one would,
 * because nothing can possibly leak from a system that cannot read anything.
 *
 * That is the recurring defect class in this repository written large: a check
 * that passes while looking at the wrong thing. The perimeter audit needed one
 * fact it could not get, so this route is the smallest possible way to give it
 * that fact.
 *
 * WHY IT IS UNAUTHENTICATED, DELIBERATELY
 * ---------------------------------------
 * The condition it detects breaks authentication. A health check behind a sign
 * in cannot run in exactly the situation it exists for, which is the same
 * reasoning recorded on /api/portal/unlock in the proxy.
 *
 * WHAT IT IS ALLOWED TO REVEAL, AND NOTHING MORE
 * ----------------------------------------------
 * Two response shapes and no third. It never says which project it reached, how
 * many rows are in anything, what the error was, what version is deployed, or
 * how long the query took. A caller learns one bit: whether this deployment can
 * read its own database.
 *
 * That bit is already inferable by anybody who tries to sign in, so it gives an
 * attacker nothing they could not have. The error text specifically stays here:
 * "Invalid API key" and "relation does not exist" would tell an outsider real
 * things about the deployment, and the operator can read those in the runtime
 * log where they belong.
 *
 * A HEAD SELECT, SO IT READS NOTHING
 * ----------------------------------
 * The query returns no rows and no count. Only whether the database answered.
 * It touches eng_profiles because that table exists in every environment and is
 * the one auth itself reads, so a pass here means the path that was broken is
 * the path that is now working.
 */
export async function GET() {
  const nope = NextResponse.json({ ok: false }, { status: 503 });
  nope.headers.set("Cache-Control", "no-store, max-age=0");

  let db: ReturnType<typeof supabaseAdmin>;
  try {
    /*
     * supabaseAdmin throws on a preview pointed at production, which is a
     * misconfiguration and belongs in the same bucket as an unreachable
     * database: this deployment must not be trusted to answer.
     */
    db = supabaseAdmin();
  } catch {
    return nope;
  }
  if (!db) return nope;

  const { error } = await db.from("eng_profiles").select("id", { head: true }).limit(1);
  if (error) return nope;

  const ok = NextResponse.json({ ok: true }, { status: 200 });
  ok.headers.set("Cache-Control", "no-store, max-age=0");
  return ok;
}
