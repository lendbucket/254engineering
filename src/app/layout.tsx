import type { Metadata, Viewport } from "next";
import { Archivo, Open_Sans } from "next/font/google";
import "./globals.css";
import { business } from "@/config/business";

/**
 * THE APPROVED DESIGN'S FACES.
 *
 * Archivo for display, Open Sans for text, at the weights the approved v5
 * artifact actually uses: Archivo 500 to 800, Open Sans 400, 600, 700. Nothing
 * heavier is loaded than the design asks for, because every unused weight is a
 * file a phone downloads for nothing.
 *
 * THE ITALIC FACE IS GONE, AND IT WAS NEVER USED
 * ----------------------------------------------
 * Open Sans italic was declared here from the start and rendered nowhere. The
 * only occurrences of the word italic in the whole source tree were this
 * declaration and one `not-italic`, which is the address element on the location
 * page turning OFF the browser default. Four sampled live pages rendered zero
 * `<em>`, zero `<i>`, and zero italic utility classes.
 *
 * It cost a 44KB woff2 on every route, on a site where the Largest Contentful
 * Paint is a text node on all eight sampled templates. That is the worst kind of
 * unused byte: it is on the critical path for the metric it is hurting.
 *
 * Measured, not assumed. Fonts were 121KB per route before this change.
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
  variable: "--font-open-sans",
  display: "swap",
});


/**
 * The viewport, and why each part of it is here.
 *
 * `viewport-fit=cover` lets the page paint into the display cutout area on a
 * notched phone, which is what makes a dark band reach the physical edge instead
 * of stopping at a white letterbox. It is the half of safe area handling that
 * lives in the meta tag; the other half is the env() padding on anything fixed
 * to the bottom, which is in globals.css.
 *
 * `maximumScale` and `userScalable` are deliberately NOT set. Locking zoom is
 * the usual way sites stop iOS zooming a form field, and it is an accessibility
 * failure: it also stops a person with low vision zooming anything. The correct
 * fix for the zoom is a 16px font size on the control, which is what the form
 * fields now carry.
 *
 * `themeColor` tints the browser chrome. Two entries rather than one because a
 * phone in dark mode gets the deeper navy, so the chrome reads as part of the
 * page in both appearances rather than as a lighter bar sitting above it.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#14315d" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1b36" },
  ],
};

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

/**
 * The root layout holds the document and nothing else.
 *
 * The header, the footer, the skip link, and the entity schema moved to
 * src/app/(site)/layout.tsx when the admin portal landed. They were rendering on
 * every route, which put a marketing header with a waitlist button on top of an
 * internal tool and a public compliance footer under a table of applicant
 * records.
 *
 * A nested layout cannot remove what a parent rendered, so the split is the only
 * fix. What stays here is what genuinely belongs to every route: the document,
 * the language, and the fonts.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${openSans.variable}`}>
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
