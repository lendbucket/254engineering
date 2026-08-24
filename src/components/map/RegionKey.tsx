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
export function RegionKey({ className = "" }: { className?: string }) {
  const total = regions.reduce((sum, r) => sum + r.counties.length, 0);

  return (
    <div className={className}>
      <ul className="divide-y divide-limestone-line border-t border-b border-limestone-line">
        {regions.map((region) => (
          <li key={region.slug}>
            <Link
              href={`/coverage/${region.slug}`}
              className="flex items-baseline justify-between gap-4 py-3 transition-colors hover:text-brass-ink"
            >
              <span className="text-[0.96rem] leading-[1.5] font-medium text-slate">
                {region.name}
              </span>
              <span className="font-sans text-[0.85rem] tabular-nums text-slate-muted">
                {region.counties.length}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 font-sans text-[0.85rem] text-slate-muted">
        {total} counties across eight regions.
      </p>
    </div>
  );
}
