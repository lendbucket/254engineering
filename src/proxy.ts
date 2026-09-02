import { NextResponse, type NextRequest } from "next/server";
import { OPS_COOKIE, readOpsSession } from "@/lib/ops-session";

/**
 * The portal gate.
 *
 * WHY THIS IS proxy.ts AND NOT middleware.ts
 * ------------------------------------------
 * The middleware convention is deprecated in Next 16 and renamed to proxy, and
 * the rename is not cosmetic here: middleware ran on the edge runtime, which has
 * no node:crypto, and this gate verifies an HMAC. Written as middleware.ts it
 * built cleanly and then returned 500 on every admin route, because the failure
 * is at module evaluation in a runtime the build does not exercise.
 *
 * Proxy defaults to the Node.js runtime, so node:crypto resolves and the same
 * signing code serves the gate and the routes. The runtime config option is not
 * available in a proxy file and setting it throws, which is why there is none.
 *
 * WHY THE CHECK IS HERE AND ALSO IN EVERY ROUTE
 * ---------------------------------------------
 * A matcher is a pattern, and a pattern is one typo away from leaving a route
 * uncovered while every test that goes through the matcher still passes. So this
 * is a gate, not the lock. The portal layout re-checks for every page beneath
 * it, and every route handler calls can() before it reads or writes.
 *
 * Defence in depth stated plainly, because a future session reading only this
 * file would reasonably conclude the other checks are redundant and remove them.
 * They are not redundant. They are the ones that hold if this matcher is wrong.
 *
 * THE COOKIE IS CHECKED HERE, THE ROLE IS NOT TRUSTED HERE
 * --------------------------------------------------------
 * This verifies a signature and an expiry, which is all that can be done without
 * a database. Whether the person is suspended, and what role they actually hold
 * today, is decided by currentActor against the profiles table on every request
 * beneath this. A gate that made authorization decisions from a twelve hour
 * cookie would make suspension advisory.
 *
 * THE SHARED PASSPHRASE IS GONE, THE SCREENS BEHIND IT ARE NOT
 * ------------------------------------------------------------
 * /admin used to be gated by one passphrase in the environment. That is retired:
 * src/lib/admin-auth.ts and admin-session.ts are deleted, and the login, logout,
 * and session endpoints with them, so there is no second way in left to
 * re-enable by accident.
 *
 * The leads, applications, and onboarding screens still answer under /admin and
 * are now gated by the same session as the portal, admin role only. They are
 * real work the operator does today and Phase 1 and Phase 3 absorb them into
 * the portal properly. Removing them now to make the retirement look complete
 * would have deleted capability and replaced it with nothing.
 */

const OPEN_PATHS = new Set([
  "/portal/login",
  "/portal/set-password",
  "/api/portal/session",
  "/api/portal/set-password",
  /*
   * The break glass has to be open, and that is the whole point of it.
   *
   * It exists for somebody the rate limiter has locked out, who therefore cannot
   * sign in. Gated behind the session it would be blocked by exactly the
   * condition it is meant to clear, which is what happened the first time this
   * shipped: the endpoint answered 401 from this proxy and never ran.
   *
   * It is not unprotected. It requires OPS_UNLOCK_TOKEN and answers 404 without
   * it, so being reachable and being open are not the same thing here.
   */
  "/api/portal/unlock",
]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * The retired sign in surface. These no longer exist as files; the redirect is
   * here so a bookmark lands on the real sign in rather than a 404 that looks
   * like an outage.
   */
  if (pathname === "/admin/login" || pathname === "/api/admin/session" || pathname === "/admin/logout") {
    const url = request.nextUrl.clone();
    url.pathname = "/portal/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (OPEN_PATHS.has(pathname)) return NextResponse.next();

  const claims = readOpsSession(request.cookies.get(OPS_COOKIE)?.value);
  if (claims) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    // JSON, never a redirect. A fetch that follows a redirect to an HTML sign in
    // page produces a parse error at the call site rather than an honest "you
    // are not signed in", and the caller cannot tell those apart.
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/portal/login";
  // Where they were going, so sign in can send them back. Only ever a path on
  // this site: `next` is validated again at the login screen, and an open
  // redirect out of a sign in is a phishing primitive.
  url.search = pathname.startsWith("/portal") ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  /*
   * Every portal surface, page and API, plus the retired admin prefixes so they
   * cannot answer.
   *
   * Written as explicit prefixes rather than one clever pattern. The failure
   * mode of a clever matcher is a route that quietly is not covered, and that
   * failure is silent.
   */
  matcher: ["/portal/:path*", "/api/portal/:path*", "/admin/:path*", "/api/admin/:path*"],
};
