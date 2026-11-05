import type { NextConfig } from "next";

/*
 * THE SECURITY HEADERS. Robert's ruling Q14 of 2026-11-02, from the live site
 * audit (issue #1, 6585009543, issue 5): every response carried HSTS and none
 * of these. The Content Security Policy is REPORT ONLY by the ruling's own
 * words, so it can be read in a browser console against what the site really
 * loads before anybody makes it enforcing. What it allows, and why:
 *   scripts   this origin; inline, because Next streams its payload in inline
 *             scripts and the site carries JSON-LD; Google's tag (GA4, item m)
 *   images    this origin, data and blob (capture previews), GA4's beacons,
 *             and Supabase storage, which signs every evidence and document
 *             image the portal shows
 *   connect   this origin, GA4, and Supabase storage, where uploads PUT
 *   fonts     this origin (next/font self hosts, layout.tsx)
 *   frames    none, and nothing may frame the site: no page embeds another or
 *             is embedded, and checkout is a redirect to Stripe, not a frame
 * HSTS keeps Vercel's two years and adds includeSubDomains, as ruled; no
 * preload, which the ruling did not ask for. Geolocation and the camera stay
 * open to this origin, because the field capture screen reads the position
 * (src/lib/offline-queue.ts) and takes photographs.
 * Pinned by scripts/proofs/the-site-sends-its-security-headers.mjs.
 */
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.google-analytics.com https://*.googletagmanager.com https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  /* No x-powered-by on dynamic routes (live site audit, issue 6; Q14). */
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  /*
   * AVIF first, WebP for a browser that does not accept AVIF. Robert, 2026-10-31,
   * on issue #1 comment 6551453855: serve AVIF with WebP fallback for the hero
   * photo and site images, to bring /coverage's LCP element, the masthead photo,
   * well under the 3400ms ceiling. Order matters: Next.js serves the first
   * format the request's Accept header names. Pinned by
   * scripts/proofs/the-site-images-serve-avif-then-webp.mjs.
   */
  images: {
    formats: ["image/avif", "image/webp"],
  },
  /*
   * ONE PAGE PER WPI-8 INTENT. Robert, 2026-11-01, round 3 item h: a page that
   * duplicates an owner is 301ed to it, with its unique sourced facts folded
   * into the owner. The mapping and the reason for each were posted on issue #1
   * (comment 6559524740) before merging. statusCode rather than `permanent`,
   * because `permanent: true` answers 308 and the ruling says 301. Pinned by
   * scripts/proofs/a-duplicate-wpi-8-page-redirects-to-its-owner.mjs.
   */
  async redirects() {
    return [
      {
        source: "/insights/windstorm-certificate-of-compliance",
        destination: "/insights/wpi-8-certificate",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
