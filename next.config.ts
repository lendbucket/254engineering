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
};

export default nextConfig;
