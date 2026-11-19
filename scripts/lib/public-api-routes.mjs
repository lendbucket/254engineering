/**
 * EVERY PUBLIC API ROUTE, AND WHY IT MAY BE CALLED WITHOUT A SESSION.
 *
 * Robert's answer 6 to the evening report of 2026-11-18 (6992466384), on
 * docs/new-surface-checklist.md row 2: "build the public-route sweep". Row 2
 * covers any API route. One under a signed in surface (portal, partner,
 * account) is in security-audit's perimeter list, which walks those surfaces.
 * One outside them was swept by nothing, so a route gated only by a token in
 * its request could ship with no check that a missing or a wrong token is
 * refused.
 *
 * So every route.ts under src/app/api outside the signed in surfaces is named
 * here, as one of two kinds, and
 * scripts/proofs/every-public-api-route-is-declared.mjs fails on a route that
 * is not, or on an entry whose route is gone:
 *
 *   token      gated by a link token in the request. It owes the pair: no
 *              token and a wrong token are refused alike, never 2xx, with the
 *              same status and the same body. security-audit sends both to
 *              every one of these (the "public token routes" block).
 *   reason     open, or gated by something other than a link token (a
 *              signature, a secret, a key), with the reason in a sentence, as
 *              its own source states it.
 *
 * Every reason here was read off the route's own source on 2026-11-19; a reason
 * written from the route's name is the defect this file exists to prevent.
 */
export const PUBLIC_API_ROUTES = {
  /* ---------------------------------------------------- gated by a link token */
  "/api/onboarding": {
    kind: "token",
    method: "POST",
    body: { action: "item" },
    why: "A technician's onboarding link: findByToken resolves the token before anything else and answers 404 for none.",
  },
  "/api/onboarding/training": {
    kind: "token",
    method: "POST",
    body: {},
    why: "The training courses on an onboarding link: findByToken first, 404 for none.",
  },
  "/api/order-documents": {
    kind: "token",
    method: "POST",
    body: { action: "sign", fieldId: "probe-field" },
    why: "A customer's upload after ordering, through the order's signed link: no token or no field is notHere, 404.",
  },
  "/api/order-document": {
    kind: "token",
    method: "GET",
    query: { document: "00000000-0000-4000-8000-000000000000" },
    why: "A sealed letter's download, through the order's signed link.",
  },
  "/api/quote-accept": {
    kind: "token",
    method: "POST",
    body: {},
    why: "Accepting a quote through its signed link: customerQuote(token) first, 404 NOT_HERE for none.",
  },

  /* --------------------------------------- gated by a signature, secret or key */
  "/api/stripe/webhook": { kind: "reason", why: "Stripe's own signature on the raw body (stripe-signature); an unverifiable body is refused before it is read." },
  "/api/inbound/resend": { kind: "reason", why: "Resend's inbound webhook, verified by its svix signature headers." },
  "/api/cron/daily": { kind: "reason", why: "Vercel Cron, with the CRON_SECRET bearer compared in constant time; 404 without it." },
  "/api/cron/health-watch": { kind: "reason", why: "Vercel Cron, with the CRON_SECRET bearer; 404 without it." },
  "/api/cron/jobs": { kind: "reason", why: "Vercel Cron, with the CRON_SECRET bearer; 404 without it." },
  "/api/intake/lead": { kind: "reason", why: "A sister site's lead, accepted only under that site's intake key header; 401 for any other." },
  "/api/orders": { kind: "reason", why: "A sister site's order, accepted only under that site's x-intake-key." },
  "/api/v1/orders": { kind: "reason", why: "The partner ordering API, behind an API key." },

  /* ------------------------------------------------- open forms, by design */
  "/api/apply": { kind: "reason", why: "The careers application form: anyone may apply, and attempts are limited." },
  "/api/upload": { kind: "reason", why: "An applicant's document upload: deliberately unauthenticated, scoped to one path in a private bucket (its own header says why)." },
  "/api/lead": { kind: "reason", why: "The site's contact form: anyone may write in, and attempts are limited." },
  "/api/design-inquiry": { kind: "reason", why: "The design brief form: anyone may ask, and attempts are limited." },
  "/api/windstorm-inquiry": { kind: "reason", why: "The windstorm brief form: anyone may ask, and attempts are limited." },
  "/api/roofer-application": { kind: "reason", why: "A roofer's partner application form, and attempts are limited." },
  "/api/start": { kind: "reason", why: "The ads landing form (/start), which takes a lead and its photo before any account exists." },
  "/api/order-flow": { kind: "reason", why: "The public order form: a buyer orders without an account and pays at Stripe." },
  "/api/referral": { kind: "reason", why: "Records a partner referral touch against an anonymous visitor cookie; it opens nothing." },
};

/** The surfaces whose API routes security-audit's perimeter list already walks. */
export const GUARDED_API_PREFIXES = ["/api/portal", "/api/partner", "/api/account"];
