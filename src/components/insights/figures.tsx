import type { ReactNode } from "react";
import { ContrastPair, Figure, SealScope, StepFlow } from "@/components/diagram/Diagram";

/**
 * The figures the editorial corpus can embed, by id.
 *
 * WHY A REGISTRY RATHER THAN COMPONENTS IN THE CONTENT FILE
 * ---------------------------------------------------------
 * src/content/insights.ts is a .ts data module, not .tsx, and keeping it that
 * way is deliberate: the moment prose data can contain JSX, prose data starts
 * containing layout, and the content file stops being reviewable as writing.
 *
 * So a post refers to a figure by a string id, this file owns the markup, and
 * the union type below means a typo in a post is a type error rather than a
 * silently missing diagram.
 *
 * Every figure here is built from the primitives in components/diagram. None of
 * them is bespoke, which is the constraint that keeps the set coherent: a
 * diagram that cannot be expressed with the primitives is usually a diagram that
 * wants to be a paragraph.
 */

export type FigureId =
  | "qbs-sequence"
  | "qbs-compliant-versus-not"
  | "seal-scope"
  | "evidence-chain";

export const figures: Record<FigureId, ReactNode> = {
  "qbs-sequence": (
    <Figure caption="Sections 2254.004(a) through (c). The order is the mechanism: qualifications are ranked before any fee is discussed, and negotiations with one provider are formally ended before the next begins.">
      <StepFlow
        steps={[
          {
            title: "Rank on qualifications",
            detail:
              "The entity selects the most highly qualified provider on demonstrated competence and qualifications. No fee has been discussed.",
          },
          {
            title: "Negotiate with that one",
            detail:
              "A contract is attempted with the selected provider at a fair and reasonable price.",
          },
          {
            title: "End negotiations formally",
            detail:
              "If no satisfactory contract is reached, negotiations with that provider are formally ended before anyone else is approached.",
          },
          {
            title: "Move to the next",
            detail:
              "The next most highly qualified provider is selected and the process repeats until a contract is entered into.",
          },
        ]}
      />
    </Figure>
  ),

  "qbs-compliant-versus-not": (
    <Figure caption="Both processes solicit qualifications and both end in a contract. The difference is whether price was in the room while the ranking was made, which is what section 2254.003 turns on.">
      <ContrastPair
        left={{
          label: "What the statute sets",
          title: "Qualifications, then price",
          points: [
            "Qualifications are ranked with no fee information held.",
            "One provider is selected, then a fee is negotiated with that provider.",
            "A failed negotiation is formally ended before the next provider is approached.",
          ],
        }}
        right={{
          label: "The usual failure",
          title: "Qualifications, scored on price",
          points: [
            "Fee proposals are collected alongside qualifications.",
            "Respondents are ranked on a matrix in which price carries weight.",
            "Two providers are kept in play at once so the fees can be compared.",
          ],
        }}
      />
    </Figure>
  ),

  "seal-scope": (
    <Figure caption="Rule 137.33 on a document more than one licensee worked on. Each seal carries a notation describing the work done under that licensee's responsible charge, so responsibility follows the scope rather than attaching to the project.">
      <SealScope
        document="A plan set for a single structure"
        seals={[
          {
            engineer: "Seal one",
            scope:
              "Notation describing the structural scope prepared under this licensee's responsible charge.",
          },
          {
            engineer: "Seal two",
            scope:
              "Notation describing the civil scope prepared under a different licensee's responsible charge.",
          },
        ]}
      />
    </Figure>
  ),

  "evidence-chain": (
    <Figure caption="Why the two roles are kept apart. Rule 131.2 requires control over the work and detailed professional knowledge of it, which a licensee cannot have of a conclusion somebody else reached.">
      <StepFlow
        steps={[
          {
            title: "Written protocol",
            detail:
              "What is measured, what is photographed, in what order, and what is recorded when a condition cannot be observed.",
          },
          {
            title: "Field record",
            detail:
              "A technician documents conditions against the protocol. Photographs are keyed to locations. No conclusion is reached.",
          },
          {
            title: "Review of the evidence",
            detail:
              "A licensee reads the record rather than a summary of it, which is what detailed professional knowledge means.",
          },
          {
            title: "The sealed opinion",
            detail:
              "The licensee forms the opinion, states its limitations, and applies the seal that delineates its scope.",
          },
        ]}
      />
    </Figure>
  ),
};
