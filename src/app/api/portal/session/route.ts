import { NextResponse, type NextRequest } from "next/server";
import { DB_NOW } from "@/lib/db-now";
import { verifyCredentials, requestContext } from "@/lib/ops-auth";
import { issueOpsSession, opsCookieOptions, OPS_COOKIE, opsSessionConfigured } from "@/lib/ops-session";
import { mfaRequirementFor, mfaStateFor } from "@/lib/ops-mfa";
import { takeLoginAttempt, clearLoginAttempts, clientKey } from "@/lib/ops-rate-limit";
import { writeAudit } from "@/lib/ops-audit";
import { homeFor } from "@/lib/ops-authz";
import { supabaseAdmin } from "@/lib/supabase";

/**
 * Sign in and sign out.
 *
 * TWO CONTENT TYPES, ONE ENDPOINT
 * -------------------------------
 * The form posts JSON once React has hydrated and form encoded before it has.
 * Both are accepted here, and the form encoded path answers with a redirect
 * rather than JSON because the browser is following a form submission and has
 * nowhere to put a JSON body.
 *
 * Getting this wrong is how the admin login leaked a passphrase into a URL. See
 * the note in the login form.
 *
 * WHAT A FAILURE SAYS
 * -------------------
 * "Check the email and password" for a wrong password AND for an unknown email.
 * Distinguishing them turns this endpoint into an account enumerator, and the
 * staff of this firm are named on a public careers page.
 *
 * A suspended account is told it is suspended, and only after the password has
 * been verified, so the message is not available to somebody guessing.
 */

export const dynamic = "force-dynamic";

const GENERIC = "Check the email and password.";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  const isForm = contentType.includes("application/x-www-form-urlencoded");

  let email = "";
  let password = "";
  let next = "";

  if (isForm) {
    const form = await request.formData();
    email = String(form.get("email") ?? "");
    password = String(form.get("password") ?? "");
    next = String(form.get("next") ?? "");
  } else {
    const body = (await request.json().catch(() => null)) as
      | { email?: string; password?: string; next?: string }
      | null;
    email = String(body?.email ?? "");
    password = String(body?.password ?? "");
    next = String(body?.next ?? "");
  }

  const fail = (status: number, error: string, code?: string) =>
    isForm
      ? NextResponse.redirect(
          new URL(`/portal/login${code ? `?${code}=1` : "?error=1"}`, request.url),
          { status: 303 },
        )
      : NextResponse.json({ ok: false, error }, { status });

  const attempted = email.trim().toLowerCase();

  /*
   * RATE LIMIT HERE: after the body is read, before anything is verified.
   *
   * After, because the email is half the key. Counting by address alone is what
   * locked the operator out of his own portal with a handful of typos, and a
   * control that stops the owner working is one that gets switched off. Keyed by
   * address AND account, a typo costs eight attempts against that one account
   * rather than against everything.
   *
   * Before verification, because a limiter that runs after the password check
   * has not limited anything.
   *
   * And before the configuration check, because that short circuit used to come
   * first and meant an unconfigured deployment answered every attempt forever
   * without counting one. security-audit caught that against production.
   */
  const limit = takeLoginAttempt(clientKey(request.headers), attempted || undefined);
  if (!limit.allowed) {
    const res = isForm
      ? NextResponse.redirect(new URL("/portal/login?throttled=1", request.url), { status: 303 })
      : NextResponse.json(
          {
            ok: false,
            error: "Too many attempts. Wait a few minutes and try again.",
            retryAfterSeconds: limit.retryAfterSeconds,
          },
          { status: 429 },
        );
    res.headers.set("Retry-After", String(limit.retryAfterSeconds));
    return res;
  }

  if (!opsSessionConfigured()) {
    return NextResponse.json(
      { ok: false, error: "The portal is not configured on this deployment." },
      { status: 503 },
    );
  }

  if (!email || !password) return fail(400, GENERIC);

  const result = await verifyCredentials(attempted, password);

  if (!result.ok) {
    const { ip, userAgent } = await requestContext();
    await writeAudit({
      actor: null,
      action: "auth.sign_in_failed",
      entityType: "session",
      entityId: email.trim().toLowerCase(),
      summary: `Failed sign in (${result.reason})`,
      ip,
      userAgent,
    });

    if (result.reason === "suspended") {
      return isForm
        ? NextResponse.redirect(new URL("/portal/login?suspended=1", request.url), { status: 303 })
        : NextResponse.json({ ok: false, error: "That account is suspended." }, { status: 403 });
    }
    if (result.reason === "unconfigured") return fail(503, "The portal is not configured.");
    return fail(401, GENERIC);
  }

  clearLoginAttempts(clientKey(request.headers), attempted);

  /*
   * THE SECOND FACTOR DECIDES WHICH KIND OF SESSION THIS IS.
   *
   * Phase 12 Section 1, amended by the operator on 2026-09-07 when the default
   * became an offer rather than a demand. Four outcomes now:
   *
   *   enrolled                  a PENDING session, and the challenge screen
   *   required but not enrolled a PENDING session, and the enrolment screen
   *   optional and not enrolled a FULL session, and the enrolment screen with
   *                             a way to decline
   *   off, or already handled   a full session, straight to their own home
   *
   * A person whose role requires a factor they have not set up is not refused,
   * because refusing them would mean an operator turning on the requirement
   * locks out everybody who has not enrolled yet. They get a pending session
   * that can reach enrolment and nothing else, which is the same boundary the
   * challenge uses and inherits the same enforcement.
   *
   * WHY THE OPTIONAL OFFER GETS A FULL SESSION AND NOT A PENDING ONE
   * ----------------------------------------------------------------
   * The obvious build is to hand everybody without a factor a pending session,
   * land them on enrolment, and put a "Not now" button there. That button then
   * needs an endpoint whose entire job is promoting a half authenticated cookie
   * to a full one, and that endpoint is the single most attractive thing in
   * this flow to attack: get it to skip its own checks and the requirement is
   * gone for everybody, including the roles that still have one.
   *
   * There is nothing to withhold from somebody whose role does not require a
   * factor, so nothing is withheld. They are issued the session they are
   * entitled to and merely SENT somewhere first. Declining is then a link, not
   * a privilege change, and no code exists that can turn a pending cookie into
   * a full one. Operator ruling, 2026-09-07.
   *
   * ENROLLED IS CHECKED BEFORE THE REQUIREMENT, AND THE ORDER IS LOAD BEARING.
   * Somebody who HAS a factor is challenged for it whatever their role now
   * says. If the requirement were consulted first, moving a role to optional
   * would silently stop challenging people who are already enrolled, which
   * would make editing a role a way to switch off somebody else's second
   * factor.
   *
   * mfaStateFor THROWS on a failed read rather than reporting "not enrolled",
   * and that is deliberate: a database blip must not become a way past the
   * requirement. A 503 here is correct and is the closed door.
   */
  let factor: "pending" | "full" = "full";
  let mfaNext: string | null = null;
  let mfaOffer: string | null = null;
  try {
    const requirement = await mfaRequirementFor(result.profile.role);
    const state = await mfaStateFor(result.profile.id);

    if (state.enrolled) {
      factor = "pending";
      mfaNext = "/portal/mfa";
    } else if (requirement === "required") {
      factor = "pending";
      mfaNext = "/portal/mfa/enrol";
    } else if (requirement === "optional") {
      /*
       * A full session, and the offer. Kept separate from mfaNext because an
       * offer must not override a destination the person actually asked for;
       * see where safeNext is worked out.
       */
      mfaOffer = "/portal/mfa/enrol";
    }
  } catch (err) {
    console.error("[session] the second factor state could not be read:", err);
    return fail(503, "Your account could not be checked just now. Try again in a moment.");
  }

  const session = issueOpsSession(result.profile.id, result.profile.role, factor);
  if (!session) return fail(503, "The portal is not configured.");

  const db = supabaseAdmin();
  await db
    ?.from("eng_profiles")
    .update({ last_sign_in_at: DB_NOW })
    .eq("id", result.profile.id);

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: { id: result.profile.id, role: result.profile.role, email: result.profile.email },
    action: "auth.sign_in",
    entityType: "session",
    entityId: result.profile.id,
    summary: `${result.profile.display_name} signed in`,
    ip,
    userAgent,
  });

  /*
   * A pending session goes to the second factor and nowhere else, whatever the
   * caller asked for in `next`. Honouring a next that pointed at a portal
   * screen would send somebody to a page their own cookie cannot open, which
   * reads as the sign in having silently failed.
   *
   * The optional OFFER is weaker than that on purpose, and sits where the
   * default landing would be rather than in front of `next`. Somebody who
   * followed a link into a specific screen and signed in to reach it is going
   * there; interrupting that with an offer they can decline anyway would trade
   * a working deep link for a prompt. They get the offer the next time they
   * sign in without one, which is most times.
   */
  const asked = next.startsWith("/portal") && !next.startsWith("//") ? next : null;
  const safeNext = mfaNext ?? asked ?? mfaOffer ?? homeFor(result.profile.role);

  const res = isForm
    ? NextResponse.redirect(new URL(safeNext, request.url), { status: 303 })
    : NextResponse.json({ ok: true, redirect: safeNext });

  res.cookies.set(OPS_COOKIE, session.value, opsCookieOptions(session.expiresAt));
  return res;
}

/** Sign out. Clears the cookie whether or not one was valid. */
export async function DELETE(request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OPS_COOKIE, "", opsCookieOptions());

  const { ip, userAgent } = await requestContext();
  await writeAudit({
    actor: null,
    action: "auth.sign_out",
    entityType: "session",
    summary: "Signed out",
    ip,
    userAgent,
  });
  void request;
  return res;
}
