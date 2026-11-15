"use client";

/**
 * Prints the page. Hidden on the printout itself. Made for the call script
 * (C7) and used, with its own label, by the reports and the order summary
 * (office-ready Batch B: print of the reports and an order summary).
 */
export function PrintButton({ label = "Print this script" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)] print:hidden"
    >
      {label}
    </button>
  );
}
