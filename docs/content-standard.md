# The answer-first content standard

**Robert's GEO ruling of 2026-10-31, item 7.** It applies to every article
under `/insights` and to every page Robert names for it. Articles stay under
`/insights` (his ruling of 2026-10-29, restated in his answer 4 of 2026-10-31);
there are no `/guides/<slug>` pages, and `/guides` is the index that lists
them by topic.

The evidence behind it is the chat counterpart's Ahrefs Brand Radar run of
2026-10-31: 25 Texas questions asked of ChatGPT, AI Overviews, AI Mode, Gemini
and Copilot. The pages those tools quoted answer the question at the top, name
the agency, and link the agency's own page. tdi.texas.gov was cited most.

## What every page carries

1. **The answer in the first 50 words.** The first paragraph answers the
   question the page is for, in 50 words or fewer, before any background.
   Where the page is about a service, that paragraph carries the price and the
   turnaround, both read from `data/catalog.ts`, never typed.
2. **H2s worded as the questions people ask.** Each question a reader brings
   gets an H2 in their words, ending in a question mark. **The rest of the
   headings stay statements**, because CLAUDE.md section 3 and `voice-audit`
   hold question headings to 40 percent of a page's headings, counted with the
   five the article template adds (title, sources, common questions, related
   reading, call to action). Six question H2s need at least five statement H2s
   beside them.
3. **One table.** A real table block (`kind: "table"` in
   `src/content/insights.ts`), for the comparison or the prices the page is
   about. At phone width it stacks into labelled rows, so nothing scrolls
   sideways. Prices in a table are read from the catalog.
4. **Sources linked in the text** to the primary authority the page relies on:
   TDI, TWIA, HUD Handbook 4930.3G or TBPELS, as relevant. Every source is read
   in full before it is cited (Robert, 2026-10-29), and each is listed in the
   page's sources with the claim it supports.
5. **A visible Updated date.** Every article shows "Updated" with its
   `dateModified`, which is the article block's git history as a Chicago day
   (`scripts/emit-guide-dates.mjs`, checked by `guide-dates-audit`). It is
   never typed by hand to a day the wording did not change.
6. **FAQPage JSON-LD equal to the visible questions.** The page's FAQ block
   and its FAQPage markup are built from the same array, so the markup never
   describes an answer that is not on the page.
7. **A link to order.** The order start page for the service the article is
   about (`/order/start/<slug>`), worded so it never claims a line can be
   ordered online when it cannot: the start page says which it is.

The house style laws in CLAUDE.md section 3 apply unchanged: no long dashes, no
hyphen as a sentence connector, no phrase on the voice blocklist, US spelling,
"254 Engineering" as the brand, and no engineer's name or license number on a
public page. A credential is stated through its deriver in `src/lib/launch.ts`
(for the TDI windstorm appointment, `windstormAppointmentStatement()`), so it
reads the register rather than a typed claim.

## What enforces it

- `scripts/proofs/every-insight-is-dated-and-its-questions-are-its-markup.mjs`
  runs in `node scripts/preflight.mjs`. It fails on any `/insights` article
  without a dated, visible Updated line, without visible questions, or whose
  FAQPage is built from anything other than the questions it shows.
- `voice-audit` holds the question heading share, the dashes, the blocklist and
  the regulatory claims on the rendered page.
- `guide-dates-audit` holds each article's dates to its git history.
- `scripts/proofs/the-wpi-8-guide-answers-first.mjs` holds the WPI-8 guide to
  the full standard, item by item, as the worked example.
