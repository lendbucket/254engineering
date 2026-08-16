/**
 * Typographic wordmark placeholder.
 *
 * PENDING: a commissioned logo will replace this. Everything that shows the mark
 * renders this component, including the favicon set and the OG image, both of
 * which are rasterized from it by scripts/brand-rasters.mjs. So the swap when
 * the artwork lands is this file plus one script run, not a hunt through the
 * repo for hardcoded lockups.
 *
 * The construction is the name story in miniature: the number first, at display
 * weight, because the number is what the firm is called; a brass hairline; then
 * the descriptor, tracked out and small, the way a firm sets its own name on a
 * cover sheet rather than the way a product sets a logo.
 */
export function Wordmark({
  onDark = false,
  className = "",
}: {
  onDark?: boolean;
  className?: string;
}) {
  const numeral = onDark ? "text-slate-fg" : "text-slate";
  const rule = onDark ? "bg-brass-light" : "bg-brass";
  const descriptor = onDark ? "text-slate-fg-muted" : "text-slate-muted";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span className={`font-display text-[1.7rem] leading-none font-semibold tracking-tight ${numeral}`}>
        254
      </span>
      <span aria-hidden="true" className={`h-7 w-px ${rule}`} />
      <span
        className={`font-sans text-[0.62rem] leading-[1.35] font-medium tracking-[0.19em] uppercase ${descriptor}`}
      >
        Engineering
        <br />
        Services
      </span>
    </span>
  );
}
