"use client";
import { money } from "@/lib/ops-money";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ACTION_LABEL, DETERMINATION_ACTION, MIN_REASON_LENGTH, type ReviewAction } from "@/lib/ops-review";
import type { Determination, DeterminationRule } from "@/content/protocols";

/**
 * The decision controls.
 *
 * EVERY BUTTON IS GIVEN EQUAL WEIGHT ON PURPOSE
 * ---------------------------------------------
 * Sealing is not the primary action with escape hatches underneath it.
 * All of them are decisions an engineer might correctly reach, and the layout says
 * so: same size, same prominence, one row. A screen where sealing is a large
 * gold button and declining is a small grey link is a screen applying pressure,
 * whatever the documentation claims.
 *
 * DECLINING USED TO CARRY A RED BORDER, and V10 removed it on 2026-10-03. The
 * note that stood here argued the border was right because declining is "a
 * serious action and not a dangerous one", red fill being for destruction.
 *
 * That argument was answering the wrong question. The paragraph above says every
 * decision gets the same size and the same prominence because a screen that
 * makes one of them look different is applying pressure whatever its
 * documentation claims, and a red outline on exactly one of five buttons is that
 * difference. An engineer declining to seal is doing his job, and this file says
 * two lines further down that the refusals are the part showing judgment was
 * exercised.
 *
 * So the colour went and the parity it was breaking came back. Recorded here
 * rather than deleted, because a reversed argument that leaves no trace reads as
 * an argument nobody made.
 */

const CONFIRM: Record<ReviewAction, string> = {
  seal: "Seal this file",
  revisions: "Send it back",
  site_visit: "Send for a site visit",
  repairs: "Withhold and issue the repair list",
  refuse: "Decline to seal",
};

const HELP: Record<ReviewAction, string> = {
  seal: "Certifies that you reviewed the evidence this protocol required and stand behind the conclusion.",
  revisions: "Goes back to the technician who holds it, with what you need.",
  site_visit: "Goes back through dispatch as a new visit. The current technician is released.",
  repairs:
    "Certification is withheld and the owner gets a repair list. The file waits on them, for as long as it takes, and comes back through dispatch when the work is done. It cannot be sealed until every item on the list is verified one by one.",
  refuse:
    "You examined this package and will not certify it. The reason goes to the client, to your responsible charge log, and to whoever opens the file next. You are paid for the review either way.",
};

export function OpenReviewButton({ fileId, status }: { fileId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    /* V10: no box, no tint. A heading with a 2px ink rule and the text below it. */
    <div className="mb-6 border-b-2 border-[var(--ink)] pb-4">
      <p className="text-[14px] font-semibold text-[var(--ink)]">
        {status === "under_review" ? "This file is in review" : "Not yet in review"}
      </p>
      <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Taking it into review starts the clock. The elapsed time until you decide goes on your
        responsible charge record, which is the record your license stands on, so it is measured
        rather than asked for afterwards.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
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
        className="mt-3 inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-bold text-white disabled:opacity-50"
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
    /*
      V10 rule 4: "Choices are rows with a radio, separated by a 1px line-2
      rule. Not bordered cards."

      These were bordered cards whose only selected state was a navy border,
      which is the hardest kind of selection to see: a one pixel colour change on
      an outline. The row keeps its real radio, so the selected determination is
      legible from across the room and from a screen reader, and the chosen row
      also takes the flat fill V10 uses for a selected row.
    */
    <div className="mt-2 border-t border-[var(--row-rule)]">
      {rules.map((rule) => {
        const selected = chosen === rule.key;
        const follows = DETERMINATION_ACTION[rule.key];
        return (
          <button
            key={rule.key}
            type="button"
            onClick={() => onChoose(rule.key)}
            aria-pressed={selected}
            className={`flex w-full gap-3 border-b border-[var(--row-rule)] py-3.5 pr-3 pl-3 text-left ${
              selected ? "bg-[var(--canvas)]" : "bg-white"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-1 h-[14px] w-[14px] shrink-0 rounded-full border-2 ${
                selected
                  ? "border-[var(--navy)] bg-[var(--navy)]"
                  : "border-[var(--border-strong)] bg-white"
              }`}
            />
            {/*
              EVERYTHING INSIDE THE BUTTON IS PHRASING CONTENT NOW, which it was
              not before and should always have been. A <button> may contain
              phrasing content only, and this held a <p>, a <ul> and six <li>.
              It rendered, so nothing complained, and it was invalid HTML sitting
              inside the control an engineer uses to record a determination. The
              row rewrite was the moment to put it right rather than carry it.
            */}
            <span className="block min-w-0 flex-1">
              <span className="block text-[15px] leading-[1.35] font-semibold text-[var(--ink)]">
                {rule.heading}
              </span>
              {rule.effect ? (
                <span className="mt-1 block max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
                  {rule.effect}
                </span>
              ) : null}
              {selected ? (
                <>
                  <span className="mt-2 block">
                    {rule.criteria.map((c) => (
                      <span
                        key={c}
                        className="mt-1 block max-w-[70ch] text-[14px] leading-[1.5] text-[var(--secondary)]"
                      >
                        {c}
                      </span>
                    ))}
                  </span>
                  {/*
                    The fallback sentence is unreachable today, because all five
                    determinations map since 0053. It is kept for a sixth added
                    to Appendix C, which would arrive here with no action and
                    should say so rather than showing a blank line.
                  */}
                  <span className="mt-2 block text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
                    {follows
                      ? `This records as ${ACTION_LABEL[follows].toLowerCase()}.`
                      : "This platform has no action for this determination yet, so it would be recorded and the file would stay where it is. That is a ruling the firm owes rather than a decision to make here."}
                  </span>
                </>
              ) : null}
            </span>
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
  const [repairList, setRepairList] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ action: ReviewAction; minutes: number; paidCents: number | null } | null>(null);

  if (done) {
    return (
      <div>
        <p className="portal-kicker text-[var(--gold-deep)]">Recorded</p>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.6] text-[var(--ink)]">
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
          className="mt-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
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

  /*
   * Split on lines and trimmed HERE rather than on the server alone, so the
   * count under the box is the count that will be written. A screen that says
   * "3 items" and writes 2 because one was whitespace is a screen the engineer
   * cannot check his own decision against.
   */
  const repairRequirements = repairList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3);

  const determinationReady =
    !governed ||
    (determination !== null &&
      reliedOn.length > 0 &&
      reliedEvidenceIds.length > 0 &&
      (determination !== "repairs-required" || repairRequirements.length > 0));

  return (
    <div>
      <p className="portal-kicker text-[var(--gold-deep)]">Your decision</p>

      {governed ? (
        <div className="mt-2">
          <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
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
            /* V10: no box. A rule above and whitespace do the separating. */
            <div className="mt-5 border-t border-[var(--border)] pt-4">
              <p className="text-[14px] font-semibold text-[var(--ink)]">
                What this determination rests on
              </p>
              <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
                A determination naming nothing it relied on is an opinion with no record behind it.
                Somebody may be asked years from now what you actually looked at.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setReliedOn(items.map((i) => i.itemKey))}
                  className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                >
                  The whole package
                </button>
                <button
                  type="button"
                  onClick={() => setReliedOn([])}
                  className="inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--ink)]"
                >
                  Clear
                </button>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item.itemKey}>
                    <label className="flex min-h-[44px] items-center gap-2.5 text-[14px] leading-[1.45] text-[var(--ink)]">
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
                <p className="mt-2 max-w-[70ch] text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
                  Nothing was captured against the items you have named, so this determination would
                  rest on no evidence at all. Name an item that carries a photograph or a reading.
                </p>
              ) : null}

              <label
                htmlFor="determination-note"
                className="mt-4 block text-[14px] font-semibold text-[var(--ink)]"
              >
                Your note on this determination (optional)
              </label>
              <textarea
                id="determination-note"
                value={determinationNote}
                onChange={(e) => setDeterminationNote(e.target.value)}
                rows={3}
                className="mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate"
              />

              {/*
                * THE REPAIR LIST, ONE REQUIREMENT PER LINE, AND THE LINES ARE
                * THE POINT RATHER THAN A CONVENIENCE.
                *
                * Each becomes its own row, and each is closed on its own at the
                * revisit, because Appendix C says certification proceeds only
                * after repairs are verified item by item. A single paragraph
                * cannot be half closed, so a paragraph would push the judgement
                * back into whoever reads it on the day.
                */}
              {determination === "repairs-required" ? (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  <label
                    htmlFor="repair-list"
                    className="block text-[14px] font-semibold text-[var(--ink)]"
                  >
                    The repair list, one requirement per line
                  </label>
                  <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
                    Each line becomes an item the technician verifies separately on the revisit. This
                    file cannot be sealed until every one of them is closed, so anything written here
                    is something you are requiring before you will certify.
                  </p>
                  <textarea
                    id="repair-list"
                    value={repairList}
                    onChange={(e) => setRepairList(e.target.value)}
                    rows={5}
                    className="mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate"
                  />
                  <p className="mt-1.5 text-[14px] leading-[1.5] text-[var(--secondary)]">
                    {repairRequirements.length === 0
                      ? "Nothing yet. Repairs required issues a repair list, so this cannot be empty."
                      : `${repairRequirements.length} item${repairRequirements.length === 1 ? "" : "s"}, each closed on its own at the revisit.`}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {!complete ? (
        <div className="mt-2">
          <p className="text-[14px] leading-[1.55] text-[var(--secondary)]">
            This package is missing required evidence. It cannot be sealed, because the seal states
            you reviewed the evidence the protocol required. Every other decision is available, and
            on a package that cannot be completed, declining is often the right one.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!inReview ? (
        <p className="mt-2 text-[14px] leading-[1.55] text-[var(--secondary)]">
          Take the file into review first. Deciding without opening it would leave your responsible
          charge record saying a review took no time at all.
        </p>
      ) : null}

      {/* One row, equal weight, however many REVIEW_ACTIONS holds. */}
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
                /*
                  THE FIVE DECISIONS NOW LOOK ALIKE, AND THAT IS THIS SCREEN'S
                  OWN STATED INTENT RATHER THAN HOUSE STYLE ARRIVING TO OVERRULE
                  IT.

                  Declining was drawn in red on an amber tint while the other
                  four were navy. The docstring at the top of review/page.tsx
                  says the screen gives "the same weight given to declining as to
                  sealing", and a red button is not the same weight: red is the
                  colour a person reads as "this one is dangerous, are you sure".
                  An engineer who declines to seal is doing his job correctly,
                  and the record of refusals is the part that shows judgment was
                  exercised, which this file says a few lines further down.

                  So the colour goes and the parity it was breaking is restored.
                  Selected is a navy fill, unselected is a bordered white, for
                  all five.
                */
                className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-[2px] border px-4 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "border-slate bg-slate text-[var(--on-navy)]"
                    : "border-[var(--border)] bg-white text-[var(--ink)] hover:border-slate"
                }`}
              >
                {ACTION_LABEL[action]}
              </button>
              {!allowed && blockedReason ? (
                <p className="mt-1.5 text-[13px] leading-[1.5] text-[var(--secondary)]">{blockedReason}</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {chosen && active?.allowed ? (
        /*
          The chosen decision and what it does. It was a tinted panel; V10 makes
          it a section, which is the heading plus a 2px ink rule. This one is
          worth getting right rather than merely converting: it is the last thing
          an engineer reads before committing a decision that goes on his
          licence, and a heading carries more than a grey box did.

          AND IT IS A BARE BLOCK COMMENT RATHER THAN {SLASH STAR ... STAR SLASH}.
          Inside a parenthesised ternary branch the braced form is a second
          expression where one is allowed, which is the mistake CLAUDE.md records
          and which this file carried twice in one edit until tsc refused it.
        */
        <div className="mt-6 border-t-2 border-[var(--ink)] pt-4">
          <p className="text-[14px] font-semibold text-[var(--ink)]">{ACTION_LABEL[chosen]}</p>
          <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">{HELP[chosen]}</p>

          {chosen !== "seal" ? (
            <div className="mt-3">
              <label htmlFor="decision-reason" className="block text-[14px] font-semibold text-[var(--ink)]">
                {chosen === "refuse" ? "Why you will not seal this" : "What is needed"}
              </label>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                className="mt-1.5 w-full rounded-[2px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--ink)] outline-none focus:border-slate"
              />
              <p className="mt-1.5 text-[13px] text-[var(--secondary)]">
                {reason.trim().length < MIN_REASON_LENGTH
                  ? `${MIN_REASON_LENGTH - reason.trim().length} more character${
                      MIN_REASON_LENGTH - reason.trim().length === 1 ? "" : "s"
                    } needed.`
                  : "That will do."}
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
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
                      repairRequirements,
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
              className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Recording" : CONFIRM[chosen]}
            </button>
            <button
              type="button"
              onClick={() => {
                setChosen(null);
                setReason("");
              }}
              className="inline-flex min-h-[48px] items-center rounded-[2px] px-4 text-[15px] font-semibold text-[var(--secondary)]"
            >
              Back
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
