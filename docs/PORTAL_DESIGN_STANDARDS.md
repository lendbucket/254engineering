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

## There is no 403, deliberately

The export draws one. It is dropped, and the reason is recorded here so a later
reader does not restore it as a missing screen.

Every portal route answers `notFound()` when a role may not see it, and
`security-audit` asserts that a refusal is indistinguishable from a route that
does not exist. A 403 saying "you do not have permission to view this" confirms
the page exists to somebody who should not know that, which is a regression
against a rule the harness already enforces. The 403's visual treatment is
carried into the 404 so nothing about the design is lost.

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

