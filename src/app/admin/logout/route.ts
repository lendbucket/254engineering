import { NextResponse } from "next/server";
import { ADMIN_COOKIE, sessionCookieOptions } from "@/lib/admin-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sign out, as a form POST rather than a fetch.
 *
 * The shell's sign out is a plain form, so it works with no JavaScript and needs
 * no client component. POST rather than GET because a GET that destroys a
 * session can be triggered by any image tag pointed at it.
 */
export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/admin/login", request.url), { status: 303 });
  res.cookies.set(ADMIN_COOKIE, "", sessionCookieOptions(0));
  return res;
}
