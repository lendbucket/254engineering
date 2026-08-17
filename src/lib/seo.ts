import type { Metadata } from "next";
import { business } from "@/config/business";

/**
 * Metadata construction for every page on the site.
 *
 * WHY THE LENGTHS ARE ENFORCED IN CODE RATHER THAN REVIEWED
 * ---------------------------------------------------------
 * Titles and descriptions are the highest priority on this build, and they are
 * also the easiest thing on a site to get wrong invisibly: a description that
 * runs to 180 characters looks complete in the source and renders truncated
 * mid-word in the SERP, where nobody on the team is looking. So the budget is
 * applied here, once, and scripts/seo-audit.mjs re-reads the rendered output to
 * prove it held.
 *
 * The trim is to a SENTENCE boundary, never a word boundary. A word cut leaves a
 * description ending on "and the firm is" -- complete-looking markup, visibly
 * unfinished prose. Losing a whole sentence reads as brevity; losing half of one
 * reads as a bug.
 *
 * There is deliberately no automatic call to action appended. This is the
 * institutional site: descriptions state what the page is, and a "Call now"
 * welded onto the end of an entity description is the register of a different
 * kind of business.
 */

/** Google renders about 60 characters of title. 58 is the working ceiling. */
const MAX_TITLE = 58;
const HARD_MAX_TITLE = 60;

/**
 * The description ceiling.
 *
 * There is no floor enforced here, on purpose. A short description is a copy
 * problem and cutting one is not a fix a function can perform, so the floor
 * lives in scripts/seo-audit.mjs where it fails a build instead of being
 * silently papered over. That distinction caught a real defect on the first run:
 * the homepage description ran to 158 characters, this function dropped its
 * second sentence to fit, and the result was a valid 103 character description
 * that nobody had written.
 */
const MAX_DESC = 155;

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function trimToWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.!?]+$/, "");
}

/**
 * Pick the richest title variant that still fits, richest first.
 *
 * This is what lets "Coastal Bend" carry a qualifier and land in band while
 * "Manufactured Home Foundation Certifications" falls through to the plain form
 * instead of overflowing. The last variant should always be the shortest.
 */
export function fitTitle(variants: string[]): string {
  for (const variant of variants) {
    const v = normalize(variant);
    if (v.length <= MAX_TITLE) return v;
  }
  const shortest = variants.map(normalize).reduce((a, b) => (b.length < a.length ? b : a));
  return shortest.length <= HARD_MAX_TITLE ? shortest : trimToWord(shortest, HARD_MAX_TITLE);
}

/** Drop whole trailing sentences until the description fits its budget. */
export function fitDescription(core: string): string {
  const text = normalize(core);
  if (text.length <= MAX_DESC) return text;

  const sentences = text.match(/[^.?!]+[.?!]+\s*/g);
  if (sentences) {
    let kept = "";
    for (const s of sentences) {
      if ((kept + s).trim().length > MAX_DESC) break;
      kept += s;
    }
    if (kept.trim().length > 0) return kept.trim();
  }
  return `${trimToWord(text, MAX_DESC - 1)}.`;
}

/**
 * Build the Metadata object for a page.
 *
 * EVERY TITLE IS ABSOLUTE, AND THAT IS THE POINT
 * ----------------------------------------------
 * The obvious setup is a layout-level template, `%s | 254 Engineering Services`,
 * so pages carry a short title and the brand is appended. It does not survive
 * the budget. The suffix alone is 26 characters, which leaves 32 for the part
 * that has to lead with the keyword, and a title that reads "Windstorm WPI-8
 * Certifications in Texas | 254 Engineering Services" is 76 characters and gets
 * cut in the SERP at the word Texas.
 *
 * So there is no template. Each page states its own full title inside the
 * budget, and decides for itself whether the brand earns the space it costs on
 * that page. fitTitle() is the ceiling; scripts/seo-audit.mjs is the proof.
 *
 * `siteName` and `locale` are repeated into every page's openGraph on purpose.
 * Next merges metadata shallowly, so a page that defines `openGraph` at all
 * replaces the root layout's object wholesale rather than merging into it. Every
 * page here builds its metadata through this function, so omitting them would
 * drop og:site_name from the entire site and leave it on the root alone, which
 * is how a SERP starts rendering a bare domain instead of the brand name.
 */
export function buildMetadata(params: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const { title, description, path, noIndex } = params;
  const desc = fitDescription(description);
  const fullTitle = fitTitle([title]);

  return {
    title: { absolute: fullTitle },
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description: desc,
      url: path,
      type: "website",
      siteName: business.name,
      locale: "en_US",
      images: [{ url: "/og/default.png", width: 1200, height: 630, alt: business.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: desc,
      images: ["/og/default.png"],
    },
    robots: noIndex ? { index: false, follow: true } : { index: true, follow: true },
  };
}
