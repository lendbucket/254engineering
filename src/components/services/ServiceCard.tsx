import Link from "next/link";
import {
  DesignIcon,
  FoundationIcon,
  ManufacturedHomeIcon,
  RoofIcon,
  SealedLetterIcon,
  SolarIcon,
  SpecIcon,
  WindIcon,
} from "@/components/ui/icons";
import { CARD_LINK, IconTile } from "@/components/ui/section";
import { lineOffer } from "@/lib/ordering";

/**
 * The service line card, as v5 draws it.
 *
 * WHY THE ICON AND THE TAG LIVE HERE AND NOT ON THE HOMEPAGE
 * ----------------------------------------------------------
 * Section 2 built this for the homepage and kept the icon map and the tag map in
 * `app/page.tsx`. The services hub then rendered the same services as plain
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
  const offer = lineOffer(slug);

  /*
   * ==========================================================================
   * TWO TARGETS IN ONE CARD, AND THE REASON IT IS NOT A LINK INSIDE A LINK.
   * Operator ruling, 2026-10-03, instruction 3.
   * ==========================================================================
   *
   * "Every service card on the homepage and /services: offered lines say Order
   * online with the price; others say Request a quote. Never imply a line can be
   * ordered when it cannot."
   *
   * The card was one <Link> wrapping everything, so the action could only have
   * been an anchor nested inside an anchor. That is invalid markup and a real
   * defect rather than a pedantic one: a browser may treat the inner click as
   * the outer link's, and on a phone the two targets sit on top of each other.
   * `FileSelection.tsx` already records that exact hazard in its own words.
   *
   * So the card is a container with a STRETCHED LINK: the service name is the
   * link and an ::after pseudo element covers the card, which gives the whole
   * surface the name's target without wrapping anything. The action sits above
   * it on its own z layer, as a second, separate target with its own label.
   *
   * WHAT EACH ONE DOES. The card opens the service page, which is what a reader
   * clicking a card about a service expects. The action goes straight to the
   * order flow, or to the quote form with this line preselected, which is the
   * step the operator found the site never offered at all.
   */
  return (
    <li className="h-full">
      <div className={`${CARD_LINK} relative flex flex-col p-6`}>
        <span className="flex items-center justify-between gap-3">
          <IconTile>
            <Icon size={24} />
          </IconTile>
          <span className="text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            {tag}
          </span>
        </span>
        <Name className="mt-4 font-display text-[17px] leading-[1.35] font-semibold text-slate">
          <Link
            href={`/services/${slug}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </Name>
        <span className="mt-2 flex-1 text-[14px] leading-[1.65] text-slate-muted">{summary}</span>
        {cta ? (
          <span className="mt-5 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
            {cta}
          </span>
        ) : null}

        {/*
          THE PRICE IS ON THE SAME LINE AS THE ACTION, DELIBERATELY. A figure
          sitting on its own is a claim about cost; a figure on the button is
          what you will be charged if you press it. The coastal line is named
          separately rather than folded in, which is the operator's ruling of
          2026-09-02 about that surcharge and holds wherever it is shown.
        */}
        <span className="relative z-10 mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-[var(--color-limestone-line)] pt-4">
          <Link
            href={offer.href}
            className="text-[14px] font-semibold text-slate underline underline-offset-4 hover:text-brass-ink"
          >
            {offer.cta}
          </Link>
          {offer.price ? (
            <span className="text-[14px] font-semibold text-slate">{offer.price}</span>
          ) : null}
          {offer.coastal ? (
            <span className="text-[13px] text-slate-muted">{offer.coastal}</span>
          ) : null}
        </span>
      </div>
    </li>
  );
}
