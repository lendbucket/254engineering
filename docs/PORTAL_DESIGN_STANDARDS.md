<!--
  COPIED VERBATIM from design-reference/portal/254-brand-standards.md on 2026-09-04.

  This file is the design authority for every portal surface, and it supersedes
  the portal styling that shipped in phases 1 through 8. It is a COPY rather
  than a reference into design-reference/ because that directory holds an
  exported artifact that gets re-exported, and a standards document that can
  change under the code without a commit is not a standard.

  ONE PART OF THIS FILE IS NOT TRUE OF THE PLATFORM AS BUILT.

  The "Product truths" section states six things. Four are true, one is partly
  true and one is false. They are verified line by line, with the evidence, in
  docs/portal-design-port.md. Read that before rendering anything this file
  describes, because two of its statements would put an untrue sentence on a
  regulatory screen if taken at face value.

  The tokens, type scale, spacing, component and voice rules are adopted whole
  and are not in question.
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
- Prelaunch: registration pending → sealing and order intake disabled; public site is waitlist-only.
- Technicians are paid flat-rate on submission, independent of the engineer's decision.
- Engineer decisions (seal / revise / site visit / decline) are equal-weight and pay the same.
- Declines refund everything except the disclosed $175 inspection fee.
- Protocols are versioned; a file is governed by the version it was captured under.
- The responsible charge log is append-only and embeds an evidence hash per decision.

## Build roadmap (for Claude Code)
The prototype (`254 Portal v2.dc.html`) is the design source of truth. These need real backend behavior; UI hooks that already exist in the prototype are noted.

### Identity & access
- SSO optional (provider TBD — not Google) + MFA enforcement; password policy. Hook: sign-in screen, Settings > Security.
- Role-based permissions matrix (owner / engineer / technician / dispatcher), per-module read/write, with an admin screen to manage it. Hook: user-menu "Preferences"; roles shown in header identity block.
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

