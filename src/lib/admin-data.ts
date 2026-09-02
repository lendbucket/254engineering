import "server-only";
import { supabaseAdmin } from "./supabase";
import { currentActor } from "./ops-auth";
import { can } from "./ops-authz";

/**
 * Reads for the admin portal.
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
 * The screens themselves are unchanged and are deliberately still here. Leads,
 * applications, and onboarding are real work the operator does today, and Phase
 * 1 and Phase 3 absorb them into the portal properly. Deleting them now to make
 * a retirement look tidy would have taken away working capability and given
 * nothing back.
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

export type Counts = {
  site: string;
  leads: number;
  applications: number;
  onboardings: number;
};

/**
 * Counts across all three brands.
 *
 * The tables carry a `site` column precisely so one Supabase project can hold
 * all three, and the dashboard is the one place that fact is useful rather than
 * incidental. Sites are read from the data rather than from a hardcoded list, so
 * a fourth brand appears here without an edit.
 *
 * `head: true` with an exact count fetches no rows at all, which matters on the
 * page the operator opens most.
 */
export async function countsBySite(): Promise<Counts[]> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return [];
  const sites = new Set<string>();
  const tally = new Map<string, Counts>();

  const tables = [
    ["eng_leads", "leads"],
    ["eng_applications", "applications"],
    ["eng_onboardings", "onboardings"],
  ] as const;

  // One pass to learn which sites exist, because the count query is per site.
  for (const [table] of tables) {
    const { data } = await db.from(table).select("site");
    for (const row of data ?? []) if (row.site) sites.add(row.site as string);
  }

  for (const site of sites) {
    tally.set(site, { site, leads: 0, applications: 0, onboardings: 0 });
  }

  for (const [table, key] of tables) {
    for (const site of sites) {
      const { count } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("site", site);
      const row = tally.get(site);
      if (row) row[key] = count ?? 0;
    }
  }

  return [...tally.values()].sort((a, b) => a.site.localeCompare(b.site));
}

export type LeadRow = {
  id: string;
  created_at: string;
  site: string;
  form: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  service: string | null;
  message: string | null;
};

export async function listLeads(limit = 200): Promise<LeadRow[]> {
  await requireAdmin();
  const db = supabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from("eng_leads")
    .select("id, created_at, site, form, name, email, phone, city, service, message")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as LeadRow[];
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
