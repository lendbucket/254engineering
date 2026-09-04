import { NextResponse, type NextRequest } from "next/server";
import { VISITOR_COOKIE, VISITOR_TTL_DAYS, newVisitorKey, recordTouch } from "@/lib/ops-partners";
import { looksLikeCode } from "@/lib/attribution-rules";

/**
 * The capture endpoint for a tracked partner link.
 *
 * WHY THIS IS NOT UNDER /api/partner
 * ----------------------------------
 * Everything under /api/partner requires a partner session. This is called by a
 * member of the public who has just followed a link and has no session at all.
 * Putting it there would have meant adding it to PARTNER_OPEN_PATHS, which is
 * the list of holes in the partner perimeter, to hold something that is not a
 * partner surface. The list stays two entries long and this lives outside it.
 *
 * WHY A ROUTE AND NOT THE PROXY
 * -----------------------------
 * The touch has to be written to the database. Doing that in the proxy would
 * put a database round trip in front of every request to the public site, to
 * serve the small fraction that carry a ref. Here it costs one request, made by
 * the page that already knows it has a ref parameter.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * A landing path is recorded as evidence, not reflected anywhere, but it is
 * bounded and stripped of a query string all the same. Attribution reports are
 * read by the operator, and a value written by a stranger is a value that ends
 * up on somebody's screen.
 */
function cleanPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const path = raw.split("?")[0].split("#")[0].trim();
  if (!path.startsWith("/") || path.length > 300) return null;
  return path;
}

function cleanReferrer(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.origin}${url.pathname}`.slice(0, 300);
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = (body ?? {}) as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code : "";

  /*
   * ALWAYS 204, WHATEVER HAPPENED.
   *
   * The response says nothing about whether the code matched a partner. It is
   * called from a public page by anybody, and an endpoint that answered
   * differently for a real code would be a free tool for enumerating the firm's
   * partner list, which is commercially sensitive and not the visitor's
   * business. The operator sees the truth in the touch log.
   */
  const done = () => new NextResponse(null, { status: 204 });

  if (!looksLikeCode(code)) return done();

  /*
   * The visitor key is reused if one is already set, which is what makes a
   * second click from the same browser a second touch on the SAME visitor
   * rather than a new one. Minting a fresh key per click would make every
   * attribution single touch and rule 2 would never do anything.
   */
  const existing = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorKey = existing && existing.length >= 16 && existing.length <= 64 ? existing : newVisitorKey();

  await recordTouch({
    code,
    kind: "link",
    visitorKey,
    landingPath: cleanPath(input.landingPath),
    referrer: cleanReferrer(input.referrer),
  });

  const response = done();
  response.cookies.set(VISITOR_COOKIE, visitorKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_TTL_DAYS * 24 * 60 * 60,
  });
  return response;
}
