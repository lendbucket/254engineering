/**
 * The icon set.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * There are no service line icons. No roof glyph, no foundation glyph, no little
 * house with a lightning bolt through it. Nine of them were considered and none
 * was built, and the reason is worth stating rather than leaving as an absence
 * somebody fills in later.
 *
 * An icon earns its place when it is faster to recognise than the word, or when
 * it carries a meaning the word cannot. "Roof Inspections and Certifications"
 * has no faster glyph, and a drawn roof beside it tells a procurement officer
 * nothing they did not get from the heading. What it does do is move the page
 * one step toward the register of a consumer services brand, which is the
 * register this site is explicitly not in. The playbook's test is whether a
 * reader would pause on an element and wonder about it, and a decorative glyph
 * on a capability statement is exactly that.
 *
 * The mobile menu is a second deliberate absence. It draws its bars and its
 * close cross with positioned spans, which is fewer bytes than an SVG and scales
 * with the type. Replacing working CSS marks with icons would have been churn.
 *
 * WHAT IS HERE
 * ------------
 * Marks that do a job no word does. Every one is on a 16 unit grid, stroked in
 * currentColor at 1.5, and carries no fill, so an icon inherits the colour and
 * the weight of the text beside it and cannot drift from the palette.
 */

type IconProps = {
  className?: string;
  /** Rendered size in pixels. Defaults to the cap height of body copy. */
  size?: number;
};

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  focusable: "false" as const,
});

/**
 * Leaves this site.
 *
 * The one icon on here that is genuinely load bearing. The source lists under
 * every insights post are the reason a reader trusts the page, and a citation
 * that silently replaces the article the reader is halfway through is a bad
 * trade. Paired with target blank, this is the convention that says so.
 */
export function ExternalLinkIcon({ className = "", size = 12 }: IconProps) {
  return (
    <svg {...base(size)} className={`inline-block shrink-0 ${className}`}>
      <path d="M6.5 3H3v10h10V9.5" />
      <path d="M9.5 2.5H13.5V6.5" />
      <path d="M13.5 2.5 7.5 8.5" />
    </svg>
  );
}

/**
 * A seal.
 *
 * Used in the sealing diagram, where the point is that a document can carry more
 * than one of them and each covers its own scope. Two concentric rings is what a
 * Texas PE seal impression actually looks like at a glance, and it reads as one
 * even at 14 pixels, which a detailed rendering would not.
 */
export function SealIcon({ className = "", size = 14 }: IconProps) {
  return (
    <svg {...base(size)} className={`inline-block shrink-0 ${className}`}>
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.75" />
    </svg>
  );
}

/**
 * A document.
 *
 * For places that list a deliverable and need to distinguish the artefact from
 * the process that produces it.
 */
export function DocumentIcon({ className = "", size = 14 }: IconProps) {
  return (
    <svg {...base(size)} className={`inline-block shrink-0 ${className}`}>
      <path d="M9 1.75H4.25A1.25 1.25 0 0 0 3 3v10a1.25 1.25 0 0 0 1.25 1.25h7.5A1.25 1.25 0 0 0 13 13V5.75Z" />
      <path d="M9 1.75V5.75H13" />
    </svg>
  );
}
