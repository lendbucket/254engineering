/**
 * APPENDIX B OF 254-RC-001 v1.0, AS DATA. THE TECHNICIAN'S CAPTURE LIST.
 *
 * Source: docs/254-RC-001-roof-certification-protocol-v1.0.pdf, signed
 * 09/14/2026. Transcribed, never interpreted. See rc-001-intake.ts for what
 * this file may not become.
 *
 * THE PHOTO PROCEDURE IS AT THE HEAD OF THE CHECKLIST BECAUSE IT IS AT THE HEAD
 * OF THE CHECKLIST. The document prints it above the items and section 8
 * repeats it, so the phone shows it there too rather than burying it in help
 * text. It is an ORDER of operations, and a capture taken out of that order
 * cannot be reconstructed afterwards.
 */

/** The document's own section headings, in the document's own order. */
export type ChecklistSection =
  | "job-information"
  | "context"
  | "covering-condition"
  | "edges-flashings-penetrations"
  | "attic-verification"
  | "interior-finish-scan"
  | "covering-age-and-exposure"
  | "close-out";

export const RC001_SECTIONS: { key: ChecklistSection; heading: string; at: string }[] = [
  { key: "job-information", heading: "JOB INFORMATION", at: "Appendix B" },
  { key: "context", heading: "CONTEXT (every job)", at: "Appendix B" },
  { key: "covering-condition", heading: "COVERING CONDITION", at: "Appendix B" },
  { key: "edges-flashings-penetrations", heading: "EDGES, FLASHINGS, PENETRATIONS", at: "Appendix B" },
  { key: "attic-verification", heading: "ATTIC VERIFICATION", at: "Appendix B" },
  { key: "interior-finish-scan", heading: "INTERIOR FINISH SCAN", at: "Appendix B" },
  { key: "covering-age-and-exposure", heading: "COVERING AGE AND EXPOSURE", at: "Appendix B" },
  { key: "close-out", heading: "CLOSE-OUT", at: "Appendix B" },
];

/**
 * THE PHOTO PROCEDURE, VERBATIM. Printed at the head of the checklist on the
 * phone, in this order. Section 8 states the same three steps.
 */
export const RC001_PHOTO_PROCEDURE: { step: number; text: string; at: string }[] = [
  {
    step: 1,
    text: "Before starting, make a rough sketch of the roof and mark North. Take a photo of it.",
    at: "Appendix B, PHOTOS; section 8",
  },
  {
    step: 2,
    text: "Tick the item you are about to photograph, take a photo of the checklist, then take the photos for that item.",
    at: "Appendix B, PHOTOS; section 8",
  },
  { step: 3, text: "Move on to the next item the same way.", at: "Appendix B, PHOTOS" },
];

/**
 * What a single line of the checklist asks for.
 *
 * `photo` is the document's own [PHOTO] marker. `ruler` is set only where the
 * document says a ruler or tape is in frame, which section 9 requires "where a
 * dimension, exposure, or thickness governs".
 *
 * `perOccurrence` is set where the document says each, every, or all. Section 9:
 * "Every patch, prior repair, penetration, and flashing location is
 * photographed individually." One photograph for a category does not satisfy
 * one of these.
 *
 * `coveringOnly` carries the document's own covering prefix. Those lines are
 * conditional on the covering type rather than optional, and an item that does
 * not apply is still marked with the reason it does not apply, per section 8.
 */
export type ChecklistItem = {
  key: string;
  section: ChecklistSection;
  /** The line exactly as the document prints it, minus its [ ] and [PHOTO]. */
  label: string;
  photo: boolean;
  ruler: boolean;
  perOccurrence: boolean;
  /** "shingle" | "metal" | "tile" | "flat-built-up", or null for every job. */
  coveringOnly: string | null;
  /** A value the technician records alongside, as the document prints it. */
  capture: { key: string; prompt: string; kind: "text" | "count" | "temperature" } | null;
  at: string;
};

const AT = "Appendix B";

export const RC001_CHECKLIST: ChecklistItem[] = [
  /* ---------------------------------------------------------- JOB INFORMATION */
  { key: "job-no", section: "job-information", label: "Job / Dispatch No.", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "job-no", prompt: "Job / Dispatch No.", kind: "text" }, at: AT },
  { key: "property-address", section: "job-information", label: "Property address (full, incl. county)", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "property-address", prompt: "Property address (full, incl. county)", kind: "text" }, at: AT },
  { key: "technician-name", section: "job-information", label: "Technician name", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "technician-name", prompt: "Technician name", kind: "text" }, at: AT },
  { key: "times", section: "job-information", label: "Date / arrival time / departure time", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "times", prompt: "Date / arrival time / departure time", kind: "text" }, at: AT },
  { key: "weather", section: "job-information", label: "Weather during visit", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "weather", prompt: "Weather during visit", kind: "text" }, at: AT },
  { key: "site-contact", section: "job-information", label: "Contact on site (name, role, phone)", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "site-contact", prompt: "Contact on site (name, role, phone)", kind: "text" }, at: AT },
  { key: "address-marker", section: "job-information", label: "Photo of address marker (house number, street sign, or mailbox)", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },

  /* ------------------------------------------------------------------ CONTEXT */
  { key: "four-elevations", section: "context", label: "All four elevations of the structure", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "plane-overviews", section: "context", label: "Each roof plane overview from eave/ladder", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "covering-shape-stories", section: "context", label: "Covering type / shape (hip-gable-flat-combo) / stories", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "covering-shape-stories", prompt: "Covering type / shape (hip-gable-flat-combo) / stories", kind: "text" }, at: AT },
  { key: "tree-contact", section: "context", label: "Tree contact or overhang over roof -- each occurrence", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },

  /* -------------------------------------------------------- COVERING CONDITION */
  { key: "good-area-baseline", section: "covering-condition", label: "Close-up with ruler of covering in GOOD area -- exposure/profile baseline", photo: true, ruler: true, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "worst-area-each-plane", section: "covering-condition", label: "Close-up of WORST area on each plane", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "shingle-granule-loss", section: "covering-condition", label: "Shingle roofs -- granule loss: close-up of worst granule condition + gutter/downspout granule accumulation", photo: true, ruler: false, perOccurrence: false, coveringOnly: "shingle", capture: null, at: AT },
  { key: "shingle-cracking", section: "covering-condition", label: "Shingle roofs -- cracking, curling, cupping, blistering: worst example each, wide + close", photo: true, ruler: false, perOccurrence: true, coveringOnly: "shingle", capture: null, at: AT },
  {
    key: "shingle-seal-bond",
    section: "covering-condition",
    label: "Shingle roofs -- SEAL-BOND: gentle tab lift at 4 locations spread across different planes; photo any unsealed tab",
    photo: true,
    ruler: false,
    perOccurrence: false,
    coveringOnly: "shingle",
    /*
     * THE TEMPERATURE IS PART OF THE ITEM, NOT A NOTE. Section 8: the ambient
     * temperature is recorded "because the result is not meaningful without
     * it". So a seal-bond result with no temperature is an INCOMPLETE item
     * rather than a complete item missing an optional field.
     */
    capture: { key: "seal-bond-ambient-f", prompt: "Ambient temperature during seal-bond check (F)", kind: "temperature" },
    at: "Appendix B, COVERING CONDITION; section 8",
  },
  { key: "metal-corrosion", section: "covering-condition", label: "Metal roofs -- panel corrosion, seam condition, fastener back-out: worst examples with ruler", photo: true, ruler: true, perOccurrence: false, coveringOnly: "metal", capture: null, at: AT },
  { key: "metal-oil-canning", section: "covering-condition", label: "Metal roofs -- oil-canning or panel distortion wide shots", photo: true, ruler: false, perOccurrence: false, coveringOnly: "metal", capture: null, at: AT },
  { key: "tile-damage", section: "covering-condition", label: "Tile roofs -- cracked/slipped/missing tiles: count per plane, worst close-ups", photo: true, ruler: false, perOccurrence: false, coveringOnly: "tile", capture: { key: "tile-count-per-plane", prompt: "Cracked/slipped/missing tiles, count per plane", kind: "count" }, at: AT },
  { key: "flat-ponding", section: "covering-condition", label: "Flat/built-up -- ponding evidence (staining rings), blisters, alligatoring, seam condition, drainage path to scuppers/drains", photo: true, ruler: false, perOccurrence: false, coveringOnly: "flat-built-up", capture: null, at: AT },
  { key: "all-patches", section: "covering-condition", label: "ALL patches and prior repairs -- every one, wide + close", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "biological-growth", section: "covering-condition", label: "Biological growth: moss, algae, dark streaking -- worst area each plane affected", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "debris", section: "covering-condition", label: "Debris accumulation in valleys, behind chimneys, at wall intersections", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "exposed-fasteners", section: "covering-condition", label: "Exposed or backed-out fasteners -- worst examples", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },

  /* ----------------------------------------- EDGES, FLASHINGS, PENETRATIONS */
  { key: "drip-edge", section: "edges-flashings-penetrations", label: "Drip edge/eave condition each side; fastening with ruler at 2 spots", photo: true, ruler: true, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "fascia", section: "edges-flashings-penetrations", label: "Fascia and eave boards: rot, deterioration, separation -- full run each side, close-up of worst", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "ridge-hip-caps", section: "edges-flashings-penetrations", label: "Ridge/hip caps condition", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "penetrations", section: "edges-flashings-penetrations", label: "Every penetration: boots (cracked rubber = close-up), vents, flues", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "skylights", section: "edges-flashings-penetrations", label: "Skylights: glass cracks, condensation between panes (failed seal), curb flashing -- exterior + interior shot each", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "sealant", section: "edges-flashings-penetrations", label: "Sealant condition at every flashing and penetration: dried, cracked, or gapped caulking -- close-up each occurrence", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "chimney", section: "edges-flashings-penetrations", label: "Chimney: flashing + masonry condition (loose brick, mortar, cap)", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "wall-roof-intersections", section: "edges-flashings-penetrations", label: "Wall-roof intersections and kick-out flashing at gutter terminations", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "gutters", section: "edges-flashings-penetrations", label: "Gutters: attachment, separation, standing debris level", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },

  /* ------------------------------------------------------- ATTIC VERIFICATION */
  { key: "deck-material", section: "attic-verification", label: "Deck material + thickness at hatch with ruler", photo: true, ruler: true, perOccurrence: false, coveringOnly: null, capture: { key: "deck-material-thickness", prompt: "Deck material / thickness", kind: "text" }, at: AT },
  { key: "daylight-check", section: "attic-verification", label: "Daylight check: lights off, photo toward each plane -- any daylight = close-up at source", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "staining", section: "attic-verification", label: "Staining/leak evidence: every stain, wide + close, wet-test note (dry stain vs active moisture)", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "deck-sag", section: "attic-verification", label: "Deck sag or delamination between framing -- sight along planes, photo any deviation", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "fastener-shiners", section: "attic-verification", label: "Fastener shiners: length close-up at 2+ spots", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "ventilation", section: "attic-verification", label: "Ventilation: intake (soffit) and exhaust (ridge/box/turbine) present -- one photo each type", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "soffit-vents", section: "attic-verification", label: "Soffit vents unblocked: check insulation not covering intake at eaves -- photo 2+ eave bays", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "insulation", section: "attic-verification", label: "Insulation condition: damp, matted, or compacted areas anywhere (not just at leaks)", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "pest-evidence", section: "attic-verification", label: "Pest evidence: nests, droppings, chewed framing/wiring", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },

  /* ---------------------------------------------------- INTERIOR FINISH SCAN */
  { key: "top-floor-ceilings", section: "interior-finish-scan", label: "Top-floor ceilings each room: stains, peeling paint, bubbling drywall -- wide shot per room, close-up of any finding", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },
  { key: "musty-odor", section: "interior-finish-scan", label: "Musty odor noted by room", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "musty-odor-rooms", prompt: "Musty odor noted by room", kind: "text" }, at: AT },

  /* ----------------------------------------------- COVERING AGE AND EXPOSURE */
  { key: "product-label", section: "covering-age-and-exposure", label: "Any covering product label/wrapper/stamp found on site or in attic", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "owner-reported-age", prompt: "Owner-reported roof age / replacement year (verbatim)", kind: "text" }, at: AT },
  { key: "south-facing-plane", section: "covering-age-and-exposure", label: "South-facing plane close-up (fastest-aging plane) with ruler", photo: true, ruler: true, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "rooftop-equipment", section: "covering-age-and-exposure", label: "Any solar panels, satellite mounts, or rooftop equipment: attachment condition", photo: true, ruler: false, perOccurrence: true, coveringOnly: null, capture: null, at: AT },

  /* ---------------------------------------------------------------- CLOSE-OUT */
  { key: "perimeter-walk", section: "close-out", label: "Full perimeter walk -- anything unusual", photo: true, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "exception-menu-cleared", section: "close-out", label: "Exception menu cleared for every non-applicable item", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: null, at: AT },
  { key: "total-photos", section: "close-out", label: "Total photos", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "total-photos", prompt: "Total photos", kind: "count" }, at: AT },
  { key: "technician-signature", section: "close-out", label: "Technician signature / date", photo: false, ruler: false, perOccurrence: false, coveringOnly: null, capture: { key: "technician-signature", prompt: "Technician signature / date", kind: "text" }, at: AT },
];

/**
 * The counts line under COVERING CONDITION. Section 8: "The counts called for
 * on the checklist are recorded as counts, not as descriptions." So these are
 * integers in the capture and a text answer is not an answer.
 */
export const RC001_COUNTS: { key: string; prompt: string; at: string }[] = [
  { key: "count-patches", prompt: "patches", at: "Appendix B, COVERING CONDITION, Counts" },
  { key: "count-damaged-units", prompt: "damaged shingles/tiles visible", at: "Appendix B, COVERING CONDITION, Counts" },
  { key: "count-unsealed-tabs", prompt: "unsealed tabs found", at: "Appendix B, COVERING CONDITION, Counts" },
];

/**
 * Sections that print a free "Technician notes / readings" block. Recorded so
 * the phone renders one where the document has one, and nowhere else.
 */
export const RC001_NOTE_BLOCKS: ChecklistSection[] = [
  "context",
  "covering-condition",
  "edges-flashings-penetrations",
  "attic-verification",
  "interior-finish-scan",
  "covering-age-and-exposure",
  "close-out",
];
