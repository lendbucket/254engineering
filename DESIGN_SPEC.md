# DESIGN_SPEC

The extracted design system from the operator's approved artifact,
`design-reference/254 Landing Page v5.dc.html`.

v5 is the single source of visual truth for this workstream. v2, v3, v4, and the
unnumbered original are in `design-reference/` as history and are ignored.

This document is written before any code, so that what was extracted can be
checked against the artifact rather than inferred from the result.

## 0. What the export is, and what may not ship from it

The file is a Claude Design export. It contains template constructs that are not
valid production HTML. Every one is translated, never copied.

| Construct | Count in v5 | Translation |
| --- | --- | --- |
| `sc-if value="{{ wide }}"` | 2 | Desktop branch. Becomes the `lg:` side of real responsive CSS. |
| `sc-if value="{{ narrow }}"` | 1 | Mobile branch of the same element. Becomes the base styles. |
| `sc-if value="{{ menuOpen }}"` | 1 | Mobile menu panel. Becomes the repo's existing `MobileNav` state. |
| `sc-if value="{{ sent }}" / `{{ notSent }}`` | 2 | Form success and idle states. Becomes the existing waitlist form states. |
| `sc-if value="{{ showCounties }}"` | 1 | An editor toggle, not a runtime branch. Always true in the approved render. |
| `sc-for` | 5 | Real `.map()` over the repo's existing content modules. |
| `x-dc`, `helmet`, `support.js`, `data-screen-label`, `data-dc-script` | 6 | Deleted. None reaches production. |
| `style-hover`, `style-focus` | many | Tailwind `hover:` and `focus-visible:` utilities. |
| Google Fonts `<link>` | 1 | Deleted. Fonts come through `next/font` per the repo's existing pattern. |

`{{ heroMapDark }}`, `{{ mapSvg }}`, and `{{ windMapSvg }}` are placeholders for
the Texas map. The repo already owns that component, derived from Census geometry
with a fingerprint guard, and it is reused rather than replaced.

## 1. Palette

Extracted by frequency from v5. Token names are semantic; the repo's existing
names are kept where the role is unchanged so that component APIs do not churn.

### Navy

| Token | Value | Role in v5 | Uses |
| --- | --- | --- | --- |
| `slate` | `#14315D` | Primary navy. Nav bar, headings on light, gradient start. | 54 |
| `slate-ink` | `#14213A` | Text on gold buttons. | 13 |
| `slate-deep` | `#0E2347` | Gradient mid, careers band, mobile menu panel. | 5 |
| `slate-abyss` | `#0B1B36` | Gradient end, footer. | 2 |

**The repo currently carries `#14315C`. v5 says `#14315D`.** Unify on the v5
value everywhere, including the county map's hardcoded strings.

### Gold

| Token | Value | Role | AA as text on light |
| --- | --- | --- | --- |
| `accent` | `#D9A032` | Buttons, rules, borders, active states. | No, 2.33:1. Never text on light. |
| `accent-deep` | `#B77E1B` | v5 uses it as small text on light. | No, 3.08:1 worst. See deviations. |
| `accent-light` | `#E8B04A` | Text and highlight on navy. | 6.60:1 on navy. Yes, on navy only. |
| `accent-tint` | `#FDF6E7` | Cream fill behind the success mark. | Surface, not text. |
| `accent-ink` | `#8D610F` | **Added by this spec.** Gold as text on light. | 4.81:1 worst. |

### Surfaces and text

| Token | Value | Role |
| --- | --- | --- |
| `white` | `#FFFFFF` | Page ground, cards. |
| `limestone` | `#F4F5F7` | Alternate section band, panel fills. |
| `limestone-sunk` | `#EDF1F7` | Icon tiles, tag chips. |
| `limestone-line` | `#DDE0E4` | Card borders. |
| `line-strong` | `#C3C9D1` | Input borders. |
| `ink` | `#333A45` | Body text on light. 11.46:1. |
| `ink-muted` | `#555E6B` | Secondary text and kickers. 6.02:1 worst. |
| `fg` | `#FFFFFF` | Text on navy. |
| `fg-muted` | `#CFD7E3` | Body text on navy. 8.90:1. |
| `fg-dim` | `#9DAAC0` | Stat labels on navy. 5.50:1. |
| `fg-footer` | `#DCE2EB` | Footer links. 13.17:1. |
| `fg-footer-label` | `#8A99B5` | Footer column labels. 5.97:1. |

## 2. Compliance deviations from v5

Seven pairings in v5 measure under the 4.5:1 AA floor. The repo's standing rule
is that gold is an accent and not body text, and that rule wins. Each deviation
below is the nearest compliant treatment, measured.

| v5 pairing | Measured | Deviation | New measure |
| --- | --- | --- | --- |
| `#D9A032` as text on white | 2.33:1 | Never used as text on a light surface. Confirmed v5 does not do this either; recorded so nobody adds it. | n/a |
| `#B77E1B` text on white | 3.49:1 | `accent-ink` `#8D610F` | 4.81:1 |
| `#B77E1B` text on `#F4F5F7` | 3.20:1 | `accent-ink` `#8D610F` | 4.86:1 |
| `#B77E1B` text on `#FDF6E7` | 3.24:1 | `accent-ink` `#8D610F` | 4.90:1 |
| `#6A7382` kicker on `#F4F5F7` | 4.39:1 | `ink-muted` `#555E6B`, already in the palette | 6.02:1 |
| `#8A93A5` helper text on white | 3.09:1 | `#5F6877` | 4.96:1 |
| `#9AA2AE` input placeholder on white | 2.58:1 | `#5F6877` | 4.96:1 |

`#B77E1B` is kept in the palette as `accent-deep` for borders, rules, and the
underline on the careers link, where it carries no text contrast obligation.

## 3. Typography

v5 loads Archivo 500/600/700/800 and Open Sans 400/600/700 plus 400 italic.

**This supersedes the earlier Newsreader ruling.** The operator approved
Newsreader as the display face during the design elevation workstream; the
approved v5 artifact replaces it with Archivo. Section 1 records the supersession
in `CLAUDE.md` so the history stays honest rather than being quietly overwritten.

| Role | Family | Weight | Size | Other |
| --- | --- | --- | --- | --- |
| H1 hero | Archivo | 700 | `clamp(34px, 5vw, 56px)` | lh 1.12, ls -0.015em, max 20ch |
| H2 section | Archivo | 700 | `clamp(28px, 3.6vw, 38px)` | ls -0.01em |
| H2 waitlist | Archivo | 700 | `clamp(28px, 4vw, 40px)` | ls -0.01em |
| H2 careers | Archivo | 700 | `clamp(26px, 3.2vw, 34px)` | ls -0.01em |
| H3 panel | Archivo | 700 | `clamp(21px, 2.4vw, 26px)` | |
| H3 card | Archivo | 700 | 18px to 20px | |
| Card title | Archivo | 600 | 17px | lh 1.35 |
| Stat numeral | Archivo | 800 | `clamp(28px, 3vw, 36px)`, 34px in waitlist | lh 1 |
| Ghost numeral | Archivo | 800 | 190px | `#EDF1F7`, decorative, aria-hidden |
| Hero lede | Open Sans | 400 | `clamp(16px, 1.9vw, 18.5px)` | lh 1.7, max 56ch |
| Section lede | Open Sans | 400 | 16px | lh 1.7, max 62ch |
| Body / card text | Open Sans | 400 | 14px to 15.5px | lh 1.6 to 1.75 |
| Nav link | Open Sans | 600 | 15px | |
| Button | Open Sans | 700 | 15px to 16px | |
| Kicker / eyebrow | Open Sans | 700 | 11.5px to 12.5px | ls 0.1em to 0.14em, uppercase |
| Form label | Open Sans | 600 | 13.5px | |
| Input | Open Sans | 400 | 15.5px | |

Loaded through `next/font/google`, self hosted and subsetted, matching the
repo's existing pattern. No runtime Google Fonts link ships.

## 4. Spacing and layout

- Container: `max-width: 1200px`, `margin: 0 auto`.
- Container padding: `clamp(16px, 4vw, 28px)`.
  The repo's `Container` is currently `max-w-6xl` (1152px) with `px-5 sm:px-8`.
  It moves to 1200px and the clamp.
- Section vertical padding: `clamp(48px, 7vw, 88px)`. Waitlist `clamp(52px, 8vw, 96px)`. Careers `clamp(44px, 6vw, 72px)`. Hero `clamp(52px, 7vw, 96px)` top.
- Section gap between columns: `clamp(28px, 5vw, 64px)`, hero `clamp(36px, 5vw, 80px)`.
- Card radius: 4px. Chips and small controls: 2px to 3px. Buttons: 3px.
- Card padding: 24px, panels `clamp(22px, 3vw, 32px)`.
- Grid: `repeat(auto-fit, minmax(min(310px, 100%), 1fr))` for services, `minmax(min(260px, 100%), 1fr)` for government tiles, `minmax(210px, 1fr)` for regions.
- Breakpoint: v5's script switches at `window.innerWidth < 1020`. Translated to the repo's existing `lg:` (1024px), a 4px difference with no visual consequence.

## 5. Component inventory and responsive behaviour

| # | Section | Background | Composition | Responsive |
| --- | --- | --- | --- | --- |
| 1 | Header | White | Logo left at `clamp(58px, 9vw, 84px)`; opening soon block right with email link | Right block hidden below `lg` |
| 2 | Nav bar | `#14315D`, sticky, `z-50`, shadow | Six anchors with 3px transparent bottom border going gold on hover; gold waitlist CTA flush right | Below `lg`: MENU button with three bars plus gold CTA; open panel is `#0E2347` column |
| 3 | Hero | Gradient `165deg #14315D 0%, #0E2347 70%, #0B1B36 100%` | Gold outlined "Opening soon" pill, H1 with "254 counties" in `accent-light`, lede, two CTAs; map right; stat rail below a hairline | Single column below `lg`; map above stats |
| 4 | Credibility | White, bottom border | Four icon and label pairs, 34px stroked SVGs | `auto-fit minmax(250px, 1fr)` |
| 5 | Services | `#F4F5F7` | Nine cards: 46px navy icon tile, uppercase tag, Archivo 600 title, description; hover lifts 3px with shadow | `auto-fit minmax(310px, 1fr)` |
| 6 | How it works | Navy gradient | Left: three selectable steps with a gold progress fill. Right: white panel with a 190px ghost numeral, icon, step kicker, title, description | Stacks below `lg` |
| 7 | Coverage | White | Map left, gold left-bordered detail panel plus eight region buttons right | Stacks; map full width |
| 8 | Windstorm | Navy gradient | Copy and CTA left; white card right with a coastal map and fourteen county buttons in two columns | Stacks |
| 9 | Government and commercial | White | Four bordered capability tiles left; navy capability statement card right | Stacks |
| 10 | Careers | `#0E2347` | Copy and white CTA left; two white role cards with chips right | Stacks |
| 11 | Waitlist | `#F4F5F7` | Copy and three stats left; white form with 4px gold top border right. Success state replaces the form | Stacks |
| 12 | Footer | `#0B1B36`, 4px gold top border | Dark logo, description, two badges, three link columns, centred compliance block | `auto-fit minmax(230px, 1fr)` |

## 6. Motion in v5, and what carries over

v5 defines two keyframes and two intervals:

- `ping`, a scale and fade, used on a live indicator.
- `fillbar`, a width animation on the process step progress bar.
- A 3s auto cycle through the eight coverage regions.
- A 5s auto cycle through the three process steps.

The auto cycles are a demo device. They move content without the reader asking,
they fight a screen reader, and on the coverage section they would animate the
county map every three seconds. **They are not carried over.** The steps and
regions remain selectable; they simply do not advance on their own. The `fillbar`
is kept as a static state indicator on the selected step.

Everything that does carry over respects `prefers-reduced-motion`, which the repo
already enforces globally.

## 7. The logo

`logo.png` and `logo-dark.png` are the real artwork, 2262x1147 with alpha.

Sampled, not assumed:

- `logo.png` is navy `#012758` at 86 percent of opaque pixels, gold `#D6A62A` and `#CA8A03`.
- `logo-dark.png` is white at 92 percent with the same golds. It is the reverse lockup for dark surfaces, and it renders as almost nothing against white, which is correct.

**The artwork navy `#012758` is deeper than the UI navy `#14315D`.** The artwork
is not recoloured to match; a logo is a fixed asset and adjusting it to a UI token
is how brand marks drift. The two sit adjacently only in the header, where the
logo is on white.

## 8. Wiring that differs from v5, by instruction rather than by design

v5 is a static landing page. The repo is a site with real routes and a real
backend. These are not design divergences.

- Every `mailto:` CTA in v5 for careers becomes a link to the existing careers routes.
- The waitlist form posts to the existing `/api/lead` with `site` 254, UTM and attribution capture, honeypot, and the existing honest failure states.
- Nav anchors keep v5's in page behaviour on the homepage.
- The service cards link to the existing nine service pages as well as setting the waitlist selection.

## 9. Open compliance questions, to resolve during Section 2

Flagged now rather than discovered later. Each is a place where v5's copy meets a
standing rule.

1. **The footer compliance block.** v5 shows one line: firm registration pending.
   The repo's `registrationLine()` states both pendings, firm registration AND no
   engineer of record in responsible charge, because both gates are live. The
   repo's function wins and the block renders whatever it returns. v5's treatment,
   centred, larger, above the copyright, is what carries over.

2. **"SAM registered".** v5 asserts it in the credibility strip and as a footer
   badge. `BACKLOG.md` records that `samRegistration.registered` is `true` on
   instruction and has never been checked against the live SAM record, and that
   the UEI and CAGE are withheld for that reason. The claim stays gated on the
   existing config flag rather than being hardcoded into the new markup, so
   setting the flag false removes it everywhere at once.

3. **Hero copy.** v5's lede reads "through licensed Texas Professional
   Engineers", which is adjacent to the passive claim pattern
   `by licensed Texas Professional Engineers` in `scripts/lib/regulatory.mjs`.
   The new homepage copy is run through `voice-audit` before it is accepted, and
   where a v5 sentence trips a regulatory pattern the repo's existing compliant
   sentence is used instead. Any such substitution is listed in the Section 2
   report.

4. **"Founding customers join the waitlist for launch pricing."** A pricing
   reference on a firm that cannot yet sell. Checked against the gate in Section 2.
