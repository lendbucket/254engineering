# 254 Engineering: Design v10 (portal and site restyle)

Operator: Robert Reyna. Approved 2026-09-28. Reference screens are in `docs/design-v10/screens/`.

This supersedes the color tokens and typefaces in `docs/PORTAL_DESIGN_STANDARDS.md`. Everything else in that file (voice, product truths, accessibility, the dash rule) stays in force.

## Ground rule for the build

This is a presentation change. It must not change what any screen does, what it stores, what it gates, or what it says is available. Every audit, fixture and board that passes today must pass after. If a restyle would need a logic change, stop and report it instead.

## Tokens

| Token | Value | Use |
|---|---|---|
| navy | #012758 | header bar, primary buttons, selected states, step bar done |
| gold | #D6A62A | 3px rule under the header bar, active nav marker, current step. Never decoration |
| gold-deep | #CA8A03 | logo only |
| ink | #161B22 | body text, headings, section rules |
| sub | #4B5563 | secondary text |
| faint | #6B7280 | labels, metadata |
| mute | #9AA3AF | disabled, taken time slots, second chart series |
| line | #D3D8DF | input borders, table header rule |
| line-2 | #E6E9ED | row dividers |
| page | #FFFFFF | desktop page ground |
| phone-ground | #F2F4F7 | phone page ground behind white sections |
| link | #0B4F8A | links |

**A selected row is marked by a navy left bar only. Operator ruling, 2026-10-08.** The grey selected-row fill (`select`, #F3F4F6) this table carried until that day is removed: a tinted row inside main is the tinted box this system refuses, and the bar says selected without it.

**A map may carry colour, and only a map. Operator ruling, 2026-10-09.** Colour is permitted on swatches and map features inside an element marked `data-v10-map`, never on text and never as a background behind content. A swatch is an empty element: anything holding text or children inside the map is held to every rule below. The coverage map on /portal/techs is the one marked element today. v10-layout-audit accepts colour only there, and counts what it excuses.

No status colors. No red, green or amber anywhere in the UI. Urgency is shown with weight (bold) and words ("Overdue 4h"), never with color, dots, badges or tinted boxes. Brand navy and gold are the only colors.

## Type

Inter, weights 400, 500, 600, 700. No monospace anywhere, including file numbers, times and money.

| Role | Size / weight |
|---|---|
| Page title | 24 to 28 / 600, letter spacing -0.4 |
| Section heading | 15 / 600 |
| Body | 14 to 15 / 400 |
| Label | 12 to 13 / 600 |
| Metadata | 12 / 400 faint |

## Layout rules

1. No boxes. Sections are a heading with a 2px ink rule under it, content below, separated by whitespace. No cards, no shadows, no rounded panels, no tinted backgrounds.
2. No notices or banners. Status goes in a plain line of text under the page title (the meta line).
3. No side summaries. Order flow is one centered column, 760px.
4. Choices are rows with a radio, separated by a 1px line-2 rule. Not bordered cards.
5. Inputs keep a 1px border. Buttons are square (2px radius), 36 to 52px tall.
6. Desktop shell: navy top bar with logo and portal name, 3px gold rule, left nav, white page.
7. Phone: navy top bar, gold rule, full-width white sections on the gray ground, fixed bottom action bar, bottom tabs where the role has them.
8. Tables: no header fill, 1px line under the header, 1px line-2 between rows, right-align numbers.

## Wording rules

- No em or en dashes.
- No promised dates for a letter or decision. Say "Waiting on engineer review" and "We email you when it is issued". Never "estimated", "expected by" or "typically N days".
- Visits are booked at an exact start time ("Thursday, October 1 at 9:30 AM"), never a window.
- The letter is addressed to the recipient and purpose recorded at intake, and the order flow says so.
- The letter is not a warranty and does not predict remaining life. The insurer or lender decides how to use it.
- Card copy: "Card payments are processed by Stripe. 254 Engineering does not store card numbers."
- Text reminders are a separate opt-in with "Message and data rates may apply. Reply STOP to opt out."

## Components

- Section: heading 15/600, right-side links 13/400, 2px ink rule, content.
- Meta line: 14/400 sub, items separated by 20px space.
- Step bar: 3px top rule per step, navy done, gold current, line-2 later. Number plus name.
- Radio row: radio, title 15, optional sub 13, optional right value.
- Time slot grid: 6 across, 46px buttons, selected navy fill, taken shown struck through in mute.
- Numbered list: number in navy 600, title 600, description sub. Used for "How it works", "Before the visit", "What happens next".
- Timeline (tracker): 14px circles, navy filled done, navy ring current, mute ring later, 2px connector.
- KPI row (staff dashboards): label, value 26/600, change in faint text, sparkline. No dividers, no color.
- Keyboard hints: small bordered key caps, faint text.

## Screens by stage

| Stage | Screens |
|---|---|
| 1 Customer | V10-login, V10-signup, V10O-property, V10O-service, V10O-visit, V10O-pay, V10O-done, V10O-pay-phone, V10C-orders, V10C-tracker |
| 2 Technician | V10T-today, V10T-checklist, V10T-capture, V10T-sentback |
| 3 Engineer and admin | V10E-queue, V10E-review, V10E-log, V10E-queue-phone, V10A-dashboard, V10A-file, V10E-seal (last, after Aman uploads his own seal) |
| 4 Customer service | V10S-inbox, V10S-customer (new role, refunds are requests only) |

Sample names, addresses and numbers in the screens are illustrative. Real data comes from the platform.

### V10-verify-phone was dropped, 2026-10-01

**Operator ruling: do not build it.** It was in the stage 1 row above and has been
removed from it, so the list and the work agree.

**Why it is recorded rather than deleted.** A drawn screen that disappears from
this document without a trace reads as a screen somebody forgot, and the next
session to compare the design folder against the stage list would find an
artifact with no entry and reasonably build it. The same reasoning keeps the
Newsreader ruling and the keyword ownership model written down in CLAUDE.md.

**What was actually there, established before the ruling rather than assumed.**
Nothing. Searching `verify_phone`, `phone_verified`, `verifyPhone`, `otp` and
`OTP` across `src`, `data` and every migration returned only the STAFF second
factor: TOTP through an authenticator app on the portal surface, which is neither
a telephone number nor a customer screen. A customer's phone has always been a
plain field on sign up and at checkout, never verified. So this was a screen to
build, not one to restyle, which is what brought it to a ruling.

**And the ruling says where the confirmation goes instead.** If text reminders
are added later, the number is confirmed by the customer replying YES to the
first message, as part of that opt in. That is one step rather than two, it makes
the consent and the confirmation the same act, and it means no separate screen is
owed. The artifact in `design-reference` stays with this verdict beside it, so
nobody rebuilds it by accident.
