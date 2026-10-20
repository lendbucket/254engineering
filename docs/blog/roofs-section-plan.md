# Roofs section plan

Written 2026-10-18. Keyword figures for posts 1 and 2 are the operator's figures supplied with the brief (about 2,500 a month at very low difficulty for "roof inspection cost", about 450 a month at very low difficulty for "how old is my roof"). Every other primary keyword below is **unmeasured**: no Ahrefs call was made in this session, by standing preference, and the operator's chat session is where those pulls happen. New posts live in `src/content/insights-roofs.ts` (a `roofInsights` array pushed into `insights` after the buyers push, the way `insights-coastal.ts` is wired) and are registered in `data/keyword-registry.ts` with status `planned`. A new section value, `roofs`, is added to `sectionOf()` so related reading ranks these posts together.

Branch `content/blog-roofs`, cut from `origin/main` at 3a336fe.

Pages checked for competition: the 27 posts in `insights.ts` and `insights-coastal.ts`, `/services/roof-inspections` (`src/content/services.ts`, title "Roof Certification in Texas, Sealed"), `/structural-engineer/cost`, `/process`, the registry, and the rulings in `docs/keyword-mapping.md` (target 6 "roof certification" is ruled to `/services/roof-inspections`; target 7 "roof certification cost" is ruled **build**).

## Decisions

| # | Primary keyword | Existing page it could compete with | Distinct angle, or fold | Internal links planned |
| --- | --- | --- | --- | --- |
| 1 | roof inspection cost (about 2,500, very low KD, operator's figure) | /services/roof-inspections (owns "roof certification"); /structural-engineer/cost (owns "structural engineer cost"); /insights/pre-purchase-home-inspection (roof section) | **Write.** Three people who inspect roofs and the document each fee buys: the TREC inspector's roof duties and exclusions under 22 TAC 535.227 and 535.228(c), a contractor's estimate and TDI's rules on deductibles and public adjusting, the engineer's sealed opinion under Occ. Code 1001.003, 1001.301, 1001.401 and rule 137.33. Prints 254's price and coastal line through `priceSentence()` and `coastalLine()`, and what moves it through the price book's own `whatChangesIt`. Takes "roof certification cost" (mapping target 7) as a supporting term. | /services/roof-inspections, /structural-engineer/cost, pre-purchase-home-inspection, roof-certification-vs-wpi-8, new 5, new 6, new 7 |
| 2 | how old is my roof (about 450, very low KD, operator's figure) | none | **Write.** Five records and what each proves: the contract or invoice, a city re-roof permit (Arlington's bulletin as the cited example), a manufacturer's bundle date code (GAF TAB-R-129), the CLUE claim history (TDI), the seller's disclosure notice (Prop. Code 5.008 item 1); a coastal windstorm certificate as a dated record; what an inspector is not required to determine; how this firm's engineer treats a reported age. | /services/roof-inspections, pre-purchase-home-inspection, texas-windstorm-certificate-lookup, new 3, new 7 |
| 3 | roof certification for a home sale (unmeasured) | /services/roof-inspections ("roof certification"); roof-certification-vs-wpi-8 ("roof certification for insurance"); pre-purchase-home-inspection (supporting term "roof inspection before buying a house"); Sealed Engineering's "what a roof certification letter covers" | **Write, narrowly.** The sale contract does not name one; who in Texas can sign one (TREC inspector limits, a contractor's letter, the seal); what this firm's sealed letter states and the five things it is not; timing inside the termination option; the seller's notice. Not a restatement of the service page: no field method, no FAQ overlap. | /services/roof-inspections, roof-certification-vs-wpi-8, structural-engineer-report, pre-purchase-home-inspection, new 4 |
| 4 | option period inspection (unmeasured) | pre-purchase-home-inspection (the buyer's view of the same window); structural-engineer-report (agents reading a report) | **Write, for agents.** When to suggest a roof or structural engineer during the option period, when not to, how the online roof order runs (qualifying question, address, the engineer's questions and uploads, terms, payment), naming the addressee at the start, what the agent and client receive. Foundation questions are pointed to the existing foundation pages. | /services/roof-inspections, /services/foundation-inspections, pre-purchase-home-inspection, structural-engineer-report, foundation-inspection-cost, new 3, new 7 |
| 5 | engineer letter for roofers (unmeasured) | windstorm-inspection-for-roofers (primary "windstorm inspector"; coastal paperwork) | **Write, and link the windstorm post rather than repeat it.** Insurer requests (TDI), a re-roof over an existing layer under the adopted IRC as Arlington applies it, deck questions and where framing adequacy becomes a structural letter, how a roofer starts an order, the price, where the sealed letter goes, the open claim exclusion, TDI's rules on public adjusting and deductibles. Renders `windstormAppointmentStatement()`. | /services/roof-inspections, /services/structural-letters, windstorm-inspection-for-roofers, roof-certification-vs-wpi-8, new 6, new 7 |
| 6 | hail damage roof inspection (unmeasured) | inspection-vs-forensic-report (coastal documents); hurricane-damage-insurance-claim (policy and peril) | **Write.** Who looks at a roof after hail and what each decides: the adjuster under Ins. Code 4101.001 and 4101.051, the engineer as technical assistance under 4101.002(a)(3)(B), the roofer under the rules TDI states, the home inspector under 535.228(c). States that this firm's roof line does no cause of loss work and declines an open claim. Promises no claim outcome. | /services/roof-inspections, inspection-vs-forensic-report, hurricane-damage-insurance-claim, new 5 |
| 7 | roof inspection process (unmeasured) | /process (the firm's five steps across all lines); /services/roof-inspections | **Write.** The roof line's real app flow, read from the code: the qualifying question, the address step, the engineer's questions and uploads, the hold for flagged answers, price and terms (the refund lines are `refundDisclosure()` itself), Stripe's hosted payment, the confirmation email, the technician's checklist and photographs, the five determinations, the electronic seal under rule 137.35, the PDF on the order page. No timeframe is printed; the one sentence about timing is the catalogue's own. | /services/roof-inspections, /process, roof-certification-vs-wpi-8, structural-engineer-report, new 1, new 3 |

## Rulings before the board, 2026-10-18

The operator pulled Ahrefs in chat on 2026-10-18 (US) and ruled five changes before the board. The table above is the plan as written; this section is what shipped.

| Keyword | Volume, KD | What changed |
| --- | --- | --- |
| hail damage roof inspection | 1,700, KD 0 | Post 6 unchanged |
| roof inspection for insurance | 600, KD 2 (top page traffic 2,000) | **New post 8**, cited to TDI: "Insurance and your roof", "Was your home insurance canceled or not renewed?" and the Consumer Bill of Rights, 28 TAC 5.9971(b) Figure 1. Sits beside roof-certification-vs-wpi-8 ("roof certification for insurance"), which is about the two coastal documents; post 8 is the insurer's own inspection |
| roof certification | 500, KD 0 (traffic 1,400) | Already owned by /services/roof-inspections (registry topic "roof inspection and certification", mapping target 6), so post 3 was **not** retargeted to it |
| roof certification cost | 200, KD 0 | A section of post 1, with a FAQ, not a post |
| roof certification letter | 50 | **Post 3 retargeted** here: slug, title, H1, description and primary keyword. The service page's registry evidence also lists it as a supporting term |
| roof inspection process | 50 | Post 7 unchanged |
| texas option period | 20 | Noted on post 4's entry |
| option period inspection, engineer letter for roofers, roof certification for home sale | none measurable | Posts 4 and 5 kept as written, as outreach pages for agents and roofers rather than search targets, noted in their registry entries |
| structural engineer inspection cost | 700, KD 0 | No change. Served by /structural-engineer/cost, which renders the price book; the buyers section folded a post on it into that page, and the registry records the fold in the buyers block rather than as an entry of its own |

The stance flag in the notes below is ruled: the posts describing online ordering fit reading A, ordering as a door on a capability page. "Would become a tool in that claim" stays, and the protocol's own word is not used.

## Topics folded

None of the seven briefed topics is folded. Two are written narrowly because existing pages sit close:

- **Topic 3** sits between `/services/roof-inspections` ("roof certification") and `roof-certification-vs-wpi-8` ("roof certification for insurance"). It is written for the sale transaction only and does not restate the service page's method or FAQ.
- **Topic 5** does not repeat `windstorm-inspection-for-roofers`. It links it once for the coastal paperwork and covers only the inland and insurer questions.

## Claims dropped for want of a primary source

- That Texas does not license roofing contractors statewide. No primary source was read in this session; the roofer post says nothing about roofer licensing.
- National average price ranges for roof inspections. Only quote platform figures exist; a `note` block says so, as the foundation cost post does.
- How long an insurer or lender treats a roof letter as current. Not stated.
- What shingle manufacturers other than GAF print on a bundle or shingle. Only GAF's TAB-R-129 was read; the post names it as one manufacturer's convention.
- That a city provides a permit history on request. The post tells the reader to ask the building department and claims nothing about what it will produce.
- The full text of the 2021 IRC R908.3 and R908.3.1.1. The ICC page was not fetched; the rule is stated only as the City of Arlington's bulletin applies it, cited to that bulletin.
- TREC form 20-18 paragraph 7F (who may perform agreed repairs). Only the 20-8 edition's text could be read, so it is not used. Paragraph 7A and the termination option are cited exactly as the buyers posts cite them.

## Notes for the session that runs the build and audits

- Seven posts written. Titles 50 to 60 characters and descriptions 140 to 160, counted in the commit report.
- **No price is typed.** The roof price and the coastal line render through `priceSentence("roof-inspections")` and `coastalLine("roof-inspections")`, the pair the cost page and /process already use, and what moves the price through `priceFor(...).whatChangesIt`. The refund terms in post 7 are `refundDisclosure()` from `src/lib/ops-orders.ts`, the same lines the order form shows before payment.
- **The calls to action are derived.** Each body CTA reads `lineOffer("roof-inspections")`: when the line is orderable it links `/order/start/roof-inspections` with the words "start the roof certification online"; otherwise it links the quote path `lineOffer()` already returns. No sentence matches the OPEN_GATED patterns in `scripts/lib/regulatory.mjs` in either mode. The page's own `OfferCta` renders below every post unchanged.
- The open insurance claim exclusion is described as the signed protocol's, in the words "would become a tool in that claim". The protocol's own word is on the brief's banned vocabulary list, so it is not used.
- `$1,000` in posts 5 and 6 is the contract notice threshold TDI states for Bus. & Com. Code 27.02, cited to TDI. It is not a firm price.
- The registration renders through `registrationStatement()` (posts 3, 4, 7) and the appointment through `windstormAppointmentStatement()` (post 5). No engineer is named and no licence, registration or appointment number is typed.
- Protocol content (254-RC-001 v1.1) is paraphrased, never quoted, so `no-protocol-sentence-reaches-the-order-form`'s intention that protocol text not reach a public page is kept. No threshold from Appendix C is printed.
- The 254 brand stance in the registry says "Never writes an ordering page." Posts 4, 5 and 7 describe how the online order runs because the operator's brief asked for it. Flagged for a ruling rather than resolved here.
- Registry entries sit after the buyers block, before "Texas engineering firm registration", each topic equal to the post's `primaryKeyword`, cluster `roofs`, status `planned`. Whoever merges sets them to `live`.
