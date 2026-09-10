"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/portal/surfaces";

/**
 * Choosing many files, and doing one thing with them.
 *
 * Phase 12 Section 4, Section 1. The approved prototype draws a selection
 * toolbar here with three buttons; only one of the three describes something
 * this platform can honestly do, and the reasoning for all three is in
 * docs/bulk-actions-reconciliation.md.
 *
 * WHY THE CHECKBOX IS BESIDE THE LINK AND NOT INSIDE IT
 * ------------------------------------------------------
 * The row is a navigation link. A control inside a link is a control whose
 * click a browser may treat as the link's, and on a phone the two targets sit
 * on top of each other. So the row is a flex pair: a checkbox that selects, and
 * a link that opens, each with its own target and its own label.
 *
 * WHAT THE TOOLBAR SAYS WHEN NOTHING IS SELECTED
 * -----------------------------------------------
 * Nothing. It is not rendered at all rather than rendered disabled, because a
 * disabled Export button is a promise that something will happen when it is
 * not, and this screen already has one row of controls competing for a 390px
 * width.
 *
 * THE COUNT IS OF WHAT IS TICKED, NOT OF WHAT WILL COME BACK
 * ------------------------------------------------------------
 * A selected file the actor may not read is dropped by the server, and the
 * export's own preamble prints asked and returned separately when they differ.
 * This number cannot know that and does not pretend to: it says how many rows
 * are ticked here.
 */

export type SelectableFile = {
  id: string;
  file_number: string;
  property_address: string;
  county: string;
  twia_county: boolean;
  status: string;
  statusLabel: string;
  statusTone: "neutral" | "good" | "warn" | "bad";
};

export function FileSelection({
  files,
  selectedId,
  limit,
  canDispatch,
}: {
  files: SelectableFile[];
  selectedId: string | null;
  limit: number;
  /*
   * Whether this person may dispatch at all, decided on the SERVER and
   * passed in. The button is not rendered otherwise. It would be refused
   * anyway, by the page and by sendOffers, and offering a control that will
   * be refused is a screen making a promise the platform will not keep.
   */
  canDispatch: boolean;
}) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const toggle = (id: string) => {
    setProblem(null);
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clear = () => {
    setProblem(null);
    setTicked(new Set());
  };

  async function exportSelected() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/portal/files/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...ticked] }),
      });

      /*
       * THE FAILURE IS READ BEFORE THE FILE IS SAVED.
       *
       * A refusal comes back as JSON with an ok:false, and saving that as a
       * .csv would hand somebody a spreadsheet containing an error message.
       * forms-audit has this rule for every form on the platform: no silent
       * failure and no false success.
       */
      if (!response.ok) {
        const said = await response.json().catch(() => null);
        setProblem((said as { error?: string } | null)?.error ?? "The export did not run.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `selected-files-${ticked.size}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setProblem("The export could not be reached. Nothing was downloaded.");
    } finally {
      setBusy(false);
    }
  }

  const over = ticked.size > limit;

  return (
    <>
      {ticked.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center gap-2 rounded-[4px] border border-[var(--border)] bg-[var(--surface-2,#F6F7F9)] p-3"
          role="group"
          aria-label="Actions for the selected files"
        >
          <p className="text-[13.5px] font-semibold text-[var(--navy)]">
            {ticked.size} selected
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportSelected}
              disabled={busy || over}
              className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[13.5px] font-bold text-[var(--navy)] hover:border-slate disabled:opacity-50"
            >
              {busy ? "Exporting" : "Export"}
            </button>
            {canDispatch && (
              /*
               * A LINK, NOT A BUTTON, and it carries the ids to a review
               * screen rather than doing anything. Operator ruling at gate 1:
               * bulk dispatch is N plans a person reviews, and no technician
               * is chosen by a bulk path that the single path would not have
               * chosen for that file. Nothing is sent from here.
               */
              <Link
                href={`/portal/files/dispatch?ids=${[...ticked].join(",")}`}
                className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[13.5px] font-bold text-[var(--navy)] hover:border-slate"
              >
                Dispatch
              </Link>
            )}
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[13.5px] font-bold text-[var(--secondary)] hover:border-slate"
            >
              Clear
            </button>
          </div>
          {over && (
            <p className="w-full text-[13px] text-[var(--bad,#B3261E)]">
              That is more than {limit}. Export at most {limit} at a time.
            </p>
          )}
          {problem && (
            <p role="alert" className="w-full text-[13px] text-[var(--bad,#B3261E)]">
              {problem}
            </p>
          )}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {files.map((f) => (
          <li key={f.id} className="flex items-start gap-2">
            {/*
              A 44px target of its own. WCAG 2.5.8 is what mobile-audit measures
              and a checkbox drawn at its default size fails it on every row.

              h-[44px] rather than min-h, and items-start on the row: with
              items-stretch this box grew to the card's full height and read
              as a second card sitting beside the first. Found by looking at
              the screenshot at 1280, which is the only way that kind of
              thing is ever found.
            */}
            <label className="flex h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-[4px] border border-[var(--border)] bg-white">
              <input
                type="checkbox"
                checked={ticked.has(f.id)}
                onChange={() => toggle(f.id)}
                className="h-5 w-5 accent-[var(--navy)]"
                aria-label={`Select file ${f.file_number}, ${f.property_address}`}
              />
            </label>
            <Link
              href={`/portal/files?id=${f.id}`}
              className={`block flex-1 rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                selectedId === f.id ? "border-slate" : "border-[var(--border)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[12.5px] text-[var(--gold-deep)]">{f.file_number}</p>
                  <p className="mt-1 text-[13.5px] font-semibold text-[var(--navy)]">{f.property_address}</p>
                  <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">
                    {f.county} County{f.twia_county ? ", windstorm" : ""}
                  </p>
                </div>
                <Chip label={f.statusLabel} tone={f.statusTone} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
