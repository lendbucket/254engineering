"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "@/lib/ops-money";

type Row = {
  serviceSlug: string;
  tier: string;
  name: string;
  catalogueCents: number | null;
  floorCents: number | null;
  floorBecause: string;
  floorBy: string;
  floorOn: string;
  current: { priceCents: number; setByEmail: string; createdAt: string } | null;
};

/**
 * Setting a price, with the floor in front of the operator before they type.
 *
 * THE FLOOR IS NOT A PLACEHOLDER IN THE FIELD, DELIBERATELY.
 *
 * The obvious design puts the floor in as the default value, which is helpful
 * and wrong: it makes the floor the suggested price, and the floor is a limit
 * rather than a recommendation. An operator who accepts a default has agreed to
 * the lowest number the firm will take, on every service, without deciding
 * anything.
 *
 * So the field starts empty and the floor is stated beside it, with who ruled it
 * and when, which is the same sentence the refusal would carry.
 *
 * NOTHING HERE VALIDATES AGAINST THE FLOOR.
 *
 * The browser could compare and refuse before posting, and it does not. A check
 * in the browser is a check somebody can turn off, and the one that matters runs
 * on the server and again as a constraint on the row. Duplicating it here would
 * be a third answer to the same question and the first one to drift.
 *
 * What the browser does is SHOW the floor, which is a different job.
 */
export function TradePricingClient({ accountId, rows }: { accountId: string; rows: Row[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((r) => {
        const key = `${r.serviceSlug}/${r.tier}`;
        const isOpen = open === key;
        return (
          <li key={key} className="py-3.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[14px] font-semibold text-[var(--navy)]">{r.name}</span>
              <span className="text-[13.5px] text-[var(--navy)]">
                {r.current ? (
                  <strong className="font-semibold">{money(r.current.priceCents)}</strong>
                ) : (
                  <span className="text-[var(--secondary)]">No trade price</span>
                )}
              </span>
            </div>

            <p className="mt-1 text-[13px] leading-[1.55] text-[var(--secondary)]">
              {r.catalogueCents === null ? "Quoted, no published price" : `Published ${money(r.catalogueCents)}`}
              {r.floorCents !== null ? ` · Floor ${money(r.floorCents)}` : null}
              {r.current
                ? ` · Set by ${r.current.setByEmail} on ${new Date(r.current.createdAt).toISOString().slice(0, 10)}`
                : null}
            </p>

            {isOpen ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface-muted,#f7f8f9)] p-3">
                {r.floorCents !== null ? (
                  <p className="text-[13px] leading-[1.55] text-[var(--navy)]">
                    The floor is <strong className="font-semibold">{money(r.floorCents)}</strong>, ruled by{" "}
                    {r.floorBy} on {r.floorOn}. {r.floorBecause} A price at the floor is allowed. Below it is
                    refused, at every role, and there is no override.
                  </p>
                ) : null}

                <label className="mt-2.5 flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[var(--navy)]">
                    Price in dollars
                  </span>
                  <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    inputMode="decimal"
                    placeholder=""
                    aria-describedby={error ? "pricing-error" : undefined}
                    aria-invalid={error ? true : undefined}
                    className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-3 text-[15px] text-[var(--navy)]"
                  />
                </label>

                {error ? (
                  <p
                    id="pricing-error"
                    role="alert"
                    className="mt-2.5 rounded-[var(--radius-control)] border border-[var(--red-border)] bg-[var(--red-bg)] px-3 py-2.5 text-[13.5px] leading-[1.55] text-[var(--red)]"
                  >
                    {error}
                  </p>
                ) : null}

                {done ? (
                  <p role="status" className="mt-2.5 text-[13.5px] leading-[1.55] text-[var(--navy)]">
                    {done}
                  </p>
                ) : null}

                <div className="mt-2.5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError(null);
                      setDone(null);
                      try {
                        /*
                         * Dollars to cents HERE rather than on the server,
                         * because the operator typed dollars and the rest of
                         * this platform speaks cents. Rounded rather than
                         * truncated: 12.345 becoming 1234 would quietly shave
                         * half a cent off a negotiated price.
                         */
                        const cents = Math.round(Number(value.replace(/[$,\s]/g, "")) * 100);
                        const res = await fetch("/api/portal/accounts/pricing", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            accountId,
                            serviceSlug: r.serviceSlug,
                            tier: r.tier,
                            priceCents: cents,
                          }),
                        });
                        const data = (await res.json().catch(() => null)) as
                          | { ok?: boolean; error?: string; message?: string }
                          | null;
                        if (!res.ok || !data?.ok) {
                          setError(data?.error ?? "That did not work.");
                          return;
                        }
                        setDone(data.message ?? "The price is set.");
                        setValue("");
                        router.refresh();
                      } catch {
                        setError("The network did not answer. Try again.");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white disabled:opacity-60"
                  >
                    {busy ? "Setting" : r.current ? "Supersede the price" : "Set the price"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(null);
                      setError(null);
                      setDone(null);
                      setValue("");
                    }}
                    className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] border border-[var(--border)] px-4 text-[14px] font-semibold text-[var(--navy)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(key);
                  setError(null);
                  setDone(null);
                  setValue("");
                }}
                className="min-h-[var(--tap-target)] mt-1 text-[13px] font-semibold text-[var(--navy)] underline"
              >
                {r.current ? "Change this price" : "Set a trade price"}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
