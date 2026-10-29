import "server-only";
import { supabaseAdmin } from "./supabase";
import { currentActor } from "./ops-auth";
import { can } from "./ops-authz";
import { cleanSearchTerm } from "./search-rules";
import { readEvery } from "./bounded-read";

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

/** One page of applications. */
export const APPLICATION_PAGE_SIZE = 100;

/*
 * OFFICE READY, 2026-10-24, AND A FAILED READ IS SAID. This was
 * listApplications(limit = 200), which returned `data ?? []`, so a read that
 * failed showed "No applications" and the 201st applicant was never shown. Now
 * one page, searched by name, email or city and filtered by position in the
 * database, with whether more follow, and an error is returned as one.
 */
export async function listApplicationsPage(
  options: { q?: string; role?: string; page?: number } = {},
): Promise<{ ok: true; rows: ApplicationRow[]; more: boolean } | { ok: false; error: string }> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const from = (page - 1) * APPLICATION_PAGE_SIZE;
  const { data, error } = await applicationsMatching(db, options).range(from, from + APPLICATION_PAGE_SIZE);
  if (error) {
    console.error(`[applications] the applications could not be read: ${error.message}`);
    return { ok: false, error: error.message };
  }
  const all = (data ?? []) as ApplicationRow[];
  return { ok: true, rows: all.slice(0, APPLICATION_PAGE_SIZE), more: all.length > APPLICATION_PAGE_SIZE };
}

/**
 * The search and the position filter, and the order, that the screen pages
 * through. One home, so the page and the CSV export cannot disagree about
 * which applications match.
 */
function applicationsMatching(db: NonNullable<ReturnType<typeof supabaseAdmin>>, options: { q?: string; role?: string }) {
  let read = db.from("eng_applications").select("id, created_at, site, role, name, email, phone, city, payload");
  const term = cleanSearchTerm(options.q ?? "");
  if (term) read = read.or(`name.ilike.%${term}%,email.ilike.%${term}%,city.ilike.%${term}%`);
  if (options.role === "professional_engineer" || options.role === "field_technician") read = read.eq("role", options.role);
  return read.order("created_at", { ascending: false }).order("id", { ascending: true });
}

/**
 * EVERY APPLICATION THE SCREEN'S QUERY MATCHES, for the CSV export (office
 * ready, Robert, 2026-10-28). Read in full through readEvery, which refuses
 * rather than returning a capped list as the set.
 */
export async function listEveryApplication(
  options: { q?: string; role?: string } = {},
): Promise<{ ok: true; rows: ApplicationRow[] } | { ok: false; error: string }> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  const read = await readEvery<ApplicationRow>((from, to) => applicationsMatching(db, options).range(from, to));
  if (!read.ok) {
    console.error(`[applications] every application could not be read: ${read.error}`);
    return { ok: false, error: read.error };
  }
  return { ok: true, rows: read.rows };
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
