import Link from "next/link";
import { regions } from "@/content/regions";

/**
 * The map key.
 *
 * It is a list of links rather than a set of swatches beside labels, because the
 * swatch is doing almost no work here: the four tints separate neighbours and do
 * not identify a region, so a reader cannot use a swatch to find the Panhandle
 * on the map. What they can use is the county count, which is the fact the key
 * is actually carrying, and the link, which is where they want to go next.
 *
 * The counts are read from the region data rather than typed, so the key cannot
 * disagree with the county lists further down the page.
 */
export function RegionKey({
  tone = "light",
  className = "",
}: {
  tone?: "light" | "dark";
  className?: string;
}) {
  const total = regions.reduce((sum, r) => sum + r.counties.length, 0);
  const dark = tone === "dark";

  const divide = dark ? "divide-slate-fg/15" : "divide-limestone-line";
  const rule = dark ? "border-slate-fg/15" : "border-limestone-line";
  const name = dark ? "text-slate-fg" : "text-slate";
  const count = dark ? "text-brass-light" : "text-slate-muted";
  const foot = dark ? "text-slate-fg-muted" : "text-slate-muted";
  const hover = dark ? "hover:text-brass-light" : "hover:text-brass-ink";

  return (
    <div className={className}>
      <ul className={`divide-y ${divide} border-t border-b ${rule}`}>
        {regions.map((region) => (
          <li key={region.slug}>
            <Link
              href={`/coverage/${region.slug}`}
              className={`flex items-baseline justify-between gap-4 py-3.5 transition-colors ${hover}`}
            >
              <span className={`text-[0.98rem] leading-[1.5] font-medium ${name}`}>
                {region.name}
              </span>
              <span className={`font-sans text-[0.9rem] font-semibold tabular-nums ${count}`}>
                {region.counties.length}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={`mt-4 font-sans text-[0.85rem] ${foot}`}>
        {total} counties across eight regions.
      </p>
    </div>
  );
}
