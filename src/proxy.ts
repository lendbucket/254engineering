import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, readSession } from "@/lib/admin-session";

/**
 * The admin gate.
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
 * Middleware is the right place to keep an unauthenticated request from ever
 * reaching an admin page, and it is the wrong place to be the only check. A
 * matcher is a pattern, and a pattern is one typo away from leaving a route
 * uncovered while every test that goes through the matcher still passes. So this
 * is a gate, not the lock: each admin route and API handler verifies the session
 * again for itself.
 *
 * Defence in depth stated plainly, because a future session reading only this
 * file would reasonably conclude the route checks are redundant and remove them.
 * They are not redundant. They are the ones that hold if this file's matcher is
 * ever wrong.
 *
 * WHAT AN UNAUTHENTICATED REQUEST GETS
 * ------------------------------------
 * A page request redirects to the login screen. An API request gets 401 JSON and
 * never a redirect: a fetch that follows a redirect to an HTML login page
 * produces a parse error at the call site rather than an honest "you are not
 * signed in", and the client cannot tell those apart.
 *
 * The login page and the session endpoint are the only admin paths open, because
 * they are how a session is obtained in the first place.
 */

const OPEN_PATHS = new Set(["/admin/login", "/api/admin/session"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (OPEN_PATHS.has(pathname)) return NextResponse.next();

  const authed = readSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  // Where they were going, so the login can send them back. Only ever a path on
  // this site: `next` is validated at the login screen before it is used, and an
  // open redirect out of an admin login is a phishing primitive.
  url.search = pathname.startsWith("/admin") ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  /*
   * Every admin surface, page and API.
   *
   * Written as two explicit prefixes rather than one clever pattern. The
   * failure mode of a clever matcher is a route that quietly is not covered,
   * and that failure is silent.
   */
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
