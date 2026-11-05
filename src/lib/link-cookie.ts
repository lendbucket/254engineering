import { createHash } from "node:crypto";

/**
 * A TOKENED LINK IS EXCHANGED FOR A SHORT LIVED httpOnly COOKIE ON FIRST VISIT,
 * AND THE ADDRESS IS REDIRECTED WITHOUT IT.
 *
 * Robert's answer L6, 2026-11-05 (issue #1, auth low findings 6594441148):
 * "swap the token for a short lived httpOnly cookie on first visit and redirect
 * without it."
 *
 * The order status link, the quote link, the three set password links and the
 * onboarding invite carried their token in the address, so it reached request
 * logs, browser history and the Referer header of anything the page loaded or
 * linked to. The emailed links are unchanged. What changes is what happens when
 * one is opened:
 *
 *   1. The proxy sees the token, sets it in an httpOnly, Secure, SameSite=Lax
 *      cookie named for that one page, and answers 307 to the same address
 *      with the token taken out (and no-store, no-referrer on the redirect).
 *   2. Every later request for that page without a token, while the cookie
 *      lives, is REWRITTEN inside the server to carry it again, so the page
 *      code is unchanged and the browser's address never holds it.
 *
 * A rewrite refreshes the cookie, so somebody working on the page keeps it; a
 * page left alone for an hour needs the emailed link again.
 *
 * The cookie is named per PAGE, from a hash of the path, so the link for one
 * order can never open another: a second order's cookie has a different name.
 * The onboarding invite carries its token in the PATH, so it is exchanged to
 * `/onboarding/invite` and one invite cookie serves the invite and its
 * training page.
 *
 * This module is pure (no Next imports) so a proof can call it directly; the
 * proxy turns its plan into a response.
 */

export const LINK_COOKIE_MAX_AGE_SECONDS = 60 * 60;

/** Longer than any token this platform issues; anything longer is not exchanged. */
const MAX_TOKEN_LENGTH = 512;

const ORDER_PAGE = /^\/order\/(?!referred$|quote$|start$)[A-Za-z0-9-]+$/;
const QUOTE_PAGE = /^\/order\/quote\/[A-Za-z0-9-]+$/;
const SET_PASSWORD_PAGES = new Set(["/portal/set-password", "/account/set-password", "/partner/set-password"]);
const ONBOARDING_PAGE = /^\/onboarding\/([^/]+)(\/training)?$/;
const ONBOARDING_ALIAS = "invite";
const ORDER_DOCUMENT_ROUTE = "/api/order-document";
const REFERENCE = /^[A-Za-z0-9-]+$/;

/** The cookie that holds the token for one page. `__Host-` pins it to this host, Secure and path "/". */
export function linkCookieName(page: string): string {
  return `__Host-254-link-${createHash("sha256").update(page).digest("hex").slice(0, 20)}`;
}

/** The page whose cookie opens it, or null when the path carries no tokened link. */
export function tokenedPage(pathname: string): string | null {
  if (ORDER_PAGE.test(pathname) || QUOTE_PAGE.test(pathname) || SET_PASSWORD_PAGES.has(pathname)) return pathname;
  if (ONBOARDING_PAGE.test(pathname)) return "/onboarding";
  return null;
}

/** True for every path the proxy has to look at for a link, so the matcher and this agree. */
export function isLinkPath(pathname: string): boolean {
  return pathname === ORDER_DOCUMENT_ROUTE || tokenedPage(pathname) !== null;
}

export type LinkPlan =
  | { kind: "exchange"; cookie: string; token: string; location: string }
  | { kind: "rewrite"; cookie: string; token: string; pathname: string; search: string }
  | { kind: "none" };

function searchWithout(params: URLSearchParams, drop: string): string {
  const kept = new URLSearchParams(params);
  kept.delete(drop);
  const s = kept.toString();
  return s ? `?${s}` : "";
}

function searchWith(params: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(params);
  next.set(key, value);
  return `?${next.toString()}`;
}

function usable(token: string | null | undefined): token is string {
  return typeof token === "string" && token.length > 0 && token.length <= MAX_TOKEN_LENGTH;
}

/**
 * What the proxy does with one request. `cookieOf` reads a cookie by name.
 */
export function planLinkRequest(
  pathname: string,
  params: URLSearchParams,
  cookieOf: (name: string) => string | undefined,
): LinkPlan {
  /* The onboarding invite: the token is the path segment. */
  const onboarding = ONBOARDING_PAGE.exec(pathname);
  if (onboarding) {
    const [, segment, rest = ""] = onboarding;
    const cookie = linkCookieName("/onboarding");
    if (segment !== ONBOARDING_ALIAS) {
      let token: string;
      try {
        token = decodeURIComponent(segment);
      } catch {
        return { kind: "none" };
      }
      if (!usable(token)) return { kind: "none" };
      return { kind: "exchange", cookie, token, location: `/onboarding/${ONBOARDING_ALIAS}${rest}${searchWithout(params, "")}` };
    }
    const held = cookieOf(cookie);
    if (!usable(held)) return { kind: "none" };
    return { kind: "rewrite", cookie, token: held, pathname: `/onboarding/${encodeURIComponent(held)}${rest}`, search: searchWithout(params, "") };
  }

  /* The letter download the order page links to: it names the order, never the token. */
  if (pathname === ORDER_DOCUMENT_ROUTE) {
    if (params.has("token")) return { kind: "none" };
    const reference = params.get("reference") ?? "";
    if (!REFERENCE.test(reference)) return { kind: "none" };
    const cookie = linkCookieName(`/order/${reference}`);
    const held = cookieOf(cookie);
    if (!usable(held)) return { kind: "none" };
    return { kind: "rewrite", cookie, token: held, pathname, search: searchWith(params, "token", held) };
  }

  const page = tokenedPage(pathname);
  if (!page) return { kind: "none" };
  const cookie = linkCookieName(page);
  const given = params.get("token");
  if (given !== null) {
    if (!usable(given)) return { kind: "none" };
    return { kind: "exchange", cookie, token: given, location: `${pathname}${searchWithout(params, "token")}` };
  }
  const held = cookieOf(cookie);
  if (!usable(held)) return { kind: "none" };
  return { kind: "rewrite", cookie, token: held, pathname, search: searchWith(params, "token", held) };
}

/** The cookie's attributes, one place, read by the proxy and asserted by the proof. */
export const LINK_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  maxAge: LINK_COOKIE_MAX_AGE_SECONDS,
} as const;
