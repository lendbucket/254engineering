import { insightsByDate, sectionOf, type Insight, type InsightSection } from "@/content/insights";

/*
 * Kept out of insights.ts on purpose: scripts/lib/guide-dates.mjs reads every
 * `slug:` block in that file as a post and dates it from git, so a section
 * declared there would be dated as a post.
 */

/*
 * THE INDEX IS GROUPED BY SECTION. Robert's answer 3 of 2026-11-13, on the
 * ruling of 2026-10-18 that the hub is rebuilt before the next blog section:
 * the hub shows the newest few of each section in full and links to that
 * section's own page, which lists every post in it. The hub's height then
 * depends on the number of sections, not the number of posts. Never trim a
 * post to fit the index. Every post stays reachable from the hub through its
 * section page, and seo-audit asserts that from the rendered pages.
 */
export const HUB_POSTS_PER_SECTION = 3;

export type InsightSectionPage = {
  key: InsightSection;
  /** The URL segment, /insights/section/<slug>. */
  slug: string;
  /** How the hub names it, and the breadcrumb. */
  label: string;
  h1: string;
  title: string;
  description: string;
  lede: string;
};

export const INSIGHT_SECTIONS: InsightSectionPage[] = [
  {
    key: "core",
    slug: "licensure-and-procurement",
    label: "Licensure, procurement and permitting",
    h1: "Texas licensure, firm registration and procurement",
    title: "Texas Licensure and Procurement Insights | 254 Engineering",
    description:
      "How Texas licenses engineers, registers the firms they practice through, and selects them for public work, from the statutes. Read each piece with sources.",
    lede: "How the state licenses engineers, registers the firms they practice through, and requires public bodies to select them, with the statute or rule behind every point.",
  },
  {
    key: "coastal",
    slug: "coastal-and-windstorm",
    label: "Coastal and windstorm",
    h1: "The Texas coast: windstorm certificates, TWIA and storm damage",
    title: "Texas Coastal and Windstorm Insights | 254 Engineering",
    description:
      "The WPI-8 certificate, TWIA eligibility, windstorm inspections and hurricane damage on the Texas coast, read from the Insurance Code. Read every piece here.",
    lede: "The windstorm certificate, TWIA eligibility and coverage, and the documents a coastal sale or claim turns on, each read from the Insurance Code and the department's own rules.",
  },
  {
    key: "buyers",
    slug: "foundations-and-home-buying",
    label: "Foundations, buying and lending",
    h1: "Foundations, home buying and lending in Texas",
    title: "Texas Foundation and Home Buying Insights | 254 Engineering",
    description:
      "Foundation cracks, inspection costs, FHA certifications and the structural report a lender reads, written for Texas buyers, agents and lenders. Start here.",
    lede: "What a foundation crack means on Texas clay, what each kind of inspection buys, and how an agent or a lender reads a structural engineer's report.",
  },
  {
    key: "roofs",
    slug: "roofs",
    label: "Roofs",
    h1: "Roofs: age, certification letters, hail and inspection cost",
    title: "Roof Inspection and Certification Insights | 254 Engineering",
    description:
      "Roof age records, certification letters, hail damage and inspection costs in Texas, written for owners, agents and roofers, with sources. Read the pieces here.",
    lede: "How old a roof is and how to prove it, what a roof certification letter states in a sale, and where an engineer's record ends and an adjuster's decision begins.",
  },
];

export function sectionPageBySlug(slug: string): InsightSectionPage | undefined {
  return INSIGHT_SECTIONS.find((s) => s.slug === slug);
}

/** Every post in one section, newest first. */
export function postsInSection(key: InsightSection): Insight[] {
  return insightsByDate().filter((p) => sectionOf(p.slug) === key);
}

/** Sections in the order the hub shows them: the one with the newest post first. */
export function sectionsByNewest(): InsightSectionPage[] {
  const newest = (s: InsightSectionPage) => postsInSection(s.key)[0]?.datePublished ?? "";
  return [...INSIGHT_SECTIONS].filter((s) => postsInSection(s.key).length > 0).sort((a, b) => newest(b).localeCompare(newest(a)));
}
