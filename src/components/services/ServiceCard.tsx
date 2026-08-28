import Link from "next/link";
import {
  DesignIcon,
  ForensicIcon,
  FoundationIcon,
  ManufacturedHomeIcon,
  RoofIcon,
  SealedLetterIcon,
  SolarIcon,
  SpecIcon,
  WindIcon,
} from "@/components/ui/icons";
import { CARD_LINK, IconTile } from "@/components/ui/section";

/**
 * The service line card, as v5 draws it.
 *
 * WHY THE ICON AND THE TAG LIVE HERE AND NOT ON THE HOMEPAGE
 * ----------------------------------------------------------
 * Section 2 built this for the homepage and kept the icon map and the tag map in
 * `app/page.tsx`. The services hub then rendered the same nine services as plain
 * bordered cards with no mark and no category, so the two most important lists
 * of the same nine things did not look like the same nine things.
 *
 * Both maps are keyed by slug and both are presentation, not content, which is
 * why they sit beside the card rather than in `src/content/services.ts`. A slug
 * with no entry falls back rather than rendering a hole, so adding a service
 * line cannot break either page.
 *
 * THE HEADING LEVEL IS A PROP, AND IT IS NOT COSMETIC
 * ---------------------------------------------------
 * On the services hub each card's name is an h2: the page is a list of service
 * lines and the outline should say so. On the homepage the same card sits under
 * a section h2 and its name is a span, because nine h3s about services would
 * compete with the section headings around them. Rendering the wrong one is an
 * accessibility finding rather than a style preference, so it is stated at the
 * call site.
 */

const SERVICE_ICONS: Record<string, typeof RoofIcon> = {
  "roof-inspections": RoofIcon,
  "windstorm-wpi-8": WindIcon,
  "foundation-inspections": FoundationIcon,
  "solar-structural-letters": SolarIcon,
  "manufactured-home-foundation-certifications": ManufacturedHomeIcon,
  "structural-letters": SealedLetterIcon,
  "repair-specifications": SpecIcon,
  "residential-light-commercial-design": DesignIcon,
  "forensic-engineering": ForensicIcon,
};

const SERVICE_TAGS: Record<string, string> = {
  "roof-inspections": "Certification",
  "windstorm-wpi-8": "Coastal",
  "foundation-inspections": "Certification",
  "solar-structural-letters": "Sealed letter",
  "manufactured-home-foundation-certifications": "Lending",
  "structural-letters": "Permitting",
  "repair-specifications": "Sealed letter",
  "residential-light-commercial-design": "Design",
  "forensic-engineering": "Investigation",
};

export function ServiceCard({
  slug,
  name,
  summary,
  heading = "span",
  cta,
}: {
  slug: string;
  name: string;
  summary: string;
  /** `h2` on the services hub, `span` where the card sits under a section heading. */
  heading?: "span" | "h2";
  /** The gold line closing the card. Omitted on the homepage, where the grid is dense. */
  cta?: string;
}) {
  const Icon = SERVICE_ICONS[slug] ?? SealedLetterIcon;
  const tag = SERVICE_TAGS[slug] ?? "Engineering";
  const Name = heading;

  return (
    <li className="h-full">
      <Link href={`/services/${slug}`} className={`${CARD_LINK} flex flex-col p-6`}>
        <span className="flex items-center justify-between gap-3">
          <IconTile>
            <Icon size={24} />
          </IconTile>
          <span className="text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            {tag}
          </span>
        </span>
        <Name className="mt-4 font-display text-[17px] leading-[1.35] font-semibold text-slate">
          {name}
        </Name>
        <span className="mt-2 flex-1 text-[14px] leading-[1.65] text-slate-muted">{summary}</span>
        {cta ? (
          <span className="mt-5 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            {cta}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
