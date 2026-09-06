"use client";

import { useState } from "react";

/**
 * Approved wording, with a way to take it.
 *
 * WHY THE TEXT IS SELECTABLE AS WELL AS COPYABLE
 * ----------------------------------------------
 * navigator.clipboard needs a secure context and a permission that some
 * browsers refuse, and a copy button that silently does nothing is worse than
 * no button. The paragraph is rendered as ordinary selectable text, the button
 * is the convenience, and it says plainly when it could not do it rather than
 * pretending it did.
 */
export function CopyBlock({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("failed");
    }
  }

  return (
    <div>
      <p className="max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">{text}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-[13.5px] font-semibold text-[var(--navy)] active:bg-[var(--canvas)]"
        >
          {state === "copied" ? "Copied" : "Copy"}
        </button>
        {state === "failed" ? (
          <span className="text-[12.5px] leading-[1.5] text-[var(--secondary)]">
            This browser would not let the page use the clipboard. Select the text above instead.
          </span>
        ) : null}
      </div>
    </div>
  );
}
