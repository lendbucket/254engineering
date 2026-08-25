import type { Metadata } from "next";
import type React from "react";
import { Archivo, Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd, organizationSchema, websiteSchema } from "@/lib/schema";
import { business } from "@/config/business";

/**
 * THE DISPLAY FACE IS UNDER REVIEW. TWO DIRECTIONS, ONE TREE.
 *
 * The operator's verdict on the previous design was that it read as generic, and
 * the display face was the largest single cause. Source Serif 4 is a working
 * TEXT serif. It is excellent at 18 pixels and it has almost no personality at
 * 60, which is exactly where a hero needs some, so every headline on the site
 * was quietly polite.
 *
 * Two replacements are being evaluated, and rather than branch the repo the face
 * is selected at build time by the DISPLAY_FONT environment variable so both can
 * be rendered from the same tree and compared honestly:
 *
 *   DISPLAY_FONT=serif       Newsreader. A genuine editorial display serif with
 *                            real stroke contrast and a sharp, newspaper cut. It
 *                            reads as a masthead: authority through age.
 *
 *   DISPLAY_FONT=grotesque   Archivo. A heavy engineering grotesque cut for
 *                            signage and data. It reads as a specification
 *                            sheet: authority through precision.
 *
 * Both are variable, both ship the weights a hero needs, and both are on Google
 * Fonts so neither adds a licence obligation. Default is serif until the
 * operator rules.
 *
 * `display: "swap"` throughout, so a slow font never blocks the first paint of
 * a page a procurement officer is trying to read.
 */
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Which face --font-display-active resolves to.
 *
 * Read once at module scope. The pages are statically prerendered, so this is a
 * build time decision and flipping it requires a rebuild, which is the same
 * property LAUNCH_MODE has and for the same reason: a visual identity that could
 * change without a deploy leaving a trace is not one this firm should want.
 */
const DISPLAY_DIRECTION = (process.env.DISPLAY_FONT ?? "serif").trim().toLowerCase();
const displayFont = DISPLAY_DIRECTION === "grotesque" ? archivo : newsreader;
const displayVariable = DISPLAY_DIRECTION === "grotesque" ? "--font-archivo" : "--font-newsreader";

export const metadata: Metadata = {
  metadataBase: new URL(business.url),
  // Pages set absolute titles. See the note in src/lib/seo.ts for why there is
  // no title template here.
  title: {
    default: "Texas Engineering Services Statewide | 254 Engineering",
    template: "%s",
  },
  description:
    "254 Engineering Services is a veteran owned Texas engineering firm named for the 254 counties of Texas, serving every one of them.",
  applicationName: business.name,
  authors: [{ name: business.legalName, url: business.url }],
  creator: business.legalName,
  publisher: business.legalName,
  openGraph: {
    siteName: business.name,
    locale: "en_US",
    type: "website",
  },
  formatDetection: { telephone: false, address: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${inter.variable}`}
      // --font-display-active is what globals.css reads. Pointing it at the
      // chosen face here means the whole type system follows one variable.
      style={{ ["--font-display-active"]: `var(${displayVariable})` } as React.CSSProperties}
    >
      <body className="flex min-h-screen flex-col">
        {/*
          The organization and website nodes ship on every page rather than on
          the homepage alone. A crawler that lands first on a region page should
          resolve the entity from that page, and both nodes carry stable @id
          values so repeating them joins rather than duplicates.
        */}
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-[3px] focus:bg-slate focus:px-4 focus:py-2 focus:text-slate-fg"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
