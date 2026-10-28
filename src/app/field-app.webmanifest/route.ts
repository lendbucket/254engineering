import { business } from "@/config/business";

/**
 * THE FIELD APP'S MANIFEST. Mobile phase 1, Robert's mobile plan rulings
 * (ruling 13 of 2026-10-27, 22:05 Central): build the installable portal first,
 * technicians only, no app store and no sealing on a phone.
 *
 * WHY A SECOND MANIFEST AND NOT THE SITE'S. src/app/manifest.ts is the public
 * site's, with scope "/" and a start page that is the home page. A technician
 * who installs the portal should open on his jobs, inside the portal, and the
 * site's manifest says nothing about either. The portal's root layout points at
 * this one instead, so a page under /portal offers this install and every other
 * page offers the site's.
 *
 * WHY IT IS SERVED HERE AND NOT UNDER /portal. A browser fetches a manifest
 * without the session cookie, and every path under /portal is behind the portal
 * gate in src/proxy.ts, which would answer it with a redirect to sign in. So the
 * manifest, like the service worker beside it, lives at a public path and holds
 * nothing but the name, the colors and the icons the site already publishes.
 *
 * The icons are the site's own rasters (scripts/brand-rasters.mjs), so the field
 * app and the browser tab cannot drift apart.
 */
export const dynamic = "force-static";

export function GET() {
  const body = {
    name: `${business.name} Field`,
    short_name: "254 Field",
    description: "Your jobs, on your phone. Sign in with your 254 Engineering portal account.",
    id: "/portal/jobs",
    start_url: "/portal/jobs",
    scope: "/portal",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f5f7",
    theme_color: "#14315d",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
