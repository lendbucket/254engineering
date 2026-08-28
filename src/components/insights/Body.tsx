import Link from "next/link";
import type { ReactNode } from "react";
import type { Block, Source } from "@/content/insights";
import { figures } from "./figures";
import { ExternalLinkIcon } from "@/components/ui/icons";

/**
 * The post body renderer.
 *
 * WHY THERE IS A PARSER HERE AT ALL
 * ---------------------------------
 * Post bodies are written as prose in src/content/insights.ts, and the playbook's
 * linking law requires links to sit in the middle of sentences at the point a
 * reader would want them. Representing that as data means either a markdown
 * dependency or a paragraph shredded into an array of fragments around each
 * link, and the second one makes the copy unreadable in the file where it is
 * actually edited.
 *
 * So paragraphs carry `[label](/path)` and this file is the only thing that
 * understands it. The syntax is deliberately the smallest possible subset: no
 * emphasis, no images, no reference links, no nesting. Anything that is not a
 * link is text.
 */

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

/**
 * Split a string into text and links.
 *
 * Returns an array rather than dangerouslySetInnerHTML on purpose. Copy in this
 * repo contains apostrophes and section symbols and the occasional angle
 * bracket, and the moment prose is injected as HTML a stray character in an
 * edit becomes a rendering bug or worse. React escapes every text node here.
 */
export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  // exec with a /g regex is stateful, so the index is reset before the loop
  // rather than trusting whatever the previous caller left behind.
  LINK.lastIndex = 0;
  while ((match = LINK.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [, label, href] = match;
    const external = /^https?:\/\//i.test(href);
    out.push(
      external ? (
        <a
          key={`${href}-${match.index}`}
          href={href}
          rel="noopener noreferrer"
          className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
        >
          {label}
        </a>
      ) : (
        <Link
          key={`${href}-${match.index}`}
          href={href}
          className="text-slate underline decoration-brass/60 underline-offset-4 hover:decoration-brass"
        >
          {label}
        </Link>
      ),
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function InsightBody({ blocks }: { blocks: Block[] }) {
  return (
    <div className="max-w-[46rem]">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-14 text-[1.5rem] leading-[1.28] font-semibold text-slate sm:text-[1.7rem]"
              >
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-10 text-[1.15rem] leading-[1.35] font-semibold text-slate">
                {block.text}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="mt-6 space-y-4">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-4">
                    <span aria-hidden="true" className="mt-[0.7rem] h-px w-4 shrink-0 bg-brass" />
                    <span className="text-[1.02rem] leading-[1.75] text-slate-muted">
                      {renderInline(item)}
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "note":
            return (
              <aside
                key={i}
                className="mt-10 rounded-[3px] border border-limestone-line bg-limestone-sunk p-6 sm:p-7"
              >
                <p className="font-sans text-[0.7rem] font-semibold tracking-[0.18em] text-brass-ink uppercase">
                  {block.title}
                </p>
                {block.body.map((paragraph, j) => (
                  <p
                    key={j}
                    className={`text-[0.98rem] leading-[1.72] text-slate-muted ${j === 0 ? "mt-4" : "mt-4"}`}
                  >
                    {renderInline(paragraph)}
                  </p>
                ))}
              </aside>
            );
          case "figure":
            return <div key={i}>{figures[block.id]}</div>;
          case "p":
          default:
            return (
              <p key={i} className="mt-6 text-[1.05rem] leading-[1.78] text-slate-muted">
                {renderInline(block.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/**
 * The source list.
 *
 * Rendered on the page rather than kept in the data for the author's benefit.
 * A citation a reader cannot follow is not a citation, and the `supports` line
 * matters as much as the link: it tells the reader which claim to check against
 * which document, which is what makes the list usable rather than decorative.
 */
/**
 * The sources list, which now has to work on a navy band as well as a light one.
 *
 * Every colour is branched rather than inherited. A citation that renders navy
 * on navy is the same defect the hero shipped once, and this list is the one
 * element on a post whose whole job is being checkable.
 */
export function SourceList({ sources, onDark = false }: { sources: Source[]; onDark?: boolean }) {
  return (
    <ol className="mt-9 max-w-[46rem] space-y-6">
      {sources.map((source) => (
        <li
          key={source.url}
          className={`border-l pl-5 ${onDark ? "border-brass/60" : "border-limestone-line"}`}
        >
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            /* inline-flex with a 44px minimum: a citation is a standalone link
               in a source list, not a link inside a sentence, so it gets the
               full thumb target rather than the inline exception. */
            className={`inline-flex min-h-[44px] items-center text-[1rem] leading-[1.6] font-semibold underline underline-offset-4 ${
              onDark
                ? "text-slate-fg decoration-brass-light/70 hover:decoration-brass-light"
                : "text-slate decoration-brass/60 hover:decoration-brass"
            }`}
          >
            {source.label}
            <ExternalLinkIcon className={`ml-1.5 align-baseline ${onDark ? "text-brass-light" : "text-brass-ink"}`} />
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <p className={`mt-2 text-[0.94rem] leading-[1.65] ${onDark ? "text-slate-fg-muted" : "text-slate-muted"}`}>
            {source.supports}
          </p>
        </li>
      ))}
    </ol>
  );
}
