"use client";
import { money } from "@/lib/ops-money";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABEL, DETERMINATION_ACTION, MIN_REASON_LENGTH, type ReviewAction } from "@/lib/ops-review";
import type { Determination, DeterminationRule } from "@/content/protocols/rc-001-decisions";

/**
 * The decision controls.
 *
 * THE FOUR BUTTONS ARE GIVEN EQUAL WEIGHT ON PURPOSE
 * ---------------------------------------------------
 * Sealing is not the primary action with three escape hatches underneath it.
 * All four are decisions an engineer might correctly reach, and the layout says
 * so: same size, same prominence, one row. A screen where sealing is a large
 * gold button and declining is a small grey link is a screen applying pressure,
 * whatever the documentation claims.
 *
 * Declining carries a red border rather than a red fill, because it is a
 * serious action and not a dangerous one. Red fill is for destruction; this is
 * a professional judgment the platform exists to support.
 */

const CONFIRM: Record<ReviewAction, string> = {
  seal: "Seal this file",
  revisions: "Send it back",
  site_visit: "Send for a site visit",
  refuse: "Decline to seal",
};

const HELP: Record<ReviewAction, string> = {
  seal: "Certifies that you reviewed the evidence this protocol required and stand behind the conclusion.",
  revisions: "Goes back to the technician who holds it, with what you need.",
  site_visit: "Goes back through dispatch as a new visit. The current technician is released.",
  refuse:
    "You examined this package and will not certify it. The reason goes to the client, to your responsible charge log, and to whoever opens the file next. You are paid for the review either way.",
};

export function OpenReviewButton({ fileId, status }: { fileId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mb-6 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] px-4 py-3">
      <p className="text-[13.5px] font-semibold text-[var(--navy)]">
        {status === "under_review" ? "This file is in review" : "Not yet in review"}
      </p>
      <p className="mt-1 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
        Taking it into review starts the clock. The elapsed time until you decide goes on your
        responsible charge record, which is the record your licence stands on, so it is measured
        rather than asked for afterwards.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            const res = await fetch("/api/portal/review", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "open_review", fileId }),
            });
            const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!res.ok || !body?.ok) {
              setError(body?.error ?? "That did not work.");
              return;
            }
            router.refresh();
          } catch {
            setError("The network dropped that. Try again.");
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Opening" : "Take this into review"}
      </button>
    </div>
  );
}

/**
 * APPENDIX C IN FRONT OF THE ENGINEER, WHICH IS WHERE THE DOCUMENT PUTS IT.
 *
 * rc-001-decisions.ts says so in its own header: the criteria are the rule he
 * applies, not reference material behind a link, and a rule nobody is shown is
 * a rule somebody reconstructs from memory.
 *
 * THE DETERMINATION IS CHOSEN AND THE ACTION FOLLOWS, rather than both being
 * asked. Asking twice is how a record ends up holding a determination of PASS
 * beside an action of "decline to seal", and the server refuses that
 * combination anyway, so offering it here would only be offering an error.
 */
function DeterminationStep({
  rules,
  chosen,
  onChoose,
}: {
  rules: DeterminationRule[];
  chosen: Determination | null;
  onChoose: (d: Determination) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {rules.map((rule) => {
        const selected = chosen === rule.key;
        const follows = DETERMINATION_ACTION[rule.key];
        return (
          <button
            key={rule.key}
            type="button"
            onClick={() => onChoose(rule.key)}
            aria-pressed={selected}
            className={`rounded-[4px] border p-3.5 text-left ${
              selected ? "border-[var(--navy)] bg-white" : "border-[var(--border)] bg-white"
            }`}
          >
            <p className="text-[15px] leading-[1.35] font-bold text-[var(--navy)]">{rule.heading}</p>
            {rule.effect ? (
              <p className="mt-1 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                {rule.effect}
              </p>
            ) : null}
            {selected ? (
              <>
                <ul className="mt-2 flex flex-col gap-1">
                  {rule.criteria.map((c) => (
                    <li key={c} className="max-w-[70ch] text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[13.5px] leading-[1.5] font-semibold text-[var(--navy)]">
                  {follows
                    ? `This records as ${ACTION_LABEL[follows].toLowerCase()}.`
                    : "This platform has no status for a file waiting on an owner to have repairs done, so the determination is recorded and the file stays where it is. That is a ruling the firm owes, not a decision to make here."}
                </p>
              </>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function DecisionPanel({
  fileId,
  actions,
  complete,
  blockers,
  inReview,
  protocolDocument,
  determinationRules,
  items,
}: {
  fileId: string;
  actions: { action: ReviewAction; allowed: boolean; reason?: string }[];
  complete: boolean;
  blockers: string[];
  inReview: boolean;
  /** Null when no signed protocol governs this file, and then Appendix C does not apply. */
  protocolDocument: string | null;
  determinationRules: DeterminationRule[];
  items: { itemKey: string; label: string; captures: { id: string }[] }[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<ReviewAction | null>(null);
  const [determination, setDetermination] = useState<Determination | null>(null);
  const [reliedOn, setReliedOn] = useState<string[]>([]);
  const [determinationNote, setDeterminationNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ action: ReviewAction; minutes: number; paidCents: number | null } | null>(null);

  if (done) {
    return (
      <div>
        <p className="portal-kicker text-[var(--gold-deep)]">Recorded</p>
        <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--navy)]">
          {done.action === "refuse"
            ? "You declined to seal this file."
            : `Decision recorded: ${ACTION_LABEL[done.action].toLowerCase()}.`}{" "}
          {done.minutes} minute{done.minutes === 1 ? "" : "s"} of review time is on your responsible
          charge record.
          {done.paidCents !== null
            ? ` Production of ${money(done.paidCents)} is on the ledger, pending approval.`
            : " No production rate is set for this service line, so nothing was written to the ledger."}
        </p>
        <a
          href="/portal/review"
          className="mt-4 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline underline-offset-4"
        >
          Back to the queue
        </a>
      </div>
    );
  }

  const active = chosen ? actions.find((a) => a.action === chosen) : null;
  const governed = protocolDocument !== null && determinationRules.length > 0;

  /*
   * WHICH ITEMS THE ENGINEER HAS NAMED, AND THE PHOTOGRAPHS UNDER THEM.
   *
   * The evidence ids are derived from the items he ticked rather than ticked
   * separately. 0051 wants both arrays and they answer one question: what did
   * he look at. Asking a man to tick fifty one items and then a hundred and
   * forty photographs one by one is how the record becomes whatever is fastest
   * to click.
   */
  const reliedEvidenceIds = items
    .filter((i) => reliedOn.includes(i.itemKey))
    .flatMap((i) => i.captures.map((c) => c.id));

  const determinationReady =
    !governed ||
    (determination !== null && reliedOn.length > 0 && reliedEvidenceIds.length > 0);

  return (
    <div>
      <p className="portal-kicker text-[var(--gold-deep)]">Your decision</p>

      {governed ? (
        <div className="mt-2">
          <p className="max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            {protocolDocument} Appendix C. One determination is recorded per review, with the items
            it rests on.
          </p>
          <DeterminationStep
            rules={determinationRules}
            chosen={determination}
            onChoose={(d) => {
              setDetermination(d);
              /*
               * The action follows the determination rather than being chosen
               * beside it. Where a determination maps to nothing, the action is
               * cleared instead of guessed.
               */
              setChosen(DETERMINATION_ACTION[d]);
            }}
          />

          {determination ? (
            <div className="mt-4 rounded-[4px] border border-[var(--border)] bg-white p-4">
              <p className="text-[13.5px] font-semibold text-[var(--navy)]">
                What this determination rests on
              </p>
              <p className="mt-1 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                A determination naming nothing it relied on is an opinion with no record behind it.
                Somebody may be asked years from now what you actually looked at.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReliedOn(items.map((i) => i.itemKey))}
                  className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)]"
                >
                  The whole package
                </button>
                <button
                  type="button"
                  onClick={() => setReliedOn([])}
                  className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)]"
                >
                  Clear
                </button>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item.itemKey}>
                    <label className="flex min-h-[44px] items-center gap-2.5 text-[13.5px] leading-[1.45] text-[var(--navy)]">
                      <input
                        type="checkbox"
                        checked={reliedOn.includes(item.itemKey)}
                        onChange={(e) =>
                          setReliedOn((prev) =>
                            e.target.checked
                              ? [...prev, item.itemKey]
                              : prev.filter((k) => k !== item.itemKey),
                          )
                        }
                        className="h-5 w-5 shrink-0"
                      />
                      <span>
                        {item.label}
                        {item.captures.length > 0 ? (
                          <span className="text-[var(--secondary)]">
                            {" "}
                            ({item.captures.length} captured)
                          </span>
                        ) : (
                          <span className="text-[var(--secondary)]"> (nothing captured)</span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {reliedOn.length > 0 && reliedEvidenceIds.length === 0 ? (
                <p className="mt-2 max-w-[70ch] text-[13.5px] leading-[1.5] font-semibold text-[var(--red)]">
                  Nothing was captured against the items you have named, so this determination would
                  rest on no evidence at all. Name an item that carries a photograph or a reading.
                </p>
              ) : null}

              <label
                htmlFor="determination-note"
                className="mt-4 block text-[13.5px] font-semibold text-[var(--navy)]"
              >
                Your note on this determination (optional)
              </label>
              <textarea
                id="determination-note"
                value={determinationNote}
                onChange={(e) => setDeterminationNote(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--navy)] outline-none focus:border-slate"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!complete ? (
        <div className="mt-2">
          <p className="text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            This package is missing required evidence. It cannot be sealed, because the seal states
            you reviewed the evidence the protocol required. Every other decision is available, and
            on a package that cannot be completed, declining is often the right one.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[13.5px] leading-[1.5] text-[var(--red)]">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!inReview ? (
        <p className="mt-2 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
          Take the file into review first. Deciding without opening it would leave your responsible
          charge record saying a review took no time at all.
        </p>
      ) : null}

      {/* Four buttons, one row, equal weight. */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map(({ action, allowed, reason: blockedReason }) => {
          const isRefusal = action === "refuse";
          const selected = chosen === action;
          return (
            <div key={action}>
              <button
                type="button"
                disabled={!allowed || !inReview}
                onClick={() => {
                  setChosen(action);
                  setError(null);
                }}
                className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-[3px] border px-4 text-[15px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? isRefusal
                      ? "border-[var(--red)] bg-[var(--warn-bg)] text-[var(--red)]"
                      : "border-slate bg-slate text-[var(--on-navy)]"
                    : isRefusal
                      ? "border-[var(--red)] bg-white text-[var(--red)] hover:bg-[var(--warn-bg)]"
                      : "border-[var(--border)] bg-white text-[var(--navy)] hover:border-slate"
                }`}
              >
                {ACTION_LABEL[action]}
              </button>
              {!allowed && blockedReason ? (
                <p className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">{blockedReason}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {chosen && active?.allowed ? (
        <div className="mt-5 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] p-4">
          <p className="text-[13.5px] font-semibold text-[var(--navy)]">{ACTION_LABEL[chosen]}</p>
          <p className="mt-1 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">{HELP[chosen]}</p>

          {chosen !== "seal" ? (
            <div className="mt-3">
              <label htmlFor="decision-reason" className="block text-[13.5px] font-semibold text-[var(--navy)]">
                {chosen === "refuse" ? "Why you will not seal this" : "What is needed"}
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--navy)] outline-none focus:border-slate"
              />
              <p className="mt-1.5 text-[12.5px] text-[var(--secondary)]">
                {reason.trim().length < MIN_REASON_LENGTH
                  ? `${MIN_REASON_LENGTH - reason.trim().length} more character${
                      MIN_REASON_LENGTH - reason.trim().length === 1 ? "" : "s"
                    } needed.`
                  : "That will do."}
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-[13.5px] leading-[1.5] font-semibold text-[var(--red)]">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !determinationReady}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const res = await fetch("/api/portal/review", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "decide",
                      fileId,
                      decision: chosen,
                      reason: reason.trim() || null,
                      determination,
                      reliedOnItemKeys: reliedOn,
                      reliedOnEvidenceIds: reliedEvidenceIds,
                      determinationNote: determinationNote.trim() || null,
                    }),
                  });
                  const body = (await res.json().catch(() => null)) as {
                    ok?: boolean;
                    error?: string;
                    action?: ReviewAction;
                    minutes?: number;
                    paidCents?: number | null;
                  } | null;
                  if (!res.ok || !body?.ok) {
                    setError(body?.error ?? "That did not work.");
                    return;
                  }
                  setDone({
                    action: body.action ?? chosen,
                    minutes: body.minutes ?? 0,
                    paidCents: body.paidCents ?? null,
                  });
                  router.refresh();
                } catch {
                  setError("The network dropped that. Try again.");
                } finally {
                  setBusy(false);
                }
              }}
              className={`inline-flex min-h-[48px] items-center justify-center rounded-[3px] px-5 text-[15px] font-bold disabled:opacity-50 ${
                chosen === "refuse"
                  ? "border border-[var(--red)] bg-[var(--red)] text-white"
                  : "bg-[var(--navy)] text-white"
              }`}
            >
              {busy ? "Recording" : CONFIRM[chosen]}
            </button>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setReason("");
              }}
              className="inline-flex min-h-[48px] items-center rounded-[3px] px-4 text-[15px] font-semibold text-[var(--secondary)]"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
