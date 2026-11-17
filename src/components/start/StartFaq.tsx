/**
 * The /start questions, as native disclosure: no script, so it costs the phone
 * nothing to load, and the keyboard and screen readers get the browser's own
 * behaviour. Square corners, a hairline between items, no boxes.
 */
export function StartFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="mt-6 border-t border-[var(--color-limestone-line)]">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-[var(--color-limestone-line)]">
          <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-[16px] font-semibold text-slate">
            {item.q}
            <span aria-hidden="true" className="text-[20px] text-[var(--color-ink-quiet)] group-open:rotate-45">+</span>
          </summary>
          <p className="pb-5 text-[15px] leading-[1.7] text-[var(--color-ink-quiet)]">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
