/**
 * THE AD CLICK, CARRIED FROM LANDING TO THE LEAD AND THE ORDER.
 *
 * Robert's add-on of 2026-11-15, item 9: capture gclid, gbraid, wbraid and the
 * utm values on landing, keep them 90 days in a first party cookie, and store
 * them on every lead and every order.
 *
 * WHY A COOKIE AND NOT THE URL. The order flow read utm values off the order
 * page's own URL, so a visitor who landed on /start and clicked through to
 * /order/start/<line> arrived with none: the parameters were on the page they
 * left. The cookie is written once, on the page the ad opened, and read by the
 * server wherever a lead or an order is written.
 *
 * WHY THE SERVER READS IT RATHER THAN THE BROWSER SENDING IT. A click ID goes
 * back to Google as a conversion. One a browser could type into a request body
 * would let anybody credit any click with a paid order, so the click columns
 * are written only from the cookie, read on the server.
 *
 * PARTNER ATTRIBUTION IS A DIFFERENT FACT WITH ITS OWN COOKIE. Nothing here
 * reads, writes or replaces the partner visitor cookie (ops-partners.ts) or the
 * attribution window (attribution-rules.ts). An order can carry a partner and
 * an ad click at once, and each is recorded as itself.
 *
 * THE LATEST AD CLICK WINS. A visit carrying any of the parameters replaces
 * what the cookie held, which is how Google itself attributes a conversion to
 * the last ad clicked. A visit carrying none leaves the cookie alone.
 *
 * Pure, so the browser component and the server share one parser. Proved by
 * scripts/proofs/an-ad-click-follows-the-lead-to-the-order.mjs.
 */

export const AD_CLICK_COOKIE = "e254_ad_click";

/** Robert's item 9: ninety days. Pinned as a literal in the proof. */
export const AD_CLICK_DAYS = 90;
export const AD_CLICK_MAX_AGE_SECONDS = AD_CLICK_DAYS * 24 * 60 * 60;

export type AdClick = {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  /** When the click landed, ISO 8601, from the browser's clock at landing. */
  clickedAt: string;
  landingPath: string | null;
};

/* A Google click identifier is base64url-like text. Anything else is not one, and is dropped rather than stored. */
const CLICK_ID = /^[A-Za-z0-9_\-]{8,512}$/;
/* A utm value is whatever the advertiser typed: printable, bounded, no control characters. */
const UTM = /^[\x20-\x7E]{1,200}$/;
const PATH = /^\/[\x21-\x7E]{0,300}$/;

const clickId = (v: string | null | undefined): string | null => (v && CLICK_ID.test(v) ? v : null);
const utm = (v: string | null | undefined): string | null => {
  const t = (v ?? "").trim();
  return t && UTM.test(t) ? t : null;
};

/** The click on a landing URL, or null when the URL carries none of the parameters. */
export function adClickFromParams(params: URLSearchParams, now: Date, landingPath: string | null): AdClick | null {
  const click: AdClick = {
    gclid: clickId(params.get("gclid")),
    gbraid: clickId(params.get("gbraid")),
    wbraid: clickId(params.get("wbraid")),
    utmSource: utm(params.get("utm_source")),
    utmMedium: utm(params.get("utm_medium")),
    utmCampaign: utm(params.get("utm_campaign")),
    utmTerm: utm(params.get("utm_term")),
    utmContent: utm(params.get("utm_content")),
    clickedAt: now.toISOString(),
    landingPath: landingPath && PATH.test(landingPath) ? landingPath : null,
  };
  const carries =
    click.gclid || click.gbraid || click.wbraid || click.utmSource || click.utmMedium || click.utmCampaign || click.utmTerm || click.utmContent;
  return carries ? click : null;
}

export function encodeAdClick(click: AdClick): string {
  return encodeURIComponent(JSON.stringify(click));
}

/** The cookie read back, every field validated again: a cookie is input like any other. */
export function decodeAdClick(raw: string | null | undefined): AdClick | null {
  if (!raw) return null;
  let parsed: Partial<Record<keyof AdClick, unknown>>;
  try {
    parsed = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const at = str(parsed.clickedAt);
  if (!at || Number.isNaN(Date.parse(at))) return null;
  const params = new URLSearchParams();
  const pairs: [string, unknown][] = [
    ["gclid", parsed.gclid], ["gbraid", parsed.gbraid], ["wbraid", parsed.wbraid],
    ["utm_source", parsed.utmSource], ["utm_medium", parsed.utmMedium], ["utm_campaign", parsed.utmCampaign],
    ["utm_term", parsed.utmTerm], ["utm_content", parsed.utmContent],
  ];
  for (const [k, v] of pairs) if (typeof v === "string") params.set(k, v);
  const click = adClickFromParams(params, new Date(at), str(parsed.landingPath));
  return click;
}

/** True when the click came from Google Ads, which is what makes it worth a conversion. */
export function isAdClick(click: AdClick | null): boolean {
  return Boolean(click && (click.gclid || click.gbraid || click.wbraid));
}

/** The columns 0137 added, as the inserts write them. */
export function adClickColumns(click: AdClick | null) {
  return {
    gclid: click?.gclid ?? null,
    gbraid: click?.gbraid ?? null,
    wbraid: click?.wbraid ?? null,
    clicked_at: click ? click.clickedAt : null,
  };
}

/** The utm columns, as the inserts write them; a utm value the request carried itself wins over the cookie's. */
export function utmColumns(click: AdClick | null, fromRequest?: Partial<Record<"utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent", string | null | undefined>>) {
  const pick = (k: "utmSource" | "utmMedium" | "utmCampaign" | "utmTerm" | "utmContent") => utm(fromRequest?.[k] ?? null) ?? click?.[k] ?? null;
  return {
    utm_source: pick("utmSource"),
    utm_medium: pick("utmMedium"),
    utm_campaign: pick("utmCampaign"),
    utm_term: pick("utmTerm"),
    utm_content: pick("utmContent"),
  };
}
