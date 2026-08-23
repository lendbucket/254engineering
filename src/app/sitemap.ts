import type { MetadataRoute } from "next";
import { business } from "@/config/business";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { openPositions } from "@data/positions";

/**
 * The sitemap.
 *
 * Built from the same content modules the pages are, so a service or a region
 * added to the data is in the sitemap without anybody remembering this file. The
 * alternative, a hand kept list, is the thing that silently stops matching the
 * site about three months in.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * /waitlist. It carries noindex in its metadata and a disallow in robots.txt, so
 * including it here would be the sitemap contradicting the other two signals, and
 * Search Console reports that contradiction as an error rather than resolving it.
 *
 * `lastModified` IS OMITTED ENTIRELY, and that is the correction rather than the
 * shortcut. It used to carry `new Date()`, which is the build timestamp, stamped
 * identically onto all twenty six URLs. That is not a modification date, it is
 * the deploy clock wearing one, and it tells a crawler that every page on the
 * site changed at the same instant every time anything ships. The field then
 * stops being believed, which costs more than never having sent it.
 *
 * No page on this site has a true per page modification date yet. There is no
 * blog, and the content pages are generated from data files with no timestamps.
 * When the editorial corpus lands, posts will carry real publish and modified
 * dates and those pages, and only those, will emit the field.
 *
 * scripts/seo-audit.mjs and scripts/placeholder-audit.mjs both crawl this list,
 * which gives it a second job: a page missing from here is a page no audit
 * checks. That is the more expensive failure of the two.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (path: string, priority: number, changeFrequency: "monthly" | "yearly") => ({
    url: `${business.url}${path === "/" ? "" : path}`,
    changeFrequency,
    priority,
  });

  return [
    entry("/", 1, "monthly"),
    entry("/about", 0.9, "monthly"),
    entry("/services", 0.9, "monthly"),
    ...services.map((s) => entry(`/services/${s.slug}`, 0.8, "monthly")),
    entry("/coverage", 0.9, "monthly"),
    ...regions.map((r) => entry(`/coverage/${r.slug}`, 0.8, "monthly")),
    entry("/government", 0.9, "monthly"),
    entry("/careers", 0.8, "monthly"),
    ...openPositions().map((p) => entry(`/careers/${p.slug}`, 0.7, "monthly")),
    entry("/contact", 0.7, "yearly"),
    entry("/privacy", 0.3, "yearly"),
    entry("/terms", 0.3, "yearly"),
  ];
}
