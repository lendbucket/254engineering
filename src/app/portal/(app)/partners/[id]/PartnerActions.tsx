"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Everything an operator does to one partner.
 *
 * ONE CLIENT FILE, SEVERAL SMALL FORMS
 * ------------------------------------
 * They share a submit helper and a way of showing what came back, and splitting
 * them into six files would mean six copies of the same error handling. What
 * they do not share is a form: each one posts its own action and says its own
 * thing, because "saved" on a screen where one of the buttons issues a
 * statement to somebody outside the firm is not good enough.
 */

const FIELD =
  "mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]";
const LABEL = "block text-[13.5px] font-semibold text-[var(--ink)]";
const PRIMARY =
  "min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-45";
const SECONDARY =
  "min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border-strong)] px-3 text-[13.5px] font-semibold text-[var(--navy)] active:bg-[var(--canvas)] disabled:opacity-45";

type Result = { ok: boolean; error?: string; note?: string; setPasswordUrl?: string; expiresAt?: string };

function useAction(partnerId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/portal/partners/${partnerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as Result | null;
      setResult(payload ?? { ok: false, error: "That came back as nothing." });
      if (payload?.ok) router.refresh();
    } catch {
      setResult({ ok: false, error: "The network dropped that. Try again." });
    }
    setBusy(false);
  }

  return { busy, result, run };
}

function Feedback({ result }: { result: Result | null }) {
  if (!result) return null;
  return result.ok ? (
    <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--green-border)] bg-[var(--green-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--green)]">
      {result.note ?? "Done."}
    </p>
  ) : (
    <p
      role="alert"
      className="mt-3 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
    >
      {result.error}
    </p>
  );
}

// ------------------------------------------------------------------- status

export function StatusForm({ partnerId, status }: { partnerId: string; status: string }) {
  const { busy, result, run } = useAction(partnerId);
  const [next, setNext] = useState(status === "active" ? "suspended" : "active");
  const [reason, setReason] = useState("");

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="status" className={LABEL}>
            Set the partner to
          </label>
          <select id="status" value={next} onChange={(e) => setNext(e.target.value)} className={FIELD}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div>
          <label htmlFor="statusReason" className={LABEL}>
            Why
          </label>
          <input
            id="statusReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        Suspending stops their links earning as well as stopping them signing in, because the code
        resolver refuses a partner who is not active. It does not touch the ledger: what they earned
        before is still owed, and refusing to pay for work already delivered is a different decision
        from ending a relationship.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => run({ action: "status", status: next, reason })}
        className={`${SECONDARY} mt-3`}
      >
        {busy ? "Recording" : "Record this"}
      </button>
      <Feedback result={result} />
    </div>
  );
}

// -------------------------------------------------------------------- terms

export function TermsForm({ partnerId }: { partnerId: string }) {
  const { busy, result, run } = useAction(partnerId);
  const [model, setModel] = useState("percent_of_order");
  const [percent, setPercent] = useState("2.5");
  const [flat, setFlat] = useState("50.00");
  const [holdback, setHoldback] = useState("30");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const needsPercent = model === "percent_of_order";
  const needsFlat = model === "flat_per_order" || model === "flat_per_qualified_lead";
  const isTiered = model === "tiered_by_volume";

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="model" className={LABEL}>
            Model
          </label>
          <select id="model" value={model} onChange={(e) => setModel(e.target.value)} className={FIELD}>
            <option value="percent_of_order">A percentage of the order</option>
            <option value="flat_per_order">A flat fee for each order</option>
            <option value="flat_per_qualified_lead">A flat fee for each qualified lead</option>
            <option value="tiered_by_volume">A percentage that improves with volume</option>
          </select>
        </div>

        {needsPercent ? (
          <div>
            <label htmlFor="percent" className={LABEL}>
              Rate, as a percentage
            </label>
            <input
              id="percent"
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              className={FIELD}
            />
          </div>
        ) : null}

        {needsFlat ? (
          <div>
            <label htmlFor="flat" className={LABEL}>
              Amount, in dollars
            </label>
            <input
              id="flat"
              inputMode="decimal"
              value={flat}
              onChange={(e) => setFlat(e.target.value)}
              className={FIELD}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="holdback" className={LABEL}>
            Holdback, in days
          </label>
          <input
            id="holdback"
            inputMode="numeric"
            value={holdback}
            onChange={(e) => setHoldback(e.target.value)}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="from" className={LABEL}>
            In force from
          </label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="note" className={LABEL}>
            Note
          </label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} />
        </div>
      </div>

      {isTiered ? (
        <p className="mt-3 rounded-[var(--radius-control)] border border-[var(--warn-border)] bg-[var(--gold-wash)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
          A volume ladder is set from here with a default of 2.5 percent from the first delivery and 3
          percent from the tenth. Tiers apply forward: reaching a step improves the rate on what comes
          next and does not reprice what came before.
        </p>
      ) : null}

      <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        These are effective dated. The current terms are closed the day before these start, and what
        was already earned keeps the terms it was earned under: a ledger entry snapshots the model
        and the rate, so editing the old row would make the entry and the terms disagree.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          run({
            action: "terms",
            model,
            percent: needsPercent ? percent : null,
            flat: needsFlat ? flat : null,
            tiers: isTiered ? [{ min: 0, bps: 250 }, { min: 10, bps: 300 }] : null,
            holdbackDays: holdback,
            effectiveFrom: from,
            note,
          })
        }
        className={`${PRIMARY} mt-4`}
      >
        {busy ? "Setting" : "Set these terms"}
      </button>
      <Feedback result={result} />
    </div>
  );
}

// ------------------------------------------------------------------ invites

export function InviteForm({ partnerId }: { partnerId: string }) {
  const { busy, result, run } = useAction(partnerId);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inviteName" className={LABEL}>
            Name
          </label>
          <input
            id="inviteName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="inviteEmail" className={LABEL}>
            Email
          </label>
          <input
            id="inviteEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        Nothing is emailed. The link comes back here once, and you send it yourself with whatever
        context the person needs, so no credential moves through a mail server this firm does not
        run.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => run({ action: "invite", email, displayName })}
        className={`${SECONDARY} mt-3`}
      >
        {busy ? "Issuing" : "Issue a set password link"}
      </button>

      {result?.ok && result.setPasswordUrl ? (
        <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--green-border)] bg-[var(--green-bg)] p-3">
          <p className="text-[13.5px] font-semibold text-[var(--green)]">
            Copy this now. It is shown once and it is not written to the audit trail.
          </p>
          <p className="mt-2 break-all font-mono text-[12.5px] leading-[1.5] text-[var(--ink)]">
            {result.setPasswordUrl}
          </p>
          {result.expiresAt ? (
            <p className="mt-2 text-[12.5px] text-[var(--secondary)]">
              It stops working on{" "}
              {new Date(result.expiresAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              .
            </p>
          ) : null}
        </div>
      ) : (
        <Feedback result={result} />
      )}
    </div>
  );
}

// ----------------------------------------------------------------- the money

export function MoneyActions({
  partnerId,
  openStatements,
}: {
  partnerId: string;
  openStatements: { id: string; reference: string; status: string }[];
}) {
  const { busy, result, run } = useAction(partnerId);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [statementId, setStatementId] = useState(openStatements[0]?.id ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const issued = openStatements.filter((s) => s.status === "issued");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor="period" className={LABEL}>
          Close a period
        </label>
        <input id="period" value={period} onChange={(e) => setPeriod(e.target.value)} className={FIELD} />
        <p className="mt-1.5 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
          Gathers everything that has become payable by the end of that month, whenever it was
          earned. Nothing is opened if the net is zero or negative: the balance carries forward
          rather than the firm issuing a document saying it settled with somebody it did not.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ action: "close", period })}
          className={`${SECONDARY} mt-3`}
        >
          {busy ? "Closing" : "Close it"}
        </button>
      </div>

      {issued.length > 0 || openStatements.length > 0 ? (
        <div className="border-t border-[var(--border)] pt-5">
          <label htmlFor="statement" className={LABEL}>
            A statement
          </label>
          <select
            id="statement"
            value={statementId}
            onChange={(e) => setStatementId(e.target.value)}
            className={FIELD}
          >
            {openStatements.map((s) => (
              <option key={s.id} value={s.id}>
                {s.reference} ({s.status})
              </option>
            ))}
          </select>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !statementId}
              onClick={() => run({ action: "issue", statementId })}
              className={SECONDARY}
            >
              Issue it to the partner
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="payref" className={LABEL}>
                Payout reference
              </label>
              <input
                id="payref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label htmlFor="paynote" className={LABEL}>
                Note
              </label>
              <input id="paynote" value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} />
            </div>
          </div>
          <p className="mt-1.5 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
            This platform does not send money and will not. Pay the partner however the firm pays
            anybody, then record what you did and the reference it was paid under.
          </p>
          <button
            type="button"
            disabled={busy || !statementId}
            onClick={() => run({ action: "pay", statementId, reference, note })}
            className={`${SECONDARY} mt-3`}
          >
            Record that it was paid
          </button>
        </div>
      ) : null}

      <Feedback result={result} />
    </div>
  );
}

export function AdjustmentForm({ partnerId }: { partnerId: string }) {
  const { busy, result, run } = useAction(partnerId);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="adjustAmount" className={LABEL}>
            Amount, in dollars
          </label>
          <input
            id="adjustAmount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-describedby="adjustHint"
            className={FIELD}
          />
          <p id="adjustHint" className="mt-1.5 text-[12.5px] leading-[1.5] text-[var(--secondary)]">
            Negative takes money back.
          </p>
        </div>
        <div>
          <label htmlFor="adjustReason" className={LABEL}>
            What is being corrected, and why
          </label>
          <input
            id="adjustReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={FIELD}
          />
        </div>
      </div>

      <p className="mt-3 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        This is how a disputed attribution is settled. Nothing already written is edited: the
        adjustment stands beside it, both are on the partner's statement, and the sentence you write
        here is the only account of it anybody will have.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => run({ action: "adjustment", amount, reason })}
        className={`${SECONDARY} mt-3`}
      >
        {busy ? "Recording" : "Record an adjustment"}
      </button>
      <Feedback result={result} />
    </div>
  );
}

// ------------------------------------------------------------- submissions

export function DecideSubmission({
  submissionId,
  partnerId,
}: {
  submissionId: string;
  partnerId: string;
}) {
  const { busy, result, run } = useAction(partnerId);
  const [note, setNote] = useState("");

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <label htmlFor={`note-${submissionId}`} className={LABEL}>
        The firm&apos;s answer, in the firm&apos;s words
      </label>
      <textarea
        id={`note-${submissionId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className={`${FIELD} min-h-[84px] py-2 leading-[1.6]`}
      />
      <p className="mt-1.5 max-w-[74ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
        Name the sentence if the answer is no. A partner cannot fix a refusal with no reason in it,
        and this answer is frozen once it is given: changing your mind is a new submission, so both
        answers survive.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ action: "decide", submissionId, decision: "approved", note })}
          className={SECONDARY}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run({ action: "decide", submissionId, decision: "changes_requested", note })}
          className={SECONDARY}
        >
          Ask for changes
        </button>
      </div>
      <Feedback result={result} />
    </div>
  );
}
