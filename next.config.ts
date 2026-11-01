import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
