<!--
  COPIED VERBATIM from design-reference/portal/254-brand-standards.md on 2026-09-04.

  This file is the design authority for every portal surface, and it supersedes
  the portal styling that shipped in phases 1 through 8. It is a COPY rather
  than a reference into design-reference/ because that directory holds an
  exported artifact that gets re-exported, and a standards document that can
  change under the code without a commit is not a standard.

  THE PRODUCT TRUTHS SECTION HAS BEEN CORRECTED. THE REST IS VERBATIM.

  Six product truths were stated in the export. Four held, one was partly true
  and one was false, and two of them would have put an untrue sentence on a
  screen. They were verified line by line against the code and the schema in
  docs/portal-design-port.md, the operator ruled on 2026-09-04, and the section
  below now says what the platform does.

  The corrections are marked in place rather than made silently. A standards
  file that quietly disagrees with an export somebody else still has open is a
  standards file nobody can trust, and the next reader needs to know which lines
  moved and why.

  The tokens, type scale, spacing, component and voice rules are adopted whole,
  verbatim, and are not in question.

  ON THE DASH RULE. The standing law forbids em and en dashes in anything this
  firm writes. Every one in this file is on a line quoted verbatim from the
  operator's export, and none is in the corrected text. They are left alone
  because a document that claims to be verbatim and is not is worth less than a
  document with a punctuation mark in it, and nothing here is rendered to a
  visitor. Copy taken FROM this file into a component follows the dash rule.
-->

# 254 Engineering Services — Brand & Design Standards

Machine-readable standards for any 254 Engineering Services product surface.
Drop this file into a repo (or paste into CLAUDE.md) so Claude Code builds on-brand.
Visual reference: `254 Brand Standards.dc.html`. Canonical implementation: `254 Portal v2.dc.html`.

## Identity
- Company: 254 Engineering Services LLC (Corpus Christi, Texas)
- Logos: `brand-assets/logo.png` (light backgrounds), `brand-assets/logo-dark.png` (navy backgrounds)
- Status: firm TBPELS registration pending — never show order-taking or sealing as available until it lifts

## Color tokens
```css
--navy: #14315D;        /* primary, headings, sidebar, primary buttons */
--navy-hover: #0E2347;  /* hover/pressed on navy */
--ink-navy: #0B1B36;    /* overlay scrims, device frames */
--gold: #D9A032;        /* warnings, pending, active-nav bar — never decoration */
--gold-bright: #E8B04A; /* progress fills on navy */
--gold-deep: #8D610F;   /* warning text on light backgrounds */
--gold-wash: #FDF6E7;   /* accent tint: the fill behind an explanation, not an alert */
--on-navy: #FFFFFF;      /* text on navy */
--on-navy-muted: #CFD7E3;/* body text on navy, 8.90:1 */
--on-navy-dim: #9DAAC0;  /* labels and metadata on navy, 5.50:1 */
--warn-bg: #FFF9EC;     /* alert background */
--warn-border: #E8D9AE; /* alert border */
--warn-ink: #5C4A12;    /* alert text */
--ink: #333A45;         /* body text */
--secondary: #555E6B;   /* labels, metadata, column headers */
--muted: #8A93A0;       /* footnotes, inert status dots */
--border: #DDE0E4;      /* card borders */
--border-strong: #C3C9D1; /* input/button borders */
--row-rule: #EDF1F7;    /* table row rules, tinted fills */
--row-hover: #F8F9FB;   /* table row hover */
--canvas: #F4F5F7;      /* page background */
--green: #3E7A4E;       /* good status dots ONLY (bg #EEF4EF, border #CBDDCE) */
--red: #B4232A;         /* failures and required-field asterisks, sparingly */
```
Rules: gold appears only in the logo, warnings, pending states, and the active-nav bar.
Green only on status dots. Never gradients. New tints via oklch near these anchors.

## Typography
- Headings & figures: `Archivo` (500/600/700/800). Body & UI: `Open Sans` (400/600/700).
- Google Fonts: `Archivo:wght@500;600;700;800`, `Open Sans:ital,wght@0,400;0,600;0,700;1,400`
- Scale: page display 30/800 Archivo · KPI figure 24/700 Archivo (tabular-nums) ·
  screen title 17/700 · panel title 16/700 · body 13.5–15/400 · metadata 12–12.5 ·
  column header/kicker 11/700 uppercase, letter-spacing 0.08em, color --secondary
- `font-variant-numeric: tabular-nums` on all tables and KPIs. Sentence case everywhere,
  including buttons and column headers.

## Shape & spacing
- Desktop: cards/panels 4px radius, 1px --border, white on --canvas; buttons/inputs 3px radius
- Mobile (390px): cards 12px radius, buttons 8px radius, hit targets ≥ 44px
- Status pills 12px radius; chips/kbd hints 2px; county/select chips 16–18px
- Panel padding 16–22px; table rows 10–13px vertical; page gutters 28px desktop / 16px mobile; section gap 20px
- No shadows on cards. Shadows only on overlays: menus/dropdowns `0 8px 24px rgba(20,49,93,.18)`,
  modals/toasts `0 12–24px 32–60px rgba(11,27,54,.35–.5)`
- No accent borders (top/left) on cards. Alerts are full tinted boxes (--warn-bg + --warn-border + icon)

## Components
- Primary button: navy bg, white text, 700 weight. One per view region.
- Secondary: white bg, --border-strong border, navy text. Toolbar: 12.5px, 6x12 padding.
- Status: 7px dot + 12–12.5px text. green=good, gold=pending/warning, navy=in motion, gray=inert, red=failed.
- System alert: bold lead-in naming the condition ("Restricted mode."), then what is/is not affected.
- Absent data: dashed-border italic chip "not recorded" — never render a missing figure as 0 or $0.
  Exclude absents from totals and footnote the exclusion.
- Tables: uppercase 11px headers, sortable with ▾ caret, row hover --row-hover, count + pagination
  footer ("Showing 1–14 of 14 · Rows per page: 25"), Filter/Export/column-config toolbar.
- Records: breadcrumb → header band (ref, status pill, actions, labeled field grid) → History
  timeline (dot rail, actor + timestamp per event).
- Desktop chrome: 230px navy sidebar (icon + label, 3px gold active bar), 58px white header
  (title · "Data as of …" · search/Ctrl-K · bell · help · avatar user menu), version footer.
- Mobile chrome: navy status bar + header, bottom tab bar (gold top-bar on active), home
  indicator, "Last synced …" line.
- Documents/letters: white 760px sheet, letterhead + 2px navy rule, findings box, PE seal +
  signature block, small-print record note.

## Voice
- Terse, neutral, factual. State the condition, then the consequence.
- Middle dots (·) separate metadata; em dashes introduce a cause.
- Explicit timestamps ("Sep 3, 11:42 AM"); no currency decimals under $10,000.
- Never: exclamation marks, emoji, reassurance, cleverness, or copy that explains the
  design's own philosophy. "Action required", not "Needs you!".

## Product truths (do not contradict)

Corrected against the code on 2026-09-04. Four of the six statements in the
export held; the two that did not are rewritten below with the original quoted,
because a correction with no trace looks like a rule nobody set.

- **Prelaunch: registration pending, so sealing and order intake are disabled and
  the public site is waitlist only.** Unchanged. One function, `isPrelaunch()`,
  and one variable, `LAUNCH_MODE`.

- **Technicians earn a flat rate per job, written to the ledger on submission,
  independent of the engineer's decision. An operator approves and pays it
  later.**
  *Export said: "Technicians are paid flat-rate on submission."* The entitlement
  is written on submission by `submitEvidence`, before any engineer has looked at
  the package, and nothing in the decision path can touch it. It lands as
  `status: 'pending'` and an operator moves it to approved and then paid, so
  "paid on submission" overstates it. The prototype's own technician pay screen
  says "written on submission" and is the wording to follow.

- **Engineer decisions are equal weight: a refusal never earns the firm more than
  a seal.** `refundFor` carries three invariants that `order-audit` enforces, and
  the middle one exists precisely so an engineer never decides under financial
  pressure. "Pay the same" is not contradicted and is not implemented: there is
  no engineer pay ledger, so nothing pays engineers differently because nothing
  pays engineers yet. Do not render an engineer earnings figure.

- **A decline refunds in full unless a technician actually attended, in which
  case the disclosed inspection fee for that service is retained and the customer
  receives the engineer's findings.**
  *Export said: "Declines refund everything except the disclosed $175 inspection
  fee."* That describes one of four cases as though it were the rule:

  | What happened | The customer receives |
  | --- | --- |
  | Declined before any visit or review | Full refund, nothing retained |
  | Declined after desk review, no visit | Full refund, nothing retained |
  | Declined after a technician attended | Refund less the inspection fee, plus the findings |
  | Cancelled by the firm | Full refund, including any inspection already done |

  **The fee is per catalog entry, not a constant.** `inspectionFeeCents` is set on
  each service line and is `17500` on two of them today. Never hard code $175, and
  never compose refund copy by hand: render the `explanation` string `refundFor`
  returns, so the screen and the ledger cannot disagree.

- **Protocols are versioned; a file is governed by the version it was captured
  under.** Unchanged and verified. `eng_protocol_templates` carries `version` with
  `unique (service_slug, version)`, and `eng_files.protocol_template_id`
  references it `on delete restrict`.

- **The responsible charge log is append only, enforced by a database trigger.**
  *Export said: "...and embeds an evidence hash per decision."* **It does not.**
  Nothing computes an evidence hash and nothing stores one; every "hash" in the
  schema is a credential. The Evidence hash column and the sentence claiming it
  are dropped by operator ruling, because a fabricated cryptographic assurance on
  the firm's regulatory record is the worst possible place for one. The
  immutability half is true and stays: `eng_rcl_immutable` refuses UPDATE and
  DELETE, and `migration-audit` replays the table and asserts the refusal.
  Real evidence hashing is in BACKLOG and is worth building.

## Roles

Three, not four. `ROLES` in `src/lib/ops-authz.ts` is `admin`, `engineer`,
`field_tech`, labelled Administrator, Professional Engineer, Field Technician.

There is no owner role and no dispatcher role. Dispatch is a capability inside
the administrator role, surfaced by `DispatchPanel` on a file, not a person who
signs in. The export's permissions matrix names four; it belongs to the unbuilt
Settings screen and is not ported.

## Two rulings made while porting, recorded so they do not read as omissions

Operator, 2026-09-04, at gate 2A.

### The restricted mode statement has one wording, and screens add to it

Three screens carried three different descriptions of the compliance gate: the
dashboard, the files list and the review queue each said it in their own words.
All three were accurate. One statement of the same fact in three forms is how
three forms drift, and only one of them was covered by an audit.

There is now one component, `RestrictedMode`, and its sentence is fixed:

> **Restricted mode.** Firm registration is pending with TBPELS. Sealing and
> order intake are disabled until an engineer of record is in responsible charge.

A screen with something ADDITIONAL and specific passes it as `also`, appended
below the shared sentence. It may never restate the shared part in its own
words. The review queue's addition is the one worth reading, and it is the
reason the `also` prop exists rather than the copy simply being deleted:

> Packages can still be reviewed, sent back and declined. Declining stays
> available on purpose: a gate that stopped an engineer saying no, while
> leaving yes open, would be the wrong way round.

The component reads `isPrelaunch()` itself and returns null once the gate
lifts, so callers render it unconditionally and there is nothing to remove on
launch day.

### The screen title stays in PageHead and is not repeated in the header

The chrome rule above specifies a 58px header carrying the screen title. It is
not implemented, deliberately.

`PageHead` renders the title directly below the header, and it did so before
this design existed. Putting it in both is the same word twice, forty pixels
apart, on screens already dense with real information. The chrome rule was
drawn against a prototype that had no PageHead; where the two disagree, the one
that leaves the screen less repetitive wins.

The header keeps what only it can carry: the data-as-of time, search, the bell,
and the user menu.

## The sealed letter is not built, and the sheet is

The export has two document screens. Only one of them can be built honestly
today, and this is recorded here so the absent one does not read as an
oversight.

**The sealed letter is not built.** Nothing in this platform produces one: every
deliverable is an uploaded file, there is no letter generator, no seal image and
no signature block, and `isPrelaunch()` stops a file reaching `sealed` at all
while the registration is pending. A screen rendering one would be a picture of
a document that cannot exist, carrying a seal for an engineer who has reviewed
nothing. That is the evidence hash finding in a worse place, because a sealed
engineering letter is the actual regulated artifact.

**The document sheet is built**, over the evidence binder, which has been
assembled from real rows since Phase 6 and had only ever existed as a CSV.
`DocumentSheet`, `SheetLetterhead` and `SheetRecordNote` are in use at
`/portal/documents/binder/[fileId]`, so when a sealed letter becomes real it is
a page rather than a system.

The binder's own limitations note is the model for how a document here talks
about itself: it says it is not an engineering opinion, that it is not sealed,
and that no sealed deliverable exists for the file. BACKLOG carries what has to
be true before the letter can be built, in order.

## There is no 403, deliberately

The export draws one. It is dropped, and the reason is recorded here so a later
reader does not restore it as a missing screen.

Every portal route answers `notFound()` when a role may not see it, and
`security-audit` asserts that a refusal is indistinguishable from a route that
does not exist. A 403 saying "you do not have permission to view this" confirms
the page exists to somebody who should not know that, which is a regression
against a rule the harness already enforces. The 403's visual treatment is
carried into the 404 so nothing about the design is lost.

## The native standard at 390

Operator ruling, 2026-09-05, Phase 11 Section 2. Written down before anything
was built against it, because it is the thing the operator has been unable to
describe mechanically and the session will be held to it on every screen.

**The distinction it exists to capture.** The audits already assert no
horizontal overflow and no tap target under 44px. Both pass on every portal
screen today, and neither is what the operator is describing. A document that
scrolls as one page with a bar fixed to the bottom is a website that fits. An
application has fixed chrome and a scrolling content region between it.

Each of the nine points below is a check somebody can fail. Where the current
state is already known it is recorded beside the rule, so the gap is visible
rather than discovered.

### 1. The page never scrolls; the content region does

The header and the bottom tab bar are fixed. Only the region between them
scrolls, and it scrolls to its own bounds rather than the document's.

The test: at 390, `document.documentElement.scrollHeight` equals its
`clientHeight` on every portal route, and a named scrolling element between the
chrome has `scrollHeight` greater than its own `clientHeight` wherever the
content is taller than the region.

*Today:* the header is `sticky top-0`, not fixed, and `<main>` is in ordinary
document flow with `pb-[calc(88px+env(safe-area-inset-bottom))]` to clear the
tab bar. So the document is what scrolls, and the header rides along on
stickiness. This is the single largest thing between the portal and feeling
native, and it is the one point that touches every screen at once.

### 2. Nothing scrolls sideways without saying so

No horizontal scroll at document level or inside any container, unless the
container is a deliberate horizontally scrolling component that shows its own
affordance.

Content clipped with no affordance is the defect this repository has now found
three times: the rail clipping its own navigation, the notification list and
command palette clipping theirs, and two data tables scrolling sideways with
nothing to focus. An affordance is a visible scrollbar, a fade the component
owns, or a control; it is not the reader discovering it by dragging.

*Today:* `mobile-overflow-audit` already holds document level scroll at 360 and
390 across every route, and it passes. Containers are the gap.

### 3. Safe areas, top and bottom

Nothing sits under the notch or the home indicator. Padding comes from
`env(safe-area-inset-*)` rather than from a guessed constant.

*Today:* the header carries `pt-[env(safe-area-inset-top)]` and the tab bar and
main carry the bottom inset. This point is close to met and becomes a check
rather than work.

### 4. Tables become cards

A table that scrolls sideways on a phone is a desktop table on a phone. Every
operator screen with a table needs a card layout at 390 carrying the same
information in reading order, which means the same facts, in the order somebody
reads them, not a subset chosen by which columns fit.

*Today, and smaller than it sounds:* most portal screens already render `ul` and
`li` cards rather than tables. Exactly two use a raw `table`, the dashboard and
billing, both at a `min-width` inside a horizontal scroller. There is also a
`DataTable` primitive in the design system which is itself a sideways scrolling
table at `min-width: 640px` and which **no screen uses**. It either becomes the
card-and-table component this point requires, or it is deleted; leaving an unused
primitive that violates the standard is how the standard gets broken later by
somebody reaching for the obvious component.

### 5. Modals and pickers are sheets

They present from the bottom, sized to their content, dismissible by dragging,
and never as centred desktop dialogs.

The test is behavioural, not visual: the panel is anchored to the bottom edge, it
does not exceed the content it holds, and a downward drag closes it.

### 6. Every interaction has a pressed state, and nothing needs hover

There is no hover on a touch screen. Any affordance that only becomes
discoverable on hover is invisible to the person the portal is mainly for.

*Today, and the first version of this line was wrong.* It said the portal
contained two `active:` rules and that effectively nothing had a pressed state.
That counted Tailwind `active:` utility classes in portal component files and
missed the rule that actually provides the feedback: `globals.css` carries
`-webkit-tap-highlight-color: transparent` plus `opacity: 0.72` on `:active`
for every link, button, `[role=button]` and label, with a reduced motion
variant, and it has done all along. The floor was already met.

The correction is left visible rather than edited away, because the check built
on the wrong claim was itself wrong in the same direction: it collected every
`:active` selector, stripped the `:active`, and asked whether each control
matched what remained. Since one rule declares the state for all of them,
stripping left the bare selectors `a` and `button`, so every control passed and
would have gone on passing if the rule were deleted.

What is genuinely thin is the treatment on the primary controls, where a global
opacity dim is weaker than a ground change, and anything tappable that is not an
`a`, `button`, `[role=button]` or `label`.

### 7. The keyboard is handled

A focused input is never covered by the keyboard. The composer and any
bottom-anchored control move with it. Inputs are at least 16px so focusing one
never zooms the viewport.

*Today:* the 16px half is already met; no portal input is below it. The moving
half is not built, and it matters most in the messaging composer, which is
Section 3.

### 8. Long lists are paginated or virtualised, and remember where they were

A list that can grow renders a bounded number of rows, and its scroll position
survives navigating away and back.

*Today:* the files list renders everything it is given with no limit and no
cursor. With the row counts the firm has now this is invisible; it is the kind
of thing that is only ever noticed on the day it is a problem.

*The remembering half is built and asserted*, as of 2026-09-06.
`src/components/portal/ScrollMemory.tsx` is in both shells: a forward navigation
opens a screen at the top, and back or forward restores what that screen had.
`native-audit` presses a tab, goes back and reads the position, on a screen it
has measured as scrollable first.

### 9. Every desktop action is reachable on a phone

The operator's requirement is that the firm can be run remotely. An action that
exists only on a wide screen is a gap rather than a choice, and each one is
either given a mobile equivalent or has its reason recorded here.

The enumeration, taken from the code rather than from memory. Fourteen elements
in the portal are hidden below `lg`:

| Element | Where | Verdict |
| --- | --- | --- |
| The navigation rail | `layout.tsx` | Has an equivalent: the bottom tab bar plus the More sheet. |
| The search button with its Ctrl K hint | `PortalChrome` | Has an equivalent: the search icon at `lg:hidden` opens the same palette. |
| "Data as of" timestamp | `layout.tsx` | Informational, no action. Acceptable to omit, recorded here so it is a decision. |
| Column labels and secondary columns | files, messages, onboarding, protocols, review, `surfaces.tsx` | These are the table and list headers that point 4 governs. Their information has to appear in the card, not disappear. |
| `desktopOnly` columns | `DataTable` | Same, and the primitive is unused, so this resolves with point 4. |

Nothing in that list is an action with no mobile route today. The risk this point
guards is future work, so it becomes a standing check rather than a repair.

### How this is audited

`mobile-overflow-audit` already walks every portal route at 360 and 390 with a
real session in three roles. Points 1, 2, 3 and 4 are assertable there or in a
companion: document scroll height equals viewport height, a named scroll region
exists and scrolls, computed padding reflects the safe area insets, and no
`table` element is visible at 390.

Points 5, 6, 7 and 8 are assertable but not by looking at a resting page: they
need an interaction. Point 6 in particular is checkable statically as a floor
(every interactive element declares a pressed state) and behaviourally as a
ceiling (the state actually applies on touch), and the floor is worth having
first because it is what fails today.

Point 9 is a coverage check of the same shape as the perimeter list: every
element hidden below `lg` is either in the table above or the audit fails, so a
new desktop-only affordance cannot be added without a ruling.

### What is built, and what each check does not cover

Recorded 2026-09-05, after Section 2 built against this standard.

| Point | State | Asserted by |
| --- | --- | --- |
| 1, the page never scrolls | Built | native-audit, 24 screens: zero document scroll, one named region, chrome outside it, anchored to both edges |
| 2, nothing scrolls sideways silently | Built | native-audit: every element wider than itself must declare an overflow AND take focus |
| 3, safe areas | Already met, now held | native-audit: both insets declared |
| 4, tables become cards | Built | native-audit: no visible table element at 390 |
| 5, modals are sheets | Built | native-audit: the More sheet is opened on every screen and measured |
| 6, pressed states | Already met globally, treatment improved | native-audit: controls are pressed and compared |
| 7, keyboard aware | HALF BUILT | nothing |
| 8, bounded lists | Half asserted | native-audit: visible row count |
| 9, desktop only affordances | Built | native-audit: coverage against a written table |

Two of those need saying plainly rather than being read off a table.

**Point 7 is half built and asserted by nothing.** The 16px half was already met.
KeyboardAwareComposer exists, uses visualViewport because on iOS the software
keyboard does not resize the layout viewport and a resize listener therefore
never fires, and it is exported. No screen renders it yet, so it has never run
in a browser and no check exercises it. It was built before Section 3 because
the messaging centre needs it and building it there would mean building it in a
hurry; that is a reason to have written it, not evidence that it works.

**Point 8 was asserted on one of its two halves, and now on both.** A visible
row count catches a list that grew. Scroll position surviving navigation needed
a navigation and a return, which is a different shape of test, and claiming it
from a resting page would have been the kind of check this phase exists to
remove. It was built and asserted in the closeout on 2026-09-06: the audit
scrolls a screen it has measured as scrollable, presses a tab the way a person
does, and comes back. The bounded half is still true of the row count only, and
the files list still has no cursor.

**What none of this asserts** is whether the result feels like an application.
That is `docs/portal-screen-verdicts.md`, and Section 2 ends by filling in the
twenty three blank rows.

## Build roadmap (for Claude Code)
The prototype (`254 Portal v2.dc.html`) is the design source of truth. These need real backend behavior; UI hooks that already exist in the prototype are noted.

### Identity & access
- SSO optional (provider TBD — not Google) + MFA enforcement; password policy. Hook: sign-in screen, Settings > Security.
- Role-based permissions matrix, per-module read/write, with an admin screen to manage it. Hook: user-menu "Preferences"; roles shown in header identity block. NOTE: the export said owner / engineer / technician / dispatcher. The platform has three roles, admin / engineer / field_tech. See Roles above.
- API keys + webhook management for partners (title companies, insurers).

### Compliance & audit
- Full audit trail on every entity (actor, timestamp, old→new value) — generalize the responsible charge log pattern. Hook: file History timeline, Charge log screen.
- Data retention policy + legal hold on files.
- SOC 2-style access logs with export.

### Operations
- Notification system: per-user channel preferences (email/SMS/push per event type), digests. Hook: bell dropdown, toasts.
- SLA engine: configurable targets (offer response 4h, review 48h) with breach escalation feeding the dashboard "Action required" list, rule-driven and ranked.
- Bulk actions: multi-select table rows → dispatch / export / assign. Hook: all module tables.
- Saved views and filters per user on every table. Hook: Filter/column-config toolbar buttons.

### Money
- Stripe integration: payment capture, refund retries (the failed-refund exception is designed), disputes, payout reconciliation, technician 1099 generation.
- Accounting export (QuickBooks) from the Billing ledger.

### Scale details
- Global search index behind the Ctrl-K palette (files, clients, actions already modeled).
- Offline queue + optimistic UI for the technician app — the "queued, waiting for signal" capture states are the designed contract.
- Feature flags + environment banner. Hook: "Environment: Production" in the version footer.
- Scheduled email reports once ≥3 months of history exist (Reports module already refuses to extrapolate from less).

