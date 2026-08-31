import type { MetadataRoute } from "next";
import { business } from "@/config/business";
import { services } from "@/content/services";
import { regions } from "@/content/regions";
import { location } from "@/content/location";
import { windstormPages } from "@/content/windstorm-program";
import { proximityPages } from "@/content/structural-engineer";
import { openPositions } from "@data/positions";
import { insights } from "@/content/insights";

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
 * The editorial corpus has now landed, and it is the exception. Every post in
 * src/content/insights.ts carries a hand set `dateModified`, so those URLs, and
 * only those URLs, emit the field. The service and region pages are still
 * generated from data files with no timestamps and still send nothing, which is
 * the correct answer for them rather than a gap waiting to be filled.
 *
 * scripts/seo-audit.mjs and scripts/placeholder-audit.mjs both crawl this list,
 * which gives it a second job: a page missing from here is a page no audit
 * checks. That is the more expensive failure of the two.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const entry = (
    path: string,
    priority: number,
    changeFrequency: "monthly" | "yearly",
    lastModified?: string,
  ) => ({
    url: `${business.url}${path === "/" ? "" : path}`,
    changeFrequency,
    priority,
    // Omitted entirely rather than sent as undefined, so the field is absent
    // from the XML for every page that has no true date. See the note above.
    ...(lastModified ? { lastModified: new Date(`${lastModified}T00:00:00Z`) } : {}),
  });

  return [
    entry("/", 1, "monthly"),
    entry("/about", 0.9, "monthly"),
    entry("/services", 0.9, "monthly"),
    ...services.map((s) => entry(`/services/${s.slug}`, 0.8, "monthly")),
    entry("/coverage", 0.9, "monthly"),
    ...regions.map((r) => entry(`/coverage/${r.slug}`, 0.8, "monthly")),
    // The entity location page. One of these exists and only one ever will.
    // See the reasoning at the top of src/content/location.ts.
    entry(`/${location.slug}`, 0.8, "monthly"),
    entry("/windstorm", 0.9, "monthly"),
    ...windstormPages.map((w) => entry(`/windstorm/${w.slug}`, 0.8, "monthly")),
    entry("/structural-engineer", 0.9, "monthly"),
    ...proximityPages.map((p) => entry(`/structural-engineer/${p.slug}`, 0.8, "monthly")),
    entry("/government", 0.9, "monthly"),
    entry("/careers", 0.8, "monthly"),
    ...openPositions().map((p) => entry(`/careers/${p.slug}`, 0.7, "monthly")),
    entry("/insights", 0.8, "monthly"),
    ...insights.map((i) => entry(`/insights/${i.slug}`, 0.7, "monthly", i.dateModified)),
    entry("/contact", 0.7, "yearly"),
    entry("/privacy", 0.3, "yearly"),
    entry("/terms", 0.3, "yearly"),
  ];
}
