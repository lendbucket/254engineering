import type { MetadataRoute } from "next";
import { business } from "@/config/business";
import { services } from "@/content/services";
import { regions } from "@/content/regions";

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
 * `lastModified` is a single build timestamp rather than a per page date. A
 * per page date that is really "when the deploy happened" is worse than no date,
 * because it teaches a crawler that every page changes on every deploy and then
 * to stop believing the field.
 *
 * scripts/seo-audit.mjs and scripts/placeholder-audit.mjs both crawl this list,
 * which gives it a second job: a page missing from here is a page no audit
 * checks. That is the more expensive failure of the two.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entry = (path: string, priority: number, changeFrequency: "monthly" | "yearly") => ({
    url: `${business.url}${path === "/" ? "" : path}`,
    lastModified,
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
    entry("/contact", 0.7, "yearly"),
    entry("/privacy", 0.3, "yearly"),
    entry("/terms", 0.3, "yearly"),
  ];
}
