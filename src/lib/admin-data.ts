import "server-only";
import { supabaseAdmin } from "./supabase";
import { currentActor } from "./ops-auth";
import { can } from "./ops-authz";

/**
 * Applications, read by the portal.
 *
 * EVERY FUNCTION HERE CHECKS THE SESSION ITSELF
 * ---------------------------------------------
 * The middleware already keeps an unauthenticated request off these pages. This
 * is the second lock, and the note in src/middleware.ts explains why it is not
 * redundant: a matcher is a pattern, and a pattern can be wrong in a way no test
 * notices. `requireAdmin` throwing is the behaviour that holds if it ever is.
 *
 * It throws rather than returning empty, because an empty table and a table
 * nobody was allowed to read look identical on screen, and only one of them is a
 * security failure.
 *
 * THE SHARED PASSPHRASE IS GONE
 * -----------------------------
 * These screens used to sit behind one passphrase held in the environment, with
 * no user, no role, and no way to tell two people apart in a log. They now sit
 * behind the same Supabase backed accounts as the rest of the platform and
 * require the admin role specifically.
 *
 * AND NOW THE SCREENS ARE GONE. Operator ruling, 2026-09-06. /admin was deleted
 * once the portal covered all three surfaces, which it did not until the same
 * commit ported applications across.
 *
 * What is left in this file is what that screen needs. countsBySite and
 * listLeads went with the dashboard and the leads table that were their only
 * callers: the portal's clients screen reads eng_leads itself, with the
 * conversion inbox built around it.
 *
 * The file keeps its name because renaming it would be churn in a diff that is
 * already a deletion, and because "admin" is still what these rows are for.
 *
 * READS ARE SERVICE ROLE, WHICH IS WHY THEY LIVE BEHIND server-only
 * -----------------------------------------------------------------
 * eng_leads, eng_applications, and both onboarding tables have RLS enabled with
 * zero policies: the closed door pattern. Nothing reads them except the service
 * role, and the service role key must never reach a browser. `import
 * "server-only"` makes an accidental client import a build error rather than a
 * runtime disclosure.
 */

export async function requireAdmin(): Promise<void> {
  const actor = await currentActor();
  if (!can(actor, "profiles.list")) {
    throw new Error("Not signed in.");
  }
}

export type ApplicationRow = {
  id: string;
  created_at: string;
  site: string;
  role: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  payload: Record<string, unknown> | null;
};

export async function listApplications(limit = 200): Promise<ApplicationRow[]> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_applications")
    .select("id, created_at, site, role, name, email, phone, city, payload")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as ApplicationRow[];
}

export async function getApplication(id: string): Promise<ApplicationRow | null> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("eng_applications")
    .select("id, created_at, site, role, name, email, phone, city, payload")
    .eq("id", id)
    .maybeSingle();
  return (data as ApplicationRow) ?? null;
}
