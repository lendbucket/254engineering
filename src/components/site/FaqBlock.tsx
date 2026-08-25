import type { Faq } from "@/content/services";
import { SectionHeading } from "@/components/ui/primitives";

/**
 * The FAQ block on service pages.
 *
 * Rendered as plain headings and paragraphs rather than as a `<details>`
 * accordion, on purpose. FAQPage schema describes answers that are on the page,
 * and collapsed content is content a reader has to work to reach. The block is
 * short enough that hiding it saves nothing worth the cost.
 *
 * The same array feeds faqSchema() on the page that renders this, so the
 * structured data and the visible answers are the same text. Markup describing
 * answers that are not on the page is a manual action waiting to happen.
 */
export function FaqBlock({
  faqs,
  title = "Common questions",
  onDark = false,
}: {
  faqs: Faq[];
  title?: string;
  onDark?: boolean;
}) {
  const rule = onDark ? "divide-slate-fg/15 border-slate-fg/15" : "divide-limestone-line border-limestone-line";
  const q = onDark ? "text-slate-fg" : "text-slate";
  const a = onDark ? "text-slate-fg-muted" : "text-slate-muted";

  return (
    <section>
      <SectionHeading eyebrow="Questions" title={title} onDark={onDark} />
      <dl className={`mt-10 divide-y border-t ${rule}`}>
        {faqs.map((faq) => (
          <div key={faq.q} className="py-7">
            <dt className={`font-display text-[1.12rem] leading-[1.4] font-semibold ${q}`}>
              {faq.q}
            </dt>
            <dd className={`mt-3 max-w-3xl text-[0.98rem] leading-[1.72] ${a}`}>{faq.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
