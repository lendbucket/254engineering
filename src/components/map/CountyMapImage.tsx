import { COUNTY_MAP_VIEWBOX } from "@/content/county-geometry";
import { countyMapFileName, countyMapLabel } from "./county-map-file";

/**
 * The county map loaded as a file rather than written into the document.
 * Robert, 2026-11-01, round 3 item a; the reasoning is in county-map-file.ts.
 * Lazy, because on both coverage routes it sits below the masthead photograph
 * the board measures as the LCP element, and its width and height are the
 * viewBox's so it reserves its space and moves nothing when it arrives.
 */
export function CountyMapImage({ activeRegion, className = "" }: { activeRegion?: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/maps/${countyMapFileName(activeRegion)}`}
      alt={countyMapLabel(activeRegion)}
      width={COUNTY_MAP_VIEWBOX.width}
      height={COUNTY_MAP_VIEWBOX.height}
      loading="lazy"
      decoding="async"
      className={`h-auto w-full ${className}`}
    />
  );
}
