import { publishedPrice } from "@/lib/ordering";

/**
 * A LINE'S PUBLISHED PRICE, THE SAME SHAPE ON EVERY PAGE THAT STATES ONE.
 * Operator ruling 5 of 2026-10-18: one derived pricing component for /process,
 * /order and the service pages.
 *
 * Every figure comes from publishedPrice, which reads the price book, and the
 * coastal line is its own clause after the figure, never folded into it (the
 * 2026-09-02 ruling about that surcharge). A line with no published figure
 * renders the words it always has, "Quoted per matter.", rather than a blank
 * or a number somebody guessed.
 *
 * A fixed price on a line that cannot be ordered online says it is the price
 * the firm quotes, which is gap 8's ruling of 2026-10-10 in the one place it
 * can be enforced, so no page can show the figure without it.
 */
export function PublishedPrice({ slug, className }: { slug: string; className?: string }) {
  const price = publishedPrice(slug);
  if (!price.figure) return <span className={className}>Quoted per matter.</span>;

  return (
    <span className={className}>
      {price.figure}
      {price.coastal ? `, ${price.coastal}` : ""}
      {price.kind === "fixed" && !price.orderable ? ". Quoted at this price until it can be ordered online." : ""}
    </span>
  );
}
