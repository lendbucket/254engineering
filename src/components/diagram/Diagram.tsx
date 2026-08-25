import type { ReactNode } from "react";
import { SealIcon } from "@/components/ui/icons";

/**
 * The diagram system.
 *
 * WHY THESE ARE HTML AND NOT SVG
 * ------------------------------
 * The obvious way to draw a process diagram is an SVG with text nodes in it, and
 * it is the wrong way here for three reasons that all matter more than the
 * drawing does.
 *
 * SVG text does not reflow. A five step sequence that reads left to right at
 * 1280 has to become top to bottom at 390, and inside a fixed viewBox that means
 * authoring the diagram twice and keeping the two in agreement forever.
 *
 * SVG text is not selectable or searchable in the way body copy is, and a reader
 * who wants to quote a step out of a diagram should be able to.
 *
 * And SVG text is where accessibility quietly fails. A `role="img"` with an
 * aria-label collapses a five step process into one sentence for a screen
 * reader, which is a summary of the diagram rather than the diagram.
 *
 * So these are ordered lists and grids with borders, laid out with CSS. They
 * reflow, they are real text, they inherit the type scale, and axe reads them as
 * the lists they are. Nothing here is drawn that could be written.
 *
 * THE REGISTER
 * ------------
 * Hairline borders, one brass accent, no fills, no shadows, no rounded pills, no
 * icons inside the steps. The playbook's line is that a reader who pauses on an
 * element and wonders about it means the element is wrong, and a process diagram
 * is exactly where decoration creeps in.
 */

/**
 * The figure wrapper.
 *
 * `caption` is required rather than optional. A diagram without a caption is a
 * diagram whose point the reader has to infer, and on a page about statute the
 * point is usually the whole reason the diagram is there.
 */
export function Figure({
  caption,
  children,
  className = "",
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`mt-10 ${className}`}>
      {children}
      <figcaption className="mt-4 border-l border-brass pl-4 text-[0.9rem] leading-[1.6] text-slate-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

export type FlowStep = {
  /** The short label. Kept to a few words: this is a diagram, not a paragraph. */
  title: string;
  /** One sentence. Optional, because some sequences are self explanatory. */
  detail?: string;
};

/**
 * A numbered sequence.
 *
 * An ordered list, because it is one. The numbers are rendered from the data
 * rather than from a CSS counter so they are present in the text layer, which
 * matters when the diagram is describing a statutory order and a reader needs to
 * be able to say "step two".
 */
export function StepFlow({ steps }: { steps: FlowStep[] }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-[3px] border border-limestone-line bg-limestone-line sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((step, i) => (
        <li key={step.title} className="flex flex-col bg-limestone-raised p-5 sm:p-6">
          <span className="font-sans text-[0.75rem] font-semibold tracking-[0.16em] text-brass-ink tabular-nums">
            {String(i + 1).padStart(2, "0")}
          </span>
          <span className="mt-3 font-display text-[1.02rem] leading-[1.35] font-semibold text-slate">
            {step.title}
          </span>
          {step.detail ? (
            <span className="mt-2.5 text-[0.92rem] leading-[1.65] text-slate-muted">
              {step.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * A two column comparison where one side is the rule and the other is the
 * failure it is usually confused with.
 *
 * Built for the procurement post, where the whole difficulty is that the
 * compliant and the non compliant process look identical until you notice when
 * price entered the room.
 */
export function ContrastPair({
  left,
  right,
}: {
  left: { label: string; title: string; points: string[] };
  right: { label: string; title: string; points: string[] };
}) {
  const column = (
    side: { label: string; title: string; points: string[] },
    tone: "good" | "bad",
  ) => (
    <div className="bg-limestone-raised p-5 sm:p-6">
      <span
        className={`font-sans text-[0.72rem] font-semibold tracking-[0.16em] uppercase ${
          tone === "good" ? "text-brass-ink" : "text-slate-muted"
        }`}
      >
        {side.label}
      </span>
      <p className="mt-3 font-display text-[1.02rem] leading-[1.35] font-semibold text-slate">
        {side.title}
      </p>
      <ul className="mt-4 space-y-2.5">
        {side.points.map((point) => (
          <li key={point} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-[0.65rem] h-px w-3 shrink-0 ${tone === "good" ? "bg-brass" : "bg-slate-muted/50"}`}
            />
            <span className="text-[0.92rem] leading-[1.65] text-slate-muted">{point}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid gap-px overflow-hidden rounded-[3px] border border-limestone-line bg-limestone-line sm:grid-cols-2">
      {column(left, "good")}
      {column(right, "bad")}
    </div>
  );
}

/**
 * One document, more than one seal, each carrying its own scope.
 *
 * This is the shape of 22 TAC 137.33 and it is the thing people get wrong about
 * Texas projects: responsibility follows the scope beside each seal rather than
 * attaching to the project as a whole. Drawing it as one bar divided into
 * labelled parts is the only representation that makes that obvious.
 */
export function SealScope({
  document: documentName,
  seals,
}: {
  document: string;
  seals: { engineer: string; scope: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-[3px] border border-limestone-line">
      <div className="border-b border-limestone-line bg-limestone-sunk px-5 py-3.5 sm:px-6">
        <span className="font-sans text-[0.72rem] font-semibold tracking-[0.16em] text-slate-muted uppercase">
          One sealed document
        </span>
        <p className="mt-1.5 font-display text-[1.02rem] font-semibold text-slate">{documentName}</p>
      </div>
      <ul className="grid gap-px bg-limestone-line sm:grid-cols-2">
        {seals.map((seal) => (
          <li key={seal.engineer} className="bg-limestone-raised p-5 sm:p-6">
            <span className="inline-flex items-center gap-2.5">
              <SealIcon className="text-brass" />
              <span className="font-sans text-[0.8rem] font-semibold text-slate">
                {seal.engineer}
              </span>
            </span>
            <p className="mt-3 text-[0.92rem] leading-[1.65] text-slate-muted">{seal.scope}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
