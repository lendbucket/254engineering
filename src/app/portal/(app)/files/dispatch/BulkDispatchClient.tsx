"use client";

import { useState } from "react";
import Link from "next/link";
import type { DispatchPlanRow } from "@/lib/ops-bulk-dispatch";

/**
 * N plans, N picks, and no shortcut.
 *
 * Phase 12 Section 4, Section 1, operator ruling at gate 1:
 *
 *   Bulk dispatch reproduces the single file dispatch rule exactly and
 *   introduces no selection rule. No technician is chosen by a bulk path that
 *   the single path would not have chosen for that file.
 *
 * The single path preselects nothing: DispatchPanel opens with an empty
 * selection and the dispatcher ticks. So this preselects nothing either, and
 * there is deliberately no "offer to everyone eligible" button, because that
 * would be a rule this screen invented about who gets work.
 *
 * WHAT A BLOCKED FILE DOES HERE
 * ------------------------------
 * It is shown, with the reason, and cannot be ticked. Dropping it would make a
 * file that already has a technician indistinguishable from one that was
 * dispatched, on a screen whose whole job is to say what is about to happen.
 */

export function BulkDispatchClient({ plans }: { plans: DispatchPlanRow[] }) {
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [hours, setHours] = useState("4");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<{
    sent: { fileNumber: string; count: number }[];
    refused: { fileNumber: string; reason: string }[];
  } | null>(null);

  const toggle = (fileId: string, techId: string) => {
    setProblem(null);
    setPicks((prev) => {
      const current = prev[fileId] ?? [];
      const next = current.includes(techId)
        ? current.filter((t) => t !== techId)
        : [...current, techId];
      return { ...prev, [fileId]: next };
    });
  };

  const chosenFiles = Object.values(picks).filter((t) => t.length > 0).length;
  const chosenOffers = Object.values(picks).reduce((n, t) => n + t.length, 0);

  async function send() {
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch("/api/portal/files/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          picks: Object.entries(picks).map(([fileId, techIds]) => ({ fileId, techIds })),
          expiresInHours: Number(hours) || 4,
        }),
      });
      const said = await response.json().catch(() => null);
      if (!response.ok || !said?.ok) {
        setProblem(said?.error ?? "The dispatch did not run.");
        return;
      }
      /*
       * BOTH HALVES ARE SHOWN. A screen that reported only what was sent would
       * be describing work that partly did not happen, which is the rule
       * ops-bulk already follows for a batch of orders.
       */
      setDone({ sent: said.sent ?? [], refused: said.refused ?? [] });
      setPicks({});
    } catch {
      setProblem("The dispatch could not be reached. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-[4px] border border-[var(--border)] bg-white p-4">
          <p className="text-[13.5px] font-bold text-[var(--navy)]">
            {done.sent.length === 0
              ? "Nothing was sent."
              : `Offers sent for ${done.sent.length} file${done.sent.length === 1 ? "" : "s"}.`}
          </p>
          {done.sent.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1">
              {done.sent.map((s) => (
                <li key={s.fileNumber} className="font-mono text-[12.5px] text-[var(--secondary)]">
                  {s.fileNumber}: {s.count} offer{s.count === 1 ? "" : "s"}
                </li>
              ))}
            </ul>
          )}
          {done.refused.length > 0 && (
            <>
              <p className="mt-4 text-[13.5px] font-bold text-[var(--navy)]">
                {done.refused.length} refused, and why:
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                {done.refused.map((r) => (
                  <li key={r.fileNumber} className="text-[13px] text-[var(--secondary)]">
                    <span className="font-mono text-[12.5px]">{r.fileNumber}</span>: {r.reason}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <Link
          href="/portal/files"
          className="inline-flex min-h-[44px] w-fit items-center rounded-[3px] border border-[var(--border)] bg-white px-3 text-[13.5px] font-bold text-[var(--navy)] hover:border-slate"
        >
          Back to the files
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[4px] border border-[var(--border)] bg-[var(--surface-2,#F6F7F9)] p-3">
        <p className="text-[13.5px] font-semibold text-[var(--navy)]">
          {chosenOffers === 0
            ? "Nothing chosen yet"
            : `${chosenOffers} offer${chosenOffers === 1 ? "" : "s"} across ${chosenFiles} file${chosenFiles === 1 ? "" : "s"}`}
        </p>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-[var(--secondary)]">
          Expires in
          <input
            type="number"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-[44px] w-[72px] rounded-[3px] border border-[var(--border)] px-2 text-[13.5px] text-[var(--navy)]"
            aria-label="Hours until the offers expire"
          />
          hours
        </label>
        <button
          type="button"
          onClick={send}
          disabled={busy || chosenOffers === 0}
          className="inline-flex min-h-[44px] items-center rounded-[3px] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-[var(--on-navy)] disabled:opacity-50"
        >
          {busy ? "Sending" : "Send the offers"}
        </button>
        {problem && (
          <p role="alert" className="w-full text-[13px] text-[var(--bad,#B3261E)]">
            {problem}
          </p>
        )}
      </div>

      {plans.map((plan) => (
        <div key={plan.fileId} className="rounded-[4px] border border-[var(--border)] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] text-[var(--gold-deep)]">{plan.fileNumber}</p>
              <p className="mt-1 text-[13.5px] font-semibold text-[var(--navy)]">{plan.propertyAddress}</p>
              <p className="mt-0.5 text-[13.5px] text-[var(--secondary)]">{plan.county} County</p>
            </div>
            <Link
              href={`/portal/files?id=${plan.fileId}`}
              className="text-[13px] font-semibold text-[var(--navy)] underline"
            >
              Open the file
            </Link>
          </div>

          {plan.blocked ? (
            <p className="mt-3 rounded-[3px] border border-[var(--border)] bg-[var(--canvas)] p-3 text-[13px] text-[var(--secondary)]">
              {plan.blocked}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {plan.offers.map((o) => (
                <li key={o.techId}>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[3px] border border-[var(--border)] px-3 py-2">
                    <input
                      type="checkbox"
                      checked={(picks[plan.fileId] ?? []).includes(o.techId)}
                      onChange={() => toggle(plan.fileId, o.techId)}
                      className="h-5 w-5 accent-[var(--navy)]"
                      aria-label={`Offer ${plan.fileNumber} to ${o.displayName}`}
                    />
                    <span className="min-w-0 flex-1 text-[13.5px] text-[var(--navy)]">{o.displayName}</span>
                    <span className="text-[12.5px] text-[var(--secondary)]">
                      {o.miles === null ? "distance unknown" : `${Math.round(o.miles)} mi`} &middot;{" "}
                      {o.openJobs} open
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {/*
            The ineligible list, with reasons. A shorter list of eligible
            technicians is not an answer to "who could do this": the dispatcher
            needs to know that somebody was left out and why, or a coverage gap
            reads as nobody being available today.
          */}
          {plan.ineligible.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[13px] text-[var(--secondary)]">
                {plan.ineligible.length} not eligible for this file
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {plan.ineligible.map((i) => (
                  <li key={i.id} className="text-[13px] text-[var(--secondary)]">
                    {i.displayName}: {i.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
