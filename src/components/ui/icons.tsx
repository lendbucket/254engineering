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

/**
 * The stroked icon set the approved v5 design uses.
 *
 * WHY THESE EXIST WHEN THE REPO DELIBERATELY HAS NO SERVICE GLYPHS
 * ----------------------------------------------------------------
 * The note at the top of this file records a decision not to draw service line
 * icons, on the grounds that a glyph beside "Roof Inspections and
 * Certifications" tells a procurement officer nothing the heading did not. That
 * reasoning was sound for the design it was written against.
 *
 * The operator has since designed the interface and approved it, and v5 puts a
 * 46 pixel navy tile with a stroked mark on every service card. An approved
 * design outranks an earlier internal judgement about the same question, so the
 * icons are here. The earlier note stays above rather than being deleted,
 * because the argument it makes is still the right one to answer if anybody
 * proposes adding more.
 *
 * All are 24 by 24 on a 1.7 stroke in currentColor, matching v5 exactly, so they
 * inherit whatever colour the tile sets and cannot drift from the palette.
 */
function stroked(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
    focusable: "false" as const,
  };
}

export function StarIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M12 2 L14.6 8.2 21.5 8.8 16.4 13.3 18 20 12 16.4 6 20 7.6 13.3 2.5 8.8 9.4 8.2 Z" />
    </svg>
  );
}

export function ShieldCheckIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z" />
      <path d="M8.5 12 L11 14.5 L15.5 9.5" />
    </svg>
  );
}

export function PinIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M12 21 C12 21 5 14.5 5 9.5 A7 7 0 0 1 19 9.5 C19 14.5 12 21 12 21 Z" />
      <circle cx="12" cy="9.5" r="2.6" />
    </svg>
  );
}

export function BuildingIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M3 21 H21" />
      <path d="M4 21 V9 L12 3 L20 9 V21" />
      <path d="M8 21 V13 H16 V21" />
    </svg>
  );
}

export function ClipboardCheckIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M6 4 H18 V20 H6 Z" />
      <path d="M9 9 H15" />
      <path d="M9 13 H15" />
      <path d="M9 17 L10.5 18.5 L13.5 15.5" />
    </svg>
  );
}

export function ClockIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5 V12 L15.2 14" />
    </svg>
  );
}

export function RoofIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M3 12 L12 4 L21 12" />
      <path d="M6 12 V20 H18 V12" />
    </svg>
  );
}

export function WindIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M3 8 H13 A2.8 2.8 0 1 0 10.2 5.2" />
      <path d="M3 12 H17 A2.8 2.8 0 1 1 14.2 14.8" />
      <path d="M3 16 H10" />
    </svg>
  );
}

export function FoundationIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M4 15 H20 V19 H4 Z" />
      <path d="M7 15 V11 H17 V15" />
      <path d="M10 11 V8 H14 V11" />
    </svg>
  );
}

export function SolarIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M4 9 H20 V17 H4 Z" />
      <path d="M9.3 9 V17" />
      <path d="M14.6 9 V17" />
      <path d="M4 13 H20" />
      <path d="M8 20 H16" />
    </svg>
  );
}

export function ManufacturedHomeIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M4 8 H20 V15 H4 Z" />
      <path d="M6 15 V19" />
      <path d="M12 15 V19" />
      <path d="M18 15 V19" />
    </svg>
  );
}

export function SealedLetterIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M7 3 H14 L18 7 V21 H7 Z" />
      <path d="M14 3 V7 H18" />
      <circle cx="12.5" cy="15" r="2.6" />
    </svg>
  );
}

export function SpecIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M6 4 H18 V20 H6 Z" />
      <path d="M9 9 H15" />
      <path d="M9 13 H15" />
      <path d="M9 17 H13" />
    </svg>
  );
}

export function DesignIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <path d="M4 20 H20" />
      <path d="M4 20 V4" />
      <path d="M4 20 L15 9" />
      <path d="M15 9 L15 13 M15 9 L11 9" />
    </svg>
  );
}

export function ForensicIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg {...stroked(size)} className={className}>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M14.2 14.2 L20 20" />
      <path d="M8 10 L10 12 L12 8" />
    </svg>
  );
}
