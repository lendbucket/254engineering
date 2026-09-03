import "server-only";
import { guardError, mispointing } from "./db-guard";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The one Supabase client on this site, and it never reaches a browser.
 *
 * THE CLOSED DOOR PATTERN
 * -----------------------
 * Every eng_ table in the shared project has row level security enabled and zero
 * policies. That is not an oversight waiting to be filled in: with RLS on and no
 * policy, the anon and authenticated roles can neither read nor write the table
 * through any route, including a leaked key. The service role bypasses RLS, and
 * it is held here, server side, and nowhere else.
 *
 * The consequence to respect is that there is no browser client and there must
 * never be one. There is no NEXT_PUBLIC_SUPABASE_URL and no NEXT_PUBLIC anon key
 * anywhere in this repo, so the usual accident, a component that imports a
 * browser client "just to read something public", cannot compile.
 *
 * `import "server-only"` is what makes that a build error rather than a code
 * review. A client component that imports this module fails the build with a
 * message naming the file, which is the correct time to find out.
 *
 * WHY SUPABASE_URL RATHER THAN NEXT_PUBLIC_SUPABASE_URL
 * -----------------------------------------------------
 * Next inlines NEXT_PUBLIC_ names at BUILD time. A URL fixed at build and a key
 * read at runtime can drift apart: rebuild against one project, deploy with
 * another project's key, and every query fails authentication while nothing in
 * the repo looks wrong. Both halves of the credential are plain server variables
 * so both are read at the same moment, from the same environment.
 */

let cached: SupabaseClient | null = null;

/** True when a client can be built at all. Routes check this before writing. */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * The one place a client is built, and therefore the one place to stop a
 * preview deployment from reaching the firm's real database.
 *
 * THROWS RATHER THAN RETURNING NULL, WHICH IS THE OPPOSITE OF THE RULE BELOW
 * --------------------------------------------------------------------------
 * supabaseAdmin returns null when the environment is simply unconfigured,
 * because losing a form submission is better than showing a 500 to somebody who
 * just typed their details in.
 *
 * This case is different and the difference is the point. An unconfigured
 * deployment can do nothing. A MISpointed one can do everything, to the wrong
 * database, silently. Returning null here would let every caller treat the
 * firm's production data as "not configured" and carry on, which is exactly the
 * quiet failure the guard exists to prevent. So it is loud.
 */
function refuseIfMispointed(): void {
  const fault = mispointing();
  if (fault) throw guardError(fault);
}

/**
 * The service role client, or null when the environment is not configured.
 *
 * Returns null rather than throwing so a form route can decide what to do about
 * it. Losing a submission is bad; returning a 500 to somebody who just typed
 * their details in is worse, because they will not type them again.
 */
export function supabaseAdmin(): SupabaseClient | null {
  refuseIfMispointed();
  if (!supabaseConfigured()) return null;
  if (cached) return cached;

  cached = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "254engineering" } },
  });
  return cached;
}

/**
 * A THROWAWAY client, for verifying a password and nothing else.
 *
 * WHY THIS EXISTS, AND IT IS NOT A STYLE PREFERENCE
 * -------------------------------------------------
 * supabaseAdmin() above is a module level singleton. Calling
 * auth.signInWithPassword() on it SUCCEEDS and, as a side effect, stores that
 * user's session inside the client. Every later .from() call on the same
 * instance then travels as that user rather than as the service role, RLS
 * applies, and because every eng_ table has RLS on with zero policies, the
 * queries return nothing.
 *
 * The symptom is worse than the cause: the sign in itself works, and then the
 * profile lookup immediately after it comes back empty, so the person is told
 * their credentials are wrong. It was found by an end to end demonstration where
 * the password was set successfully and the very next sign in failed.
 *
 * So credential checks get their own client, built per call and dropped
 * afterwards. It is never used for a table read. The one shared client never
 * signs anybody in and therefore never stops being the service role.
 */
export function supabaseCredentialCheck(): SupabaseClient | null {
  refuseIfMispointed();
  if (!supabaseConfigured()) return null;
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "254engineering-auth" } },
  });
}

/**
 * The value written to the `site` column on every row this site inserts.
 *
 * The eng_ tables are shared across the brand family, so this is what separates
 * this firm's rows from the sister sites'. It is a constant rather than an
 * environment variable on purpose: a deployment that could be misconfigured into
 * writing another brand's rows is a deployment that eventually will be.
 */
export const SITE_KEY = "254";
