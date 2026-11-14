"use client";

/** Prints the script. Hidden on the printout itself. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)] print:hidden"
    >
      Print this script
    </button>
  );
}
