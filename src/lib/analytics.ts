/**
 * GOOGLE ANALYTICS 4 ON PUBLIC PAGES. Robert's ruling, 2026-11-01 (item m).
 *
 * WHY IT HAD NEVER LOADED. `NEXT_PUBLIC_GA_MEASUREMENT_ID` was set in Vercel and
 * nothing in this repository had ever read it: no source file named it, and no
 * commit on any branch ever added or removed it. Next.js inlines a NEXT_PUBLIC_
 * value only where code references it, so the value reached no page. Reported
 * on issue #1, comment 6563216436.
 *
 * WHAT THE RULING ALLOWS, AND THE ONE PLACE EACH PART IS DECIDED:
 *
 *   - public pages only, never /portal, /admin, /partner or /account
 *     (GA_EXCLUDED_PREFIXES, and the component lives in the (site) and (order)
 *     layouts rather than the root one, so the prefix list is a second fence);
 *   - page views, and two events, order started and order paid (GA_EVENTS);
 *   - loaded after the page is idle (next/script lazyOnload, in Analytics.tsx).
 *
 * WHAT IS NEVER SENT. A status page opened with its signed `?token=` link loads
 * no analytics at all, because that token is the credential to the order. Every
 * address sent is cleaned first: the query string is dropped except campaign
 * tags, and order references in the path are replaced. Google signals and ad
 * personalization are off. No price, name, email or address is ever a parameter.
 *
 * WHERE IT SENDS FROM. Only the production host, which the server layouts read
 * off `business.url` and hand to the component, so the business config never
 * enters the browser bundle. The board's build loads the script, so its cost is
 * in perf-audit's figures, and sends nothing from localhost.
 */

/*
 * /onboarding joined on 2026-11-01, before GA4 merged. The onboarding invite
 * carries its credential IN THE PATH (/onboarding/<token>), not in a query
 * string, so the ?token= rule below never saw it and cleaning would have sent
 * the token to Google as a page path. It is a signed link to somebody's
 * identity paperwork, so it loads no analytics at all, which is stricter than
 * the ruling's four prefixes and keeps the privacy page's "signed links" true.
 * The proof walks every public route with a [token] segment and requires it
 * excluded, so the next one is caught rather than remembered.
 */
export const GA_EXCLUDED_PREFIXES = ["/portal", "/admin", "/partner", "/account", "/onboarding"] as const;

/*
 * THE CONVERSIONS, Robert 2026-11-13, before Google Ads starts: "fire one
 * conversion event when an order is paid and one when the phone link is
 * tapped, each once per action, never on a reload. Name them order_paid and
 * phone_tap." order_started stays as it was, and is not a conversion.
 */
export const GA_EVENTS = { orderStarted: "order_started", orderPaid: "order_paid", phoneTap: "phone_tap" } as const;

/**
 * The key a once-per-order event is remembered under in this browser. The
 * order's own reference never leaves the browser: it is the storage key, and
 * nothing in the event carries it (the privacy page's promise that the address
 * sent leaves out order references).
 */
export function onceKey(event: string, of: string): string {
  return `ga-sent:${event}:${of}`;
}
export type GaEvent = (typeof GA_EVENTS)[keyof typeof GA_EVENTS];

/** Campaign tags survive cleaning, because attribution reads them off the address. */
const KEPT_QUERY = /^(utm_[a-z]+|gclid)$/;

/** Order paths whose last segment identifies one order or one partner. */
const REDACTED_PATHS: ReadonlyArray<[RegExp, string]> = [
  [/^\/order\/quote\/[^/]+$/, "/order/quote/[reference]"],
  [/^\/order\/referred\/[^/]+$/, "/order/referred/[code]"],
  [/^\/order\/(?!start$|start\/|quote$|quote\/|referred$|referred\/)[^/]+$/, "/order/[reference]"],
];

export function gaMeasurementId(): string | null {
  const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  return id && /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

/** Whether analytics may load at all on this address. */
export function analyticsAllowedOn(pathname: string, search: string): boolean {
  const excluded = GA_EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (excluded) return false;
  return !new URLSearchParams(search).has("token");
}

/** The address as it is sent: references replaced, query reduced to campaign tags. */
export function cleanedLocation(origin: string, pathname: string, search: string): string {
  let path = pathname;
  for (const [pattern, replacement] of REDACTED_PATHS) {
    if (pattern.test(path)) {
      path = replacement;
      break;
    }
  }
  const kept = new URLSearchParams();
  for (const [k, v] of new URLSearchParams(search)) if (KEPT_QUERY.test(k)) kept.append(k, v);
  const query = kept.toString();
  return `${origin}${path}${query ? `?${query}` : ""}`;
}

/** Only the canonical production host sends. */
export function sendsFrom(host: string, canonicalHost: string): boolean {
  return host === canonicalHost;
}
