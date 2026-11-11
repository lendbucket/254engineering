# FDD inputs packet, for Robert's franchise attorney (FR8)

**INPUTS FOR COUNSEL. NOT LEGAL TEXT, NOT AN FDD, NOT AN OFFER.** This packet collects facts the
254 Engineering repository can state, each with where it comes from, so the attorney drafting
the FDD, the franchise agreement, the trademark license and the services agreement does not have
to dig for them. Every sentence below is a fact with a source or is marked as a gap. Nothing
here may be shown to a prospect. FR13 stands: no franchise promises to anyone before the FDD
issues.

Prepared 2026-11-11 under Robert's overnight order 2c of 2026-11-10. Where a source is a file,
the path is in this repository at main `0c67e0cb` unless stated.

## Sources outside the repository

Two sources here are not repository files, and are named so counsel can weigh them:

- **Robert's rulings of 2026-11-10** (fees, and Item 19), given in writing to the Claude Code
  session working this repository that night, in his overnight orders.
- **The standing list,** `handoff/10-standing-list.md` in `lendbucket/wattsmith-backups`, which
  carries the franchise program items FR1 to FR13 as Robert and his chat counterpart keep them.

## Entities (Items 1 to 3)

From the standing list, FR2. **None of these entities appears in this repository's records**
except as the publisher of the store apps (`docs/mobile-store-build.md`, `docs/store-listing.md`).

| Role | Entity, per FR2 |
| --- | --- |
| Franchisor | Craftline Brands Franchising LLC |
| Mark holder, licensing the mark to the franchisor | Craftline Brands IP LLC |
| Engineering provider to the franchisor, under a written services agreement | 254 Engineering LLC |

**Gap:** formation dates, addresses, officers and the Texas business opportunity exemption
notice. FR2 lists all of them as not started.

## The engineering firm the services agreement names

From `src/config/credentials.ts` (`verifiedFirmRegistrations`):

- **Registrant:** 254 Engineering LLC.
- **TBPELS firm registration:** F-29811, active, expires 2027-07-31. Reissued in this name on
  2026-09-21.
- **The line the site prints beside the number** is derived by `registrationLine()` in
  `src/lib/launch.ts` and reads "254 Engineering LLC, TBPELS Firm F-29811".
- **Engineer of record:** one licensed PE is recorded in `verifiedEngineers`. The licence is
  Civil, active, granted 2021-12-09 and expiring 2028-01-31, and the record limits his seal to
  structural work. His name and number are in that file and are not repeated here.

## Services agreement scope: what the repository says the engineering side does and does not do

Facts, each with its source. The attorney decides which become obligations.

1. **The engineer seals, and only the engineer.** Operator ruling of 2026-10-06, recorded in
   `CLAUDE.md` section 1:
   - only the engineer's own authenticated session, with a second factor, can apply his seal;
   - no administrator path exists, the operator's included;
   - at sealing the document is rendered, hashed and locked, and any later change voids the seal;
   - every sealing writes to the append-only audit log.
2. **Protocols.** Each service line runs on a protocol the engineer signs the same way (same
   ruling). Nine protocol documents are transcribed in `src/content/protocols/`:
   254-RC-001, 254-WS-001, 254-WP-001, 254-MH-001, 254-FC-001, 254-DS-001, 254-PL-001, 254-RS-001
   and 254-SL-001. **Which of them are signed and in force is read from the signed record in the
   database, not from the repository** (operator ruling 11, 2026-10-06), so this packet does not
   state it.
3. **Service lines offered in configuration** (`offeredServiceLines`,
   `src/config/launch-conditions.ts`): roof inspections, foundation inspections, structural
   letters, manufactured home foundation certifications, solar structural letters, windstorm
   WPI-8, repair specifications, and residential and light commercial design.
   - A line is sellable only when it is offered in configuration AND its protocol is signed.
   - A voided signature closes the line at once (`src/lib/line-gate.ts`).
4. **The engineer sees no money except his own pay** on files assigned to him. Operator ruling of
   2026-09-24, `CLAUDE.md` section 6b-i.
5. **Open regulatory questions that bear on the agreement,** from the standing list, FR1, not yet
   asked of TBPELS:
   - what a franchisee that is not registered may say in its own name and advertising;
   - whether 254 may pay a franchisee a per order sales commission, given 22 TAC 137.63(c)(4);
   - how the engineer directly supervises technicians the franchisee employs rather than the firm
     (22 TAC 137.51).

   **Nothing in the agreement should assume an answer to these.**

## Items 5 and 6: fees

**Robert's ruling of 2026-11-10, given as figures counsel may move:**

| Fee | Figure |
| --- | --- |
| Initial franchise fee | $39,500 |
| Initial fee for the first three territories | $29,500 |
| Royalty | 7% of territory revenue |
| Brand fund | 2% |
| Technology fee | $400 a month |
| Veteran discount | 20% |
| Per job engineering capacity fee | **Not decided.** It waits on the TBPELS letter, FR1. |

**Robert's readings of 2026-11-11** (his answer 8 on issue #1), for counsel to confirm or move:
- the brand fund is 2% of territory revenue;
- the veteran discount comes off the initial fee only;
- "the first three territories" means the first three sold system wide;
- territory revenue is paid orders in the territory, net of refunds, by calendar month.

- **Not stated by the ruling:** transfer and renewal fees, which FR3 lists and the ruling does
  not set.
- **Where the figures live in the product:** `src/config/franchise-fees.ts`, on main since
  `3b5d8f29`, carries the figures with Robert's name and the date of the ruling, so the attorney
  can move any figure in one place. The four readings above are recorded here; the file takes
  them when the royalty statement is built (platform item X3, part two).

## Item 7: required coverages

**What the franchise standing list says (FR6), not yet ruled into any document:**
- franchisee coverages for Item 7: general liability, auto, and workers compensation or a
  non-subscriber filing;
- E&O, bound before December 31, written to cover work sold through franchisees.

**What the repository holds today:**
- **The firm's own professional liability policy is not on record.**
  - `verifiedInsurance` in `src/config/credentials.ts` is an empty list.
  - The launch gate's `insurance` condition is therefore unmet.
  - The standing list records E&O as being shopped, with one carrier declined.
- **A technician brought on today** (`src/content/onboarding-checklists.ts`):
  - **must** provide a vehicle insurance card or declarations page;
  - **may** provide a general liability certificate, or acknowledge a waiver instead;
  - **acknowledges** the firm's errors and omissions declarations page, with nothing to upload.

**Gap:** limits, additional insured wording and the certificate process for a franchisee. None
is in the repository.

## Item 8: required platform

What a franchisee's people would use, as the repository builds it today. The platform work that
makes it a franchisee's (a franchisee tenant, an owner role, onboarding, royalty statements) is
platform items X1 to X7, being built on staff-only branches, and is not on main.

- **The portal** at `254engineering.com/portal`, the one system for:
  - dispatch, the technician's jobs and capture;
  - the engineer's review and sealing;
  - the sales list;
  - orders and refunds;
  - training (the academy) and reports.

  The workflows are mapped one by one in `docs/workflows.md`, 254-WF-001 to 254-WF-036.
- **The field app,** "254 Field", is a Capacitor shell for Android and iPhone that opens the
  portal's technician screens. It publishes under Craftline Brands IP LLC's developer accounts
  (`docs/mobile-store-build.md`, `docs/store-listing.md`). It is not yet in either store.
- **Payments** go through Stripe, on 254 Engineering LLC's account (`src/config/stripe-console.ts`).
- **Second factor:** staff accounts sign in with a second factor (`docs/mfa-design.md`).

**Gap:** what a franchisee pays for the platform beyond the $400 technology fee, if anything, and
what hardware it must own (a phone that runs the field app). Neither is ruled.

## Item 11: training

**The academy,** `src/content/academy/courses.ts`, read by `src/lib/academy.ts`, carries two
courses today:

1. **"Duties, responsibilities and the signed protocols",** one lesson per protocol:
   - roof certification and its photo procedure;
   - WPI-8E completed construction;
   - manufactured home foundation certification;
   - solar structural letter;
   - structural letter for a permit;
   - repair specification;
   - WPI-8 ongoing construction;
   - foundation certification.
2. **"Ladder use and fall protection on roofs":**
   - choosing and inspecting a ladder;
   - setting up and climbing one;
   - fall protection on low-slope and steep roofs;
   - training, certification of training and retraining.

**Certification on a protocol** is workflow 254-WF-031 in `docs/workflows.md`. The launch gate's
`technician-training` condition requires somebody trained on each protocol version in force for
an offered line (`CLAUDE.md` section 1).

**Gap:** the owner's initial training program (hours, location, who teaches it) and the engineer's
supervised inspections for each franchisee's technicians (FR10). Neither is in the repository.

## Item 12: territory

`docs/franchise/territory-map.md` (FR5):

- counties grouped into the eight coverage regions;
- Census Vintage 2025 populations;
- a 150,000 minimum, Robert's working figure of 2026-11-11, the final rule being counsel's;
- San Antonio (Bexar) and Corpus Christi (Nueces) company owned, and the rest of those two
  regions held back until the first three territories open;
- first territories Harris as one territory, then Collin alone for Frisco, then Tarrant.

Its remaining gaps are listed there.

## Item 13: trademarks

- The standing list (FR2) says Craftline Brands IP LLC holds the mark and licenses it to the
  franchisor.
- **The repository holds no application or registration number for any mark**, and no filing
  date. Robert describes the mark as pending.
- **Gap:** which marks (the "254 Engineering" word mark, the logo), the filing numbers, and their
  status.
- Related, from `CLAUDE.md` section 1:
  - the TBPELS board holds "254 Engineering Services", "Sealed Engineering" and "Stamp My Plans"
    as assumed names of 254 Engineering LLC;
  - "Engineer", "engineering" and "sealed" are regulated terms in Texas, so whatever a franchisee
    may call itself waits on FR1.

## Item 19

**Robert's ruling of 2026-11-10: silent in year one.** Posted prices and cost basis only, and no
performance numbers. The posted prices live in `src/config/prices.ts`. Cost basis by line is
FR11, which waits on November and December order volume.

## What this packet does not cover

- Items 4, 9, 10, 14 to 18, and 20 to 23: the repository holds nothing that answers them.
- The franchise sales process, FR9: not before the FDD issues.
