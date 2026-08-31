import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Renders a body paragraph that may carry inline internal links.
 *
 * WHY A TOKEN RATHER THAN JSX IN THE CONTENT MODULE
 * -------------------------------------------------
 * Section bodies are plain strings, which is what lets the content modules stay
 * readable and lets voice-audit and placeholder-audit reason about them. But a
 * contextual link has to sit inside a sentence, at the point a reader would want
 * it, and that is not something a page component can do from outside the string.
 *
 * The first version of the cluster pages solved this by special casing one
 * section in the page component and rendering an extra paragraph after it. That
 * works exactly once and then becomes a page component full of conditionals that
 * nobody can find the copy in.
 *
 * So body strings may contain [anchor text](/internal/path), which is written
 * where the link belongs, in the sentence, in the content file. Nothing else in
 * the string is parsed: this is not markdown and does not try to be.
 *
 * INTERNAL PATHS ONLY, DELIBERATELY
 * ---------------------------------
 * The pattern requires a leading slash, so an external URL cannot be smuggled
 * into body copy through it. Cross brand links are sparing and honest and are
 * placed explicitly in a page, not buried in a content string where nobody
 * reviewing the copy would notice one had appeared.
 *
 * THE LINK HAS TO BE INSIDE THE PARAGRAPH
 * ---------------------------------------
 * link-map counts a contextual link only inside p, li, or dd. That is the whole
 * point of putting them here rather than in a related reading block, which link
 * map correctly refuses to count and readers correctly ignore.
 */

const LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

export function proseNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  LINK.lastIndex = 0;

  while ((match = LINK.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <Link key={`${match[2]}-${match.index}`} href={match[2]} className="underline underline-offset-4">
        {match[1]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function ProseParagraph({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return <p className={className}>{proseNodes(text)}</p>;
}
