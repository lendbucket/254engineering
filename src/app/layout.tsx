import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { JsonLd, organizationSchema, websiteSchema } from "@/lib/schema";
import { business } from "@/config/business";

/**
 * Source Serif 4 for display, Inter for text.
 *
 * The serif is doing a specific job. This firm has to read as an institution on
 * a capability statement and in a chamber of commerce listing, and a geometric
 * sans headline reads as a startup regardless of what it says. Source Serif 4 is
 * a working text serif rather than a display face: it has the weight range for a
 * hero and the fitting to survive at 18 pixels, which matters because the
 * headings on the service pages are long.
 *
 * `display: "swap"` on both, so a slow font never blocks the first paint of a
 * page a procurement officer is trying to read.
 */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
    <html lang="en" className={`${sourceSerif.variable} ${inter.variable}`}>
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
