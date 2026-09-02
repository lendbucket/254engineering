import { COUNTY_MAP_VIEWBOX, countyShapes } from "@/content/county-geometry";

/**
 * Where the bench actually reaches.
 *
 * WHY THIS IS NOT TexasCountyMap
 * ------------------------------
 * The marketing map is a reference map with a deliberate rule: every county gets
 * the same pale fill, because a monochrome ramp over categorical regions implies
 * an ordering that does not exist. That rule is right for a page claiming
 * statewide coverage and wrong here. This map is answering a quantitative
 * question, how many technicians can work each county, and depth of fill is
 * exactly the right encoding for it because more really does mean more.
 *
 * Bending the marketing component to serve both would have put a prop on it that
 * contradicts its own documented reasoning. Two components, two purposes.
 *
 * WHY A COUNTY WITH NOBODY IN IT IS DRAWN, NOT OMITTED
 * ----------------------------------------------------
 * The firm's coverage claim is 254 counties. This map is the operational truth
 * underneath it, and an operator needs to see the holes as holes: the white
 * areas are where a job would be offered to nobody. Leaving them off would make
 * the map agree with the brochure and disagree with reality.
 */

const TIERS = [
  { min: 4, fill: "#1d2a35", label: "4 or more" },
  { min: 3, fill: "#3c4d5c", label: "3" },
  { min: 2, fill: "#6a7b89", label: "2" },
  { min: 1, fill: "#a9b5be", label: "1" },
  { min: 0, fill: "#f2f0eb", label: "Nobody" },
];

const fillFor = (count: number) => TIERS.find((t) => count >= t.min)?.fill ?? TIERS[TIERS.length - 1].fill;

export function CoverageMap({
  counts,
  className = "",
}: {
  /** county name (canonical, no "County" suffix) to number of active technicians */
  counts: Record<string, number>;
  className?: string;
}) {
  const covered = Object.values(counts).filter((n) => n > 0).length;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${COUNTY_MAP_VIEWBOX.width} ${COUNTY_MAP_VIEWBOX.height}`}
        role="img"
        aria-label={`Map of the 254 counties of Texas. ${covered} have at least one active field technician; ${
          254 - covered
        } have none.`}
        className="h-auto w-full"
      >
        <g stroke="#d8d4cb" strokeWidth={0.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
          {countyShapes.map((county) => (
            <path
              key={county.fips}
              d={county.d}
              fill={fillFor(counts[county.name] ?? 0)}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>

      <figcaption className="mt-3">
        <p className="text-[13px] font-semibold text-slate">
          {covered} of 254 counties have at least one active technician
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {TIERS.map((t) => (
            <li key={t.label} className="flex items-center gap-1.5 text-[12.5px] text-slate-muted">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-[2px] border border-limestone-line"
                style={{ backgroundColor: t.fill }}
              />
              {t.label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
