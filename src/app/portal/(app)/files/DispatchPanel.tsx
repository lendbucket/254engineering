"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Who to offer a job to, and why everybody else was left out.
 *
 * THE INELIGIBLE LIST IS THE POINT OF THIS SCREEN
 * -----------------------------------------------
 * A dispatch screen that shows three names is easy to build and useless the
 * first time it shows none. The operator's next question is always the same:
 * why is nobody available in a county where four people work. planDispatch
 * returns the reason for every exclusion and this renders all of them, so the
 * answer is on the screen rather than in a database query somebody has to write.
 *
 * MULTIPLE OFFERS AT ONCE, AND FIRST ACCEPTANCE WINS
 * --------------------------------------------------
 * Offering to one person and waiting is how a file sits for six hours because
 * somebody is asleep. Offering to four and letting the first one take it is how
 * it gets covered. The losers are withdrawn and told, in the same sentence, that
 * somebody accepted first.
 */

export type Candidate = {
  techId: string;
  displayName: string;
  rank: number;
  distanceMiles: number | null;
  openJobs: number;
  amountCents: number | null;
};

export function DispatchPanel({
  fileId,
  offers,
  ineligible,
  alreadyOffered,
  feeCents,
  proximityUnavailable,
  propertyLocated,
  protocolName,
}: {
  fileId: string;
  offers: Candidate[];
  ineligible: { id: string; displayName: string; reason: string }[];
  alreadyOffered: { techId: string; state: string }[];
  feeCents: number | null;
  proximityUnavailable: boolean;
  propertyLocated: boolean;
  protocolName: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [expiry, setExpiry] = useState("4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offeredTo = new Map(alreadyOffered.map((o) => [o.techId, o.state]));

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_offers",
          fileId,
          techIds: selected,
          expiresInHours: expiry === "" ? null : Number(expiry),
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        return;
      }
      setSelected([]);
      router.refresh();
    } catch {
      setError("The network dropped that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-slate bg-white px-4 py-4 sm:px-5">
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Dispatch</p>

      {protocolName ? (
        <p className="mt-1.5 text-[13px] leading-[1.55] text-slate-muted">
          Working to {protocolName}. Technician rate{" "}
          {feeCents === null
            ? "is not in the schedule for this service line, so the offer carries no figure"
            : `$${(feeCents / 100).toFixed(2)}`}
          .
        </p>
      ) : (
        <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[1.55] text-[#a3241c]">
          No published protocol exists for this service line, so this file cannot be dispatched. A
          technician accepting it would open an empty checklist. An engineer publishes one from the
          protocols screen.
        </p>
      )}

      {proximityUnavailable ? (
        <p className="mt-2 max-w-[70ch] text-[12.5px] leading-[1.5] text-slate-muted">
          Ranked by open workload and then by name. No distance is shown because{" "}
          {propertyLocated
            ? "none of these technicians has a base coordinate on record"
            : "this property has no coordinates on record"}
          , and a distance nobody measured is worse than none.
        </p>
      ) : null}

      {offers.length === 0 ? (
        <p className="mt-4 text-[13.5px] leading-[1.55] text-slate-muted">
          Nobody is eligible for this job. The reasons are below, and each of them is something an
          administrator can act on.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {offers.map((o) => {
            const state = offeredTo.get(o.techId);
            const disabled = state === "offered" || state === "accepted";
            return (
              <li key={o.techId}>
                <label
                  className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[3px] border px-3 py-2.5 ${
                    selected.includes(o.techId) ? "border-slate bg-limestone" : "border-limestone-line"
                  } ${disabled ? "cursor-default opacity-60" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled || !protocolName}
                    checked={selected.includes(o.techId)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, o.techId] : prev.filter((id) => id !== o.techId),
                      )
                    }
                    className="h-5 w-5 shrink-0 accent-[#1d2a35]"
                  />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-slate">
                      {o.displayName}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-slate-muted">
                      {o.openJobs === 0 ? "No open jobs" : `${o.openJobs} open`}
                      {o.distanceMiles !== null ? `, about ${o.distanceMiles} miles out` : ""}
                      {state ? `, already ${state}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {ineligible.length > 0 ? (
        <details className="mt-4">
          <summary className="min-h-[44px] cursor-pointer list-none py-2 text-[13px] font-semibold text-slate">
            {ineligible.length} technician{ineligible.length === 1 ? "" : "s"} not eligible, and why
          </summary>
          <ul className="mt-1 divide-y divide-limestone-line">
            {ineligible.map((i) => (
              <li key={i.id} className="py-2.5">
                <p className="text-[13.5px] font-semibold text-slate">{i.displayName}</p>
                <p className="mt-0.5 text-[13px] text-slate-muted">{i.reason}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {offers.length > 0 && protocolName ? (
        <>
          <div className="mt-4">
            <label htmlFor="expiry" className="block text-[13px] font-semibold text-slate">
              Offer expires after
            </label>
            <select
              id="expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1.5 min-h-[44px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate sm:w-auto"
            >
              <option value="2">2 hours</option>
              <option value="4">4 hours</option>
              <option value="12">12 hours</option>
              <option value="24">24 hours</option>
              <option value="">No expiry</option>
            </select>
          </div>

          {error ? (
            <p role="alert" className="mt-3 text-[13.5px] leading-[1.5] font-semibold text-[#a3241c]">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void send()}
            className="mt-4 inline-flex min-h-[48px] items-center justify-center rounded-[3px] bg-brass px-5 text-[15px] font-bold text-slate-ink transition-colors hover:bg-brass-light disabled:opacity-50"
          >
            {busy
              ? "Sending"
              : selected.length === 0
                ? "Choose who to offer this to"
                : `Offer to ${selected.length} technician${selected.length === 1 ? "" : "s"}`}
          </button>
          <p className="mt-2 max-w-[70ch] text-[12.5px] leading-[1.5] text-slate-muted">
            Everybody chosen sees the job at the same time. The first to accept takes it and the rest
            are told somebody accepted first. The file moves to dispatched on acceptance, not now,
            because a file marked dispatched with nobody on it is the lie the status column exists to
            prevent.
          </p>
        </>
      ) : null}
    </div>
  );
}
