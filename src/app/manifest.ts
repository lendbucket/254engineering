import type { MetadataRoute } from "next";
import { business } from "@/config/business";

/**
 * The web app manifest.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT FOR
 * ----------------------------------------
 * Added because a phone that saves this site to its home screen should open a
 * branded window rather than a browser tab pointed at a URL. That is the whole
 * claim. This is not a claim that the site is an installable application with
 * offline behaviour: there is no service worker, and adding one to a mostly
 * static marketing site would be caching complexity with nothing to cache that
 * the browser does not already hold.
 *
 * `display: "standalone"` is therefore honest for what exists. If a service
 * worker ever lands, this file does not have to change.
 *
 * The icons are the same rasters the browser tab uses, generated from the real
 * logo by scripts/brand-rasters.mjs, so the home screen icon and the favicon
 * cannot drift apart. `purpose: "maskable"` on the larger one lets Android crop
 * it to whatever shape the launcher uses without clipping the numerals, which is
 * why the artwork is composited with padding around the mark rather than tight
 * to it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: business.name,
    short_name: "254 Engineering",
    description:
      "A veteran owned Texas engineering firm named for the 254 counties of Texas, built to serve every one of them.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // The limestone the body paints, so the splash does not flash white.
    background_color: "#f4f5f7",
    // The navy the browser chrome is tinted with, so the two agree.
    theme_color: "#14315d",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
