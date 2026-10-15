# Finding: quoting the five signed protocols on their service lines

Overnight item 4 of 2026-10-14 into 2026-10-15. **Findings only; nothing
changed.** Read from main at 689dc15.

## It is not a copy change, and why

`protocol-registry-audit` decides whether a line's protocol is signed from
`PROTOCOL_ENTRIES` entries whose `signatureEvidence` is set
(`scripts/protocol-registry-audit.mjs:878`), not from the signatures in the
database. `PROTOCOL_ENTRIES` (`src/content/protocols/index.ts`) holds RC-001
only. MH, SL, PL, RS and DS v1.1 sit in `RECEIVED_PROTOCOLS` as unsigned
(`received.ts`).

Quoting a line now therefore fails the audit: "no signed protocol, so it must
carry the pending sentence alone". Confirmed by reading the source.

BACKLOG already says the follow-up registers each signed protocol and quotes it
on the same branch. Registering brings in:

- every per-entry check for `PROTOCOL_ENTRIES`.
- section 8's check that no received protocol is registered where the line gate, intake and review screen read.
- the signature evidence each entry has to carry.

That is a branch, not a sentence. It also has to settle what its signature
evidence is: the portal signature rows (read on production 2026-10-12, hashes
matching), or a scan.

## Where the pending sentence is

data/catalog.ts carries `SCOPE_PENDING` on 10 lines, and src/content/services.ts
carries it on 7 service pages. The five signed protocols cover these:

| Protocol | catalog.ts | services.ts |
| --- | --- | --- |
| MH-001 | 634 | 322 |
| SL-001 | 705 | 276 |
| PL-001 | 770 | 380 |
| RS-001 | 840 | 426 |
| DS-001 | 916, 964, 1001 (three tiers) | 472 |

The audit matches on `serviceSlug`, so DS's three tiers and its page move
together. The windstorm lines (WS and WP, unsigned) and foundation inspections
(FC-001, unsigned) stay pending.

## The mechanism RC-001 uses

`receives` (catalog) and `deliverable` (services.ts) carry four items, the
first four bullets of RC-001 section 11. The audit removes whitespace from each
item and requires it as a substring of `pdftotext -layout` of the SIGNED PDF,
not of the transcription, so punctuation has to match the PDF. `notes` is
pinned word for word (`NOTES_PINNED`) and does not need to change.

## Candidate quotes, section 11 of each, as the transcription reads

These are taken from the transcriptions and have **not been compared against
the PDFs**, which is what the audit compares. Each bullet wraps across lines in
the transcription and is joined with one space.

- **MH** (mh-001.ts 966 to 978): the sealed certification on a pass, what it
  identifies, the requirement it names, and that the inspection was visual and
  non-invasive. One word breaks at a line ("below- grade").
- **SL** (sl-001.ts 812 to 831): the sealed letter on a pass, what it
  identifies, the opinion on the existing roof structure, and condition on the
  date of inspection. 827 to 829 name "the electrical work" and "waterproofing",
  as exclusions; left out because the firm's scope is structural only.
- **PL** (pl-001.ts 667 to 679): the sealed letter to the permitting authority,
  what it gives, the opinion on the element only, and what it does not cover.
  Clean.
- **RS** (rs-001.ts 780 to 792): the sealed repair specification, what it
  identifies per location, what it covers, and that it does not warrant the
  repair. 789 to 791 (cause, "a leak or drainage") left out.
- **DS** (ds-001.ts 576 to 585): sealed final drawings and calculations, PDF
  only, what each sheet carries. One list has to serve beam and header sizing,
  carport and patio, and the custom package. "Drawings" fits the first tier
  loosely. DS has no pass-determination sentence.

## A check that would fire on the obvious quotes

`"no rendered sentence describes the deliverable in terms 254-RC-001 excludes"`
(`protocol-registry-audit.mjs:791`) scans all of catalog.ts and services.ts for
RC-001's excluded phrases, "future performance" among them, and strips only
RC-001's own exclusion sentence first. MH, SL, PL, RS and DS each have a "does
not forecast future performance" sentence. Quoting any of them would turn that
check red, although each is an exclusion, not a promise.

The fix is to strip each registered protocol's own exclusion sentences, not
RC-001's alone. That is a change to a check and needs a ruling. Until then,
those sentences are best left unquoted.

## Questions for a ruling

1. Register MH, SL, PL, RS and DS v1.1 in `PROTOCOL_ENTRIES` with the portal
   signature rows as their evidence, on one branch with the quotes? Recommended
   yes.
2. Which bullets per line? Recommended: the first four of section 11, as
   RC-001, leaving out the sentences that name non-structural work and the
   "future performance" sentences.
3. Widen the exclusion scan to strip each registered protocol's own exclusion
   sentences? Recommended yes, injection-verified.
