/**
 * ===========================================================================
 * HOW THE ORDER FORM ASKS WHAT A SIGNED PROTOCOL REQUIRES. THE THIRD LAYER.
 * ===========================================================================
 *
 * Order flow v2, from docs/order-flow-v2-findings.md (feat/order-flow-v2):
 * "The protocol is what the firm must ASK. It is not how the firm must WORD the
 * question." The transcription stays verbatim in src/content/protocols, proved
 * against the engineer's PDF; the bridge in data/protocol-fields.ts still
 * derives one field per question, which is what guarantees the form asks
 * everything the signed document requires. This file is the wording a customer
 * reads, keyed to the protocol's own question numbers, so nothing the document
 * says to staff ("record exactly", "likely decline", a literal "--") reaches a
 * page.
 *
 * THREE SHAPES, AND EACH QUESTION HAS EXACTLY ONE:
 *
 *   label        asked in these words. Where the same fact was ALSO asked by a
 *                customer field in data/intake-fields.ts, `supersedes` names
 *                that field and it is dropped for this line, so a fact is asked
 *                once. The protocol's field is kept rather than the customer
 *                field because its id is what the routing, the uploads and the
 *                letter read, and because section 6 requires the purpose and
 *                the recipient as free text, which the customer's dropdown for
 *                "why" was not.
 *   byOrder      not asked as a field at all, because the order's own step
 *                already asks it (the property address and county). Counted:
 *                the proof allows exactly the ones declared here.
 *
 * proved by scripts/proofs/no-protocol-sentence-reaches-the-order-form.mjs.
 */

export type QuestionPhrasing =
  | {
      label: string;
      help?: string;
      /** For a flag question, the label of its optional detail field. */
      detailLabel?: string;
      /** For a question the order form offers as a choice, the choices. */
      options?: string[];
      /** Customer fields in data/intake-fields.ts that asked the same fact, dropped for this line. */
      supersedes?: string[];
      /** A note shown to the operator in captures, never to a customer. */
      pending?: string;
    }
  | { byOrder: string };

export type ProtocolPhrasing = {
  questions: Record<number, QuestionPhrasing>;
  uploads: Record<string, string>;
};

export const PROTOCOL_PHRASING: Record<string, ProtocolPhrasing> = {
  "254-RC-001": {
    questions: {
      1: {
        label: "What is the letter for? Tell us in your own words, for example insurance, a home sale, a lender or a permit.",
        help: "The letter is written for this purpose and no other.",
        supersedes: ["reason"],
      },
      2: {
        label: "Who should the letter be addressed to?",
        help: "The insurer, buyer, lender or city, exactly as it should appear on the letter.",
        supersedes: ["addressed_to"],
      },
      3: { label: "Is there a date you need it by?", supersedes: ["hard_deadline"] },
      4: { byOrder: "the property address and county, asked on the order's own address step" },
      5: {
        label: "What kind of building is it, and how many stories?",
        help: "For example a single family house, a duplex, a townhome or a small commercial building.",
        supersedes: ["property_type"],
      },
      6: { label: "When was the building built, how old is the roof, and when was it last fully replaced? Whatever you know." },
      7: { label: "What is the roof covered with? For example shingle, metal, tile, a flat membrane, built-up or wood." },
      8: { label: "Is there an open insurance claim on this roof?", detailLabel: "If yes, tell us about the claim." },
      9: { label: "Is the roof part of a lawsuit, or has one been threatened?", detailLabel: "If yes, tell us what it is about." },
      10: { label: "Is the roof leaking anywhere right now?", detailLabel: "If yes, where?" },
      11: {
        label: "Has another engineer or inspector already written a report saying something is wrong with the roof?",
        detailLabel: "If yes, who wrote it, and when?",
      },
      12: { label: "Has the roof had storm damage in the last 12 months?", detailLabel: "If yes, when, and was it hail or wind?" },
      /*
       * THE ATTIC, OPERATOR RULING OF 2026-10-05: three options for now, "not
       * sure" included, pending the engineer of record. Declared here and only
       * here, so his eventual answer is one edit.
       */
      13: {
        label: "Can the technician get into the attic?",
        options: ["Yes", "No", "Not sure"],
        pending: "Three options by the operator's ruling of 2026-10-05, pending the engineer of record.",
      },
      14: { label: "How steep is the roof? Walkable, steep, or very steep, as best you can tell." },
      15: {
        label: "Is anybody living there, and if so, can the technician get in?",
        supersedes: ["occupancy"],
      },
      16: {
        label:
          "Do you have any of these you can share: earlier roof certifications, roofing invoices or a warranty, permits, letters from an insurer, or photos of problems?",
      },
    },
    uploads: {
      "front-of-property": "A photo of the front of the property",
      "adverse-report": "The report or letter behind this request, if there is one",
      "roofing-contract": "The contract, invoice or warranty for the most recent roof work",
      "permits-hoa": "Permits for the roof work, and the HOA approval if there is one",
      "customer-photos": "Your own photos of any problem areas",
      "prior-inspection-report": "An earlier roof inspection report",
    },
  },
};
