import type { Metadata } from "next";
import { Archivo, Open_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd, organizationSchema, websiteSchema } from "@/lib/schema";
import { business } from "@/config/business";

/**
 * THE APPROVED DESIGN'S FACES.
 *
 * Archivo for display, Open Sans for text, at the weights the approved v5
 * artifact actually uses: Archivo 500 to 800, Open Sans 400, 600, 700, and 400
 * italic. Nothing heavier is loaded than the design asks for, because every
 * unused weight is a file a phone downloads for nothing.
 *
 * THIS SUPERSEDES THE NEWSREADER RULING, AND THAT IS RECORDED RATHER THAN QUIET
 * ----------------------------------------------------------------------------
 * The design elevation workstream put two directions in front of the operator,
 * a serif and a grotesque, and the ruling was Newsreader. That ruling stood and
 * shipped. The operator then designed the interface externally and approved v5,
 * which specifies Archivo, and an approved artifact from the operator outranks
 * an earlier ruling by the same operator.
 *
 * The history is in CLAUDE.md rather than only here, because a superseded
 * decision that leaves no trace looks like a decision nobody made.
 *
 * WHY next/font AND NOT THE LINK TAG IN v5
 * ----------------------------------------
 * v5 carries a runtime <link> to fonts.googleapis.com. That is correct for a
 * design export and wrong for production: it is a third party request on the
 * critical path, a privacy surface, and a render blocking round trip before any
 * text is painted. next/font downloads the files at build time, self hosts
 * them, subsets them, and emits the preload links, so the same faces arrive
 * from this origin with no external request at all.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-open-sans",
  display: "swap",
});


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
    <html lang="en" className={`${archivo.variable} ${openSans.variable}`}>
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
