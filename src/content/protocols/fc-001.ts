/**
 * 254-FC-001 v1.0, Foundation Certification Protocol for Existing Foundations.
 *
 * TRANSCRIBED, NEVER WRITTEN. Structured on 2026-10-22 from the engineer's own
 * Word file, docs/protocols/incoming/v1.2/254-FC-001_Foundation_Certification_Protocol_v1.0.docx,
 * sha256 264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d, by way of its verbatim text in
 * docx-received.ts (FC001_V1_0.text), which protocol-registry-audit section 9
 * proves against the .docx word for word in both directions. Every string below
 * is a whole line of that text or a line with its own marker removed: the
 * en dash bullet, the "[  ]" box, the trailing "[PHOTO]", or a question's
 * number. Nothing is joined, reworded or re-punctuated, and the document's own
 * long dashes are kept, because the house dash rule does not reach a signed
 * document (CLAUDE.md section 3). protocol-registry-audit section 9 proves
 * every question, upload, heading, checklist label, photo step, determination,
 * criterion and capture field against the .docx itself, read independently,
 * and counts each by the document's own markers.
 *
 * UNSIGNED AND UNREGISTERED. It is in no list the line gate, the intake bridge
 * or the review screen reads: it is not in PROTOCOL_ENTRIES, so it adds no
 * intake field, opens no line and gives the review screen nothing. It moves
 * there in the change that records the engineer's signature, by the rule in
 * received.ts, and section 7 of the same audit then compares it again.
 *
 * The reading that is not the document, said so. Which group a question sits
 * in is its heading in Appendix A; that a question is a flag is the heading
 * above it, which begins "Flags" and says a YES routes to engineer review
 * BEFORE dispatch;
 * that question 1 is recorded verbatim is its own "record exactly". `ruler` and
 * `perOccurrence` use the same two tests the v1.1 transcriber uses ("ruler in
 * frame" or "tape in frame"; a label beginning Every or Each), so an item that
 * says "with ruler or crack comparator card in frame" reads ruler false, and its
 * label still carries the instruction word for word. `coveringOnly` is null
 * throughout: the crawlspace section is headed "(pier-and-beam only)", and no
 * field of this platform yet carries a foundation type for itemsFor to filter
 * on, so every item applies, the conservative direction itemsFor already takes.
 *
 * EMPTY BY THE DOCUMENT, NOT BY OMISSION. `thresholds` is empty, as it is for
 * the six v1.1 transcriptions: the document's numbers (1/8 in., 1%, 20 ft, 30
 * feet) are carried inside the criteria verbatim and are not lifted into typed
 * values, because which number is a threshold and of what is a reading the
 * engineer has not given. `capture` is null on every item; the counts and
 * measurements the checklist prints are FC001_COUNTS, word for word.
 *
 * DO NOT EDIT BY HAND. A change to this file is a change to what the engineer
 * signs. Regenerate from the Word text, and only from a new Word file.
 */
export const FC001 = {
  "documentNumber": "254-FC-001",
  "title": "Foundation Certification Protocol for Existing Foundations",
  "version": "1.0",
  "issueDate": "2026-09-29",
  "issueDateAsPrinted": "September 29, 2026",
  "preparedBy": "Aman Dhakal, P.E., Engineer of Record, 254 Engineering Services",
  "approvedBy": "Aman Dhakal, P.E., Engineer of Record",
  "appliesTo": "All foundation certification engagements performed by 254 Engineering Services",
  "supersedes": "None. First issue of this service line.",
  "serviceSlug": "foundation-inspections",
  "serviceTier": null,
  "requiresDiscipline": null,
  "sourceFile": "docs/protocols/incoming/v1.2/254-FC-001_Foundation_Certification_Protocol_v1.0.docx",
  "sourceSha256": "264d3b5d7b6c8210ba6802d9769b36e40f867067870b90459747a96e4fefbf8d",
  "firmNameOnDocument": "254 Engineering Services",
  "sections": [
    {
      "key": "job-information",
      "heading": "JOB INFORMATION",
      "at": "Appendix B"
    },
    {
      "key": "context",
      "heading": "CONTEXT (every job)",
      "at": "Appendix B"
    },
    {
      "key": "exterior-foundation-condition",
      "heading": "EXTERIOR FOUNDATION CONDITION",
      "at": "Appendix B"
    },
    {
      "key": "relative-elevation-survey",
      "heading": "RELATIVE ELEVATION SURVEY",
      "at": "Appendix B"
    },
    {
      "key": "interior-finish-scan",
      "heading": "INTERIOR FINISH SCAN",
      "at": "Appendix B"
    },
    {
      "key": "crawlspace-subfloor-verification",
      "heading": "CRAWLSPACE / SUBFLOOR VERIFICATION (pier-and-beam only)",
      "at": "Appendix B"
    },
    {
      "key": "foundation-age-and-prior-repair-verification",
      "heading": "FOUNDATION AGE AND PRIOR REPAIR VERIFICATION",
      "at": "Appendix B"
    },
    {
      "key": "close-out",
      "heading": "CLOSE-OUT",
      "at": "Appendix B"
    }
  ],
  "photoProcedure": [
    {
      "step": 1,
      "text": "Before starting, make a rough sketch of the foundation footprint and mark North. Take a photo of it.",
      "at": "Appendix B, PHOTOS"
    },
    {
      "step": 2,
      "text": "Tick the item you are about to photograph, take a photo of the checklist, then take the photos for that item.",
      "at": "Appendix B, PHOTOS"
    },
    {
      "step": 3,
      "text": "Move on to the next item the same way.",
      "at": "Appendix B, PHOTOS"
    }
  ],
  "intakeQuestions": [
    {
      "number": 1,
      "group": "purpose-and-recipient",
      "groupHeading": "Purpose & recipient",
      "ask": "What is the letter for? (insurance binding/renewal / home sale / lender / permit / other — record exactly)",
      "flag": false,
      "verbatim": true,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 2,
      "group": "purpose-and-recipient",
      "groupHeading": "Purpose & recipient",
      "ask": "Who will the letter be addressed to? (insurer name, buyer, lender, city)",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 3,
      "group": "purpose-and-recipient",
      "groupHeading": "Purpose & recipient",
      "ask": "What deadline is the customer working against, if any?",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 4,
      "group": "property-basics",
      "groupHeading": "Property basics",
      "ask": "Property address and county",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 5,
      "group": "property-basics",
      "groupHeading": "Property basics",
      "ask": "Property type (single family / duplex / townhome / small commercial) and number of stories",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 6,
      "group": "property-basics",
      "groupHeading": "Property basics",
      "ask": "Year built; foundation type (slab-on-grade / pier-and-beam / crawlspace); year of any prior foundation repair",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 7,
      "group": "property-basics",
      "groupHeading": "Property basics",
      "ask": "Post-tensioned or conventionally reinforced slab, if known",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 8,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Is there an OPEN insurance claim on this foundation?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 9,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Is there active or threatened litigation involving the foundation?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 10,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Any known active plumbing leak, slab leak, or recent leak history under the structure?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 11,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Has another engineer or inspector already issued an adverse report on this foundation?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 12,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Has the foundation been repaired before (piers, mudjacking, grouting)?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 13,
      "group": "flags",
      "groupHeading": "Flags — a YES on any of these routes to engineer review BEFORE dispatch",
      "ask": "Was a tree within 20 feet of the foundation removed in the last two years?",
      "flag": true,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 14,
      "group": "access-and-safety",
      "groupHeading": "Access & safety (decides dispatch feasibility)",
      "ask": "Is crawlspace access available and accessible, if applicable?",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 15,
      "group": "access-and-safety",
      "groupHeading": "Access & safety (decides dispatch feasibility)",
      "ask": "Occupied or vacant? Accessible if occupied?",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 16,
      "group": "access-and-safety",
      "groupHeading": "Access & safety (decides dispatch feasibility)",
      "ask": "Is the full foundation perimeter visible, or is it obstructed by decking, landscaping, or additions?",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    },
    {
      "number": 17,
      "group": "prior-paperwork",
      "groupHeading": "Prior paperwork prompt",
      "ask": "Do you have: prior foundation certs, repair invoices/warranty, permits, geotechnical/soils report, plumbing leak test report, elevation survey, photos of any problems?",
      "flag": false,
      "verbatim": false,
      "at": "Appendix A, Part 1"
    }
  ],
  "intakeUploads": [
    {
      "key": "photo-of-the-front-of-the-1",
      "what": "Photo of the front of the property (confirms address/structure)",
      "tier": "required",
      "when": null,
      "tierHeading": "Required",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "any-adverse-report-prior-engineer-letter-2",
      "what": "Any adverse report, prior engineer letter, insurer letter, or prior foundation repair warranty",
      "tier": "required-if-exists",
      "when": null,
      "tierHeading": "Required if it exists",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "foundation-repair-contract-invoice-or-warranty-3",
      "what": "Foundation repair contract, invoice, or warranty for the most recent repair work (if repair claimed)",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "permits-for-foundation-repair-hoa-approval-4",
      "what": "Permits for foundation repair; HOA approval if applicable",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "geotechnical-or-soils-report-if-one-5",
      "what": "Geotechnical or soils report, if one exists",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "plumbing-leak-detection-test-report-if-6",
      "what": "Plumbing leak detection test report, if one exists",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "prior-elevation-survey-or-foundation-inspection-7",
      "what": "Prior elevation survey or foundation inspection report",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    },
    {
      "key": "customer-s-own-photos-of-problem-8",
      "what": "Customer's own photos of problem areas (cracks, doors that don't close, etc.)",
      "tier": "when-applicable",
      "when": null,
      "tierHeading": "Collect when applicable",
      "at": "Appendix A, Part 2"
    }
  ],
  "checklist": [
    {
      "key": "photo-of-address-marker-house-number",
      "section": "job-information",
      "label": "Photo of address marker (house number, street sign, or mailbox)",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "all-four-elevations-of-the-structure",
      "section": "context",
      "label": "All four elevations of the structure",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "full-perimeter-foundation-walk-continuous-coverage",
      "section": "context",
      "label": "Full perimeter foundation walk, continuous coverage",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "site-grading-overview-general-lot-slope",
      "section": "context",
      "label": "Site grading overview — general lot slope relative to the structure",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "each-tree-within-20-feet-of",
      "section": "context",
      "label": "Each tree within 20 feet of the foundation — species and trunk diameter if known",
      "photo": true,
      "ruler": false,
      "perOccurrence": true,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "every-visible-crack-wide-close-with",
      "section": "exterior-foundation-condition",
      "label": "Every visible crack: wide + close with ruler or crack comparator card in frame; note orientation (vertical/horizontal/diagonal/stair-step), width, length, and location",
      "photo": true,
      "ruler": false,
      "perOccurrence": true,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "stair-step-cracking-in-brick-veneer",
      "section": "exterior-foundation-condition",
      "label": "Stair-step cracking in brick veneer or mortar joints — count per elevation, worst close-ups",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "separation-at-expansion-joints-control-joints",
      "section": "exterior-foundation-condition",
      "label": "Separation at expansion joints, control joints, or where foundation meets siding/veneer",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "spalling-exposed-rebar-or-exposed-post",
      "section": "exterior-foundation-condition",
      "label": "Spalling, exposed rebar, or exposed post-tension cable/anchor",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "efflorescence-or-moisture-staining-on-the",
      "section": "exterior-foundation-condition",
      "label": "Efflorescence or moisture staining on the foundation face",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "foundation-vent-condition-and-screening-pier",
      "section": "exterior-foundation-condition",
      "label": "Foundation vent condition and screening (pier-and-beam / crawlspace)",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "downspout-discharge-points-and-distance-from",
      "section": "exterior-foundation-condition",
      "label": "Downspout discharge points and distance from foundation",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "standing-water-or-ponding-evidence-adjacent",
      "section": "exterior-foundation-condition",
      "label": "Standing water or ponding evidence adjacent to the foundation",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "irrigation-heads-or-hose-bibs-discharging",
      "section": "exterior-foundation-condition",
      "label": "Irrigation heads or hose bibs discharging directly at the foundation",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "drainage-system-if-present-french-drain",
      "section": "exterior-foundation-condition",
      "label": "Drainage system if present — French drain, area drain, or swale, and its discharge point",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "survey-equipment-and-benchmark-location-photographed",
      "section": "relative-elevation-survey",
      "label": "Survey equipment and benchmark location, photographed in place",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "grid-reading-points-across-each-room",
      "section": "relative-elevation-survey",
      "label": "Grid reading points across each room and along the perimeter, marked on the sketch, spaced no more than 20 ft apart",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "photo-of-the-reading-or-device",
      "section": "relative-elevation-survey",
      "label": "Photo of the reading or device display at each grid point, or the summary printout",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "interior-wall-and-ceiling-cracks-especially",
      "section": "interior-finish-scan",
      "label": "Interior wall and ceiling cracks, especially at corners and above door/window headers — wide + close with ruler",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "floor-slope-or-tilt-level-or",
      "section": "interior-finish-scan",
      "label": "Floor slope or tilt — level or ball-roll test at each room tested, wide shot of test",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "every-interior-door-tested-for-function",
      "section": "interior-finish-scan",
      "label": "Every interior door tested for function — binding, gaps, fails to latch — photo of each affected door and frame",
      "photo": true,
      "ruler": false,
      "perOccurrence": true,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "every-window-tested-for-function-binding",
      "section": "interior-finish-scan",
      "label": "Every window tested for function — binding or fails to latch — photo of each affected window",
      "photo": true,
      "ruler": false,
      "perOccurrence": true,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "flooring-separation-or-tile-cracking-especially",
      "section": "interior-finish-scan",
      "label": "Flooring separation or tile cracking, especially near walls — wide + close",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "baseboard-or-trim-gaps-at-floor",
      "section": "interior-finish-scan",
      "label": "Baseboard or trim gaps at floor or wall junctions",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "overview-of-the-crawlspace-from-the",
      "section": "crawlspace-subfloor-verification",
      "label": "Overview of the crawlspace from the access point",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "every-pier-tilting-settlement-cracking-or",
      "section": "crawlspace-subfloor-verification",
      "label": "Every pier — tilting, settlement, cracking, or loss of contact with the beam — wide + close of any affected pier",
      "photo": true,
      "ruler": false,
      "perOccurrence": true,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "beam-and-girder-condition-rot-sagging",
      "section": "crawlspace-subfloor-verification",
      "label": "Beam and girder condition — rot, sagging, cracking — worst examples with ruler",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "joist-condition-and-spacing-deterioration-or",
      "section": "crawlspace-subfloor-verification",
      "label": "Joist condition and spacing — deterioration or damage",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "standing-water-active-moisture-or-saturated",
      "section": "crawlspace-subfloor-verification",
      "label": "Standing water, active moisture, or saturated soil in the crawlspace",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "vapor-barrier-presence-and-condition-if",
      "section": "crawlspace-subfloor-verification",
      "label": "Vapor barrier presence and condition, if installed",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "ventilation-vent-count-and-any-blocked",
      "section": "crawlspace-subfloor-verification",
      "label": "Ventilation — vent count and any blocked vents",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "wood-destroying-insect-evidence-mud-tubes",
      "section": "crawlspace-subfloor-verification",
      "label": "Wood-destroying insect evidence — mud tubes, frass, damaged wood",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "evidence-of-prior-pier-replacement-shimming",
      "section": "crawlspace-subfloor-verification",
      "label": "Evidence of prior pier replacement, shimming, or repair — tags, plates, or contractor markings",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "any-foundation-repair-company-signage-tags",
      "section": "foundation-age-and-prior-repair-verification",
      "label": "Any foundation repair company signage, tags, or plates found on site",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "any-visible-new-cracking-or-movement",
      "section": "foundation-age-and-prior-repair-verification",
      "label": "Any visible new cracking or movement near a previously repaired zone",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "full-perimeter-walk-anything-unusual",
      "section": "close-out",
      "label": "Full perimeter walk — anything unusual",
      "photo": true,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    },
    {
      "key": "exception-menu-cleared-for-every-non",
      "section": "close-out",
      "label": "Exception menu cleared for every non-applicable item",
      "photo": false,
      "ruler": false,
      "perOccurrence": false,
      "coveringOnly": null,
      "capture": null,
      "at": "Appendix B"
    }
  ],
  "determinations": [
    {
      "key": "pass",
      "heading": "PASS",
      "effect": null,
      "criteria": [
        "Package complete: every checklist item present or properly excepted",
        "No active moisture or plumbing leak evidence at the foundation or in the crawlspace",
        "Cracks are hairline only on a foundation under 10 years old, or no wider than 1/8 in. on a foundation 10 years or older, with no active displacement",
        "Foundation slope no more than 1% in any direction — about 1 inch of rise or fall over every 8 feet, checked across the length, width, and corner-to-corner — and no single stretch between two survey points shows more than about 1 inch of difference over a 30-foot span",
        "Doors and windows function normally, or show only minor issues consistent with ordinary seasonal movement",
        "Drainage and grading adequate, or noted as a maintenance item only"
      ],
      "at": "Appendix C"
    },
    {
      "key": "revise",
      "heading": "REVISE",
      "effect": null,
      "criteria": [
        "Any required photo missing, blurry, or missing its ruler/comparator-card pair",
        "Elevation survey grid too sparse to check the slope, or missing the benchmark record",
        "Worst-condition coverage doubtful (all photos look selectively favorable)",
        "Exception used where the condition plainly applied",
        "Counts or measurements inconsistent with photos"
      ],
      "at": "Appendix C"
    },
    {
      "key": "repairs-required",
      "heading": "REPAIRS REQUIRED (certification withheld, repair list issued)",
      "effect": "certification withheld, repair list issued",
      "criteria": [
        "Active moisture or plumbing leak evidence under the structure",
        "A crack wider than hairline on a foundation under 10 years old, or wider than 1/8 in. on a foundation 10 years or older, at a structural location, or any crack showing active displacement — this includes a separation gap at an addition or adjoining structure, measured the same way",
        "Foundation slope over 1% in any direction — more than about 1 inch of rise or fall over 8 feet, across the length, width, or corner-to-corner",
        "Any single stretch between two survey points with more than about 1 inch of difference over a 30-foot span",
        "Pier or beam failure, or confirmed loss of pier-to-beam contact (pier-and-beam)",
        "Stair-step cracking with visible rotation or displacement of veneer",
        "Certification proceeds only after repairs are verified on revisit"
      ],
      "at": "Appendix C"
    },
    {
      "key": "site-revisit",
      "heading": "SITE REVISIT (technician returns with an engineer-specified capture list)",
      "effect": "technician returns with an engineer-specified capture list",
      "criteria": [
        "Elevation survey incomplete or grid too sparse, return to complete the grid",
        "Crack present without a comparator-card measurement, return with the tool and re-photograph",
        "Suspected active movement without monitoring data.",
        "Conflicting evidence (owner story vs. photos vs. uploads), return for the specific items that settle it: repair records, permit, soils report",
        "Prior adverse report exists, return and photograph every condition the report cites at the same locations before contradicting it",
        "Repairs required, return after repairs to verify each item on the repair list"
      ],
      "at": "Appendix C"
    },
    {
      "key": "decline",
      "heading": "DECLINE",
      "effect": null,
      "criteria": [
        "Open insurance claim where the certification would function as claim leverage — decline, with a referral to an independent firm",
        "Active or threatened litigation — decline",
        "Foundation under ongoing new construction, not yet complete — decline; the firm does not offer this service at this time",
        "Manufactured home foundation — route to manufactured home foundation certification line",
        "Request is effectively for a geotechnical opinion or subsurface investigation — decline, with a referral to a geotechnical engineer",
        "Unsafe or inaccessible crawlspace that prevents minimum capture and customer refuses to remediate access",
        "Customer requests a predetermined conclusion — automatic decline, log verbatim request"
      ],
      "at": "Appendix C"
    }
  ],
  "thresholds": []
} as const;

/** Capture fields printed on the checklist, verbatim, blanks included. */
export const FC001_COUNTS = [
  {
    "key": "field-1",
    "prompt": "Job / Dispatch No.: ____________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-2",
    "prompt": "Property address (full, incl. county): __________________________________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-3",
    "prompt": "Technician name: ______________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-4",
    "prompt": "Date / arrival time / departure time: ________________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-5",
    "prompt": "Weather during visit: ________________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-6",
    "prompt": "Contact on site (name, role, phone): ________________________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-7",
    "prompt": "Foundation type / shape / stories: __________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-8",
    "prompt": "Counts — cracks over 1/16 in. ___   stair-step cracks ___   drainage deficiencies ___: ________",
    "at": "Appendix B"
  },
  {
    "key": "field-9",
    "prompt": "Equipment used (laser level / water level / Ziplevel / other): ________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-10",
    "prompt": "Benchmark location (e.g., interior door threshold nearest lowest point): ________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-11",
    "prompt": "Overall differential, full length / width / diagonal (report whichever governs):",
    "at": "Appendix B"
  },
  {
    "key": "field-12",
    "prompt": "Differential (in.): ________   Span measured (ft): ________   Direction (length / width / diagonal): ________",
    "at": "Appendix B"
  },
  {
    "key": "field-13",
    "prompt": "Largest differential between any two adjacent grid points:",
    "at": "Appendix B"
  },
  {
    "key": "field-14",
    "prompt": "Differential (in.): ________   Spacing between points (ft, 20 ft or the foundation dimension, whichever is less): ________",
    "at": "Appendix B"
  },
  {
    "key": "field-15",
    "prompt": "Doors tested ___   doors with function issues ___   windows tested ___   windows with function issues ___",
    "at": "Appendix B"
  },
  {
    "key": "field-16",
    "prompt": "Pier count observed ___   piers with a deficiency ___: ________",
    "at": "Appendix B"
  },
  {
    "key": "field-17",
    "prompt": "Owner-reported foundation age / prior repair year (verbatim): ________________________________",
    "at": "Appendix B"
  },
  {
    "key": "field-18",
    "prompt": "Total photos: ______________",
    "at": "Appendix B"
  },
  {
    "key": "field-19",
    "prompt": "Technician signature / date: ____________________________________________",
    "at": "Appendix B"
  }
];

/** Decision rules that are not the five determinations. FC-001 has none. */
export const FC001_OTHER_RULES = [];

/** Checklist lines the document leaves blank for the engineer to write per job. */
export const FC001_BLANK_JOB_LIST_ITEMS = 0;
