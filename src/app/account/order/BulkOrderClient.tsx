"use client";

import { useMemo, useState } from "react";
import { money } from "@/lib/ops-money";

type Deliverable = {
  serviceSlug: string;
  tier: string;
  name: string;
  priceCents: number | null;
  qualifiers: { id: string; prompt: string; options: string[] }[];
};

type Row = {
  ref: string;
  propertyAddress: string;
  city: string;
  county: string;
  postalCode: string;
  /** Per property, defaulting to the shared answers and overridable. */
  answers: Record<string, number>;
};

type Preview = {
  billingMode: "card" | "invoice";
  credit: { ok: boolean; message: string } | null;
  totalCents: number | null;
  accepted: { ref: string; address: string; county: string; priceCents: number | null; twiaCounty: boolean }[];
  rejected: { ref: string; address: string; reason: string }[];
};

/**
 * Ordering for many properties at once.
 *
 * THE ANSWERS ARE SHARED BY DEFAULT AND OVERRIDABLE PER PROPERTY
 * --------------------------------------------------------------
 * A solar installer submitting forty roofs answers "is the property in Texas"
 * once. But one of the forty will have a different answer to "can the roof be
 * reached safely", and a form that only took the answer once would either
 * reject that property wrongly or accept it wrongly. Both are worse than asking.
 *
 * So the shared bar sets every row, and any row can differ. The rows are what
 * gets sent; the shared bar is a convenience that writes into them.
 *
 * NOTHING HERE DECIDES WHAT ANYTHING COSTS
 * ----------------------------------------
 * The preview comes back from the server, which recomputes it from the catalog,
 * and the submission sends the properties again rather than the preview. A
 * price computed in a browser is a price a browser can change.
 */
export function BulkOrderClient({
  deliverables,
  billingMode,
}: {
  deliverables: Deliverable[];
  billingMode: "card" | "invoice";
}) {
  const [tier, setTier] = useState(deliverables[0]?.tier ?? "");
  const chosen = useMemo(
    () => deliverables.find((d) => d.tier === tier) ?? deliverables[0],
    [deliverables, tier],
  );

  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [shared, setShared] = useState<Record<string, number>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "preview" | "submit">(null);
  const [requestId] = useState(() => crypto.randomUUID());

  /*
   * One property per line: address, city, county, postcode. County is the only
   * field besides the address that the price and the protocol turn on, so it is
   * the one the parser is strict about being present rather than guessing.
   */
  function parse() {
    const parsed: Row[] = paste
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line, i) => {
        const parts = line.split(",").map((p) => p.trim());
        return {
          ref: `P${i + 1}`,
          propertyAddress: parts[0] ?? "",
          city: parts[1] ?? "",
          county: parts[2] ?? "",
          postalCode: parts[3] ?? "",
          answers: { ...shared },
        };
      });
    setRows(parsed);
    setPreview(null);
    setError(null);
  }

  function setSharedAnswer(qualifierId: string, optionIndex: number) {
    const next = { ...shared, [qualifierId]: optionIndex };
    setShared(next);
    setRows((rs) => rs.map((r) => ({ ...r, answers: { ...r.answers, [qualifierId]: optionIndex } })));
    setPreview(null);
  }

  function setRowAnswer(ref: string, qualifierId: string, optionIndex: number) {
    setRows((rs) =>
      rs.map((r) => (r.ref === ref ? { ...r, answers: { ...r.answers, [qualifierId]: optionIndex } } : r)),
    );
    setPreview(null);
  }

  const payload = () => ({
    serviceSlug: chosen.serviceSlug,
    tier: chosen.tier,
    properties: rows.map((r) => ({
      ref: r.ref,
      propertyAddress: r.propertyAddress,
      city: r.city,
      county: r.county,
      postalCode: r.postalCode,
      answers: Object.entries(r.answers).map(([qualifierId, optionIndex]) => ({
        qualifierId,
        optionIndex,
      })),
    })),
  });

  async function run(action: "preview" | "submit") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch("/api/account/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...payload(),
          ...(action === "submit" ? { clientRequestId: requestId } : {}),
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error ?? "That did not work.");
        return;
      }

      if (action === "preview") {
        setPreview(data as Preview);
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      window.location.href = data.redirect ?? "/account";
    } catch {
      setError("The request did not complete. Nothing was submitted.");
    } finally {
      setBusy(null);
    }
  }

  const answeredAll =
    rows.length > 0 && rows.every((r) => chosen.qualifiers.every((q) => r.answers[q.id] !== undefined));

  const creditBlocked = preview?.credit && !preview.credit.ok;

  return (
    <div>
      {deliverables.length > 1 ? (
        <div className="mb-6">
          <label htmlFor="tier" className="block text-[13px] font-bold text-slate">
            Which deliverable
          </label>
          <select
            id="tier"
            value={tier}
            onChange={(e) => {
              setTier(e.target.value);
              setPreview(null);
            }}
            className="mt-1.5 min-h-[44px] w-full rounded-[3px] border border-limestone-line px-3 text-[15px] text-slate"
          >
            {deliverables.map((d) => (
              <option key={d.tier} value={d.tier}>
                {d.name}
                {d.priceCents === null ? " (quoted)" : ` (${money(d.priceCents)} each)`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <label htmlFor="paste" className="block text-[13px] font-bold text-slate">
        The properties
      </label>
      <p className="mt-1 text-[12.5px] leading-[1.55] text-slate-muted">
        One per line: address, city, county, postcode. The county decides both the protocol and the
        price, so it is the one field that cannot be left out.
      </p>
      <textarea
        id="paste"
        rows={6}
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder={"1200 Ocean Drive, Corpus Christi, Nueces, 78404\n88 Live Oak, San Antonio, Bexar, 78205"}
        className="mt-2 w-full rounded-[3px] border border-limestone-line px-3 py-2.5 font-mono text-[13.5px] text-slate"
      />
      <button
        type="button"
        onClick={parse}
        className="mt-2 inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line bg-white px-4 text-[13.5px] font-semibold text-slate"
      >
        Read {paste.split("\n").filter((l) => l.trim()).length || 0} lines
      </button>

      {rows.length > 0 ? (
        <>
          <div className="mt-8 rounded-[4px] border border-limestone-line bg-white p-4">
            <p className="text-[13px] font-bold text-slate">These answers apply to every property</p>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-slate-muted">
              Change one below on any property where the answer is different. A wrong answer here is
              what gets a property rejected after you have paid for it.
            </p>
            {chosen.qualifiers.map((q) => (
              <div key={q.id} className="mt-3">
                <label htmlFor={`shared-${q.id}`} className="block text-[12.5px] font-semibold text-slate">
                  {q.prompt}
                </label>
                <select
                  id={`shared-${q.id}`}
                  value={shared[q.id] ?? ""}
                  onChange={(e) => setSharedAnswer(q.id, Number(e.target.value))}
                  className="mt-1 min-h-[44px] w-full rounded-[3px] border border-limestone-line px-2.5 text-[14px] text-slate"
                >
                  <option value="" disabled>
                    Choose
                  </option>
                  {q.options.map((o, i) => (
                    <option key={o} value={i}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-limestone-line">
                  {["Ref", "Property", "County", ...chosen.qualifiers.map((q) => q.prompt)].map((h) => (
                    <th
                      key={h}
                      scope="col"
                      className="py-2 pr-3 text-[11px] font-bold tracking-[0.08em] text-slate-muted uppercase"
                    >
                      {h.length > 28 ? `${h.slice(0, 28)}…` : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.ref} className="border-b border-limestone-line last:border-0">
                    <td className="py-2 pr-3 font-mono text-[12.5px] text-slate-muted">{r.ref}</td>
                    <td className="py-2 pr-3 text-[13px] text-slate">{r.propertyAddress || "(no address)"}</td>
                    <td className="py-2 pr-3 text-[13px] text-slate">{r.county || "(none)"}</td>
                    {chosen.qualifiers.map((q) => (
                      <td key={q.id} className="py-2 pr-3">
                        <select
                          aria-label={`${q.prompt} for ${r.ref}`}
                          value={r.answers[q.id] ?? ""}
                          onChange={(e) => setRowAnswer(r.ref, q.id, Number(e.target.value))}
                          className="min-h-[44px] rounded-[3px] border border-limestone-line px-2 text-[13px] text-slate"
                        >
                          <option value="" disabled>
                            Choose
                          </option>
                          {q.options.map((o, i) => (
                            <option key={o} value={i}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            disabled={busy !== null || !answeredAll}
            onClick={() => run("preview")}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-[3px] bg-brass px-5 text-[14px] font-bold text-slate-ink disabled:opacity-45"
          >
            {busy === "preview" ? "Checking" : "Check what the firm can take"}
          </button>
          {!answeredAll ? (
            <p className="mt-2 text-[12.5px] text-slate-muted">
              Every property needs an answer to every question before this can be checked.
            </p>
          ) : null}
        </>
      ) : null}

      {preview ? (
        <div className="mt-8">
          <div className="rounded-[4px] border border-limestone-line border-t-[3px] border-t-brass bg-white p-5">
            <h2 className="font-display text-[1.15rem] font-semibold text-slate">
              {preview.accepted.length} of {preview.accepted.length + preview.rejected.length} can be
              taken
            </h2>

            {preview.rejected.length > 0 ? (
              <div className="mt-4">
                <p className="text-[13px] font-bold text-slate">
                  Not taken, and not charged for
                </p>
                <ul className="mt-2 space-y-2">
                  {preview.rejected.map((r) => (
                    <li key={r.ref} className="rounded-[3px] bg-[#fdf3e0] px-3 py-2">
                      <p className="font-mono text-[12.5px] font-semibold text-[#7a4c05]">
                        {r.ref} {r.address}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-[1.55] text-[#7a4c05]">{r.reason}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.accepted.length > 0 ? (
              <div className="mt-4">
                <ul className="divide-y divide-limestone-line">
                  {preview.accepted.map((a) => (
                    <li key={a.ref} className="flex flex-wrap items-baseline gap-x-3 py-2">
                      <span className="font-mono text-[12.5px] text-slate-muted">{a.ref}</span>
                      <span className="text-[13.5px] text-slate">{a.address}</span>
                      {a.twiaCounty ? (
                        <span className="text-[12px] text-brass-ink">coastal county</span>
                      ) : null}
                      <span className="ml-auto text-[13.5px] font-semibold text-slate">
                        {money(a.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 flex items-baseline justify-between border-t border-limestone-line pt-3 text-[15px] font-bold text-slate">
                  <span>Total</span>
                  <span>{money(preview.totalCents)}</span>
                </p>
              </div>
            ) : null}

            {creditBlocked ? (
              <p className="mt-4 rounded-[3px] bg-[#fdecec] px-3 py-2.5 text-[13.5px] leading-[1.6] text-[#8a1f1f]">
                {preview.credit?.message}
              </p>
            ) : preview.billingMode === "invoice" ? (
              <p className="mt-4 rounded-[3px] bg-limestone px-3 py-2.5 text-[13.5px] leading-[1.6] text-slate-muted">
                This account is invoiced. Nothing is charged now, and this appears on your next
                statement.
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy !== null || preview.accepted.length === 0 || Boolean(creditBlocked)}
              onClick={() => run("submit")}
              className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-[3px] bg-slate px-5 text-[14px] font-bold text-white disabled:opacity-45"
            >
              {busy === "submit"
                ? "Submitting"
                : preview.billingMode === "invoice"
                  ? `Place ${preview.accepted.length} on account`
                  : `Pay ${money(preview.totalCents)} for ${preview.accepted.length}`}
            </button>
            {preview.billingMode === "card" ? (
              <p className="mt-2 text-center text-[12px] text-slate-muted">
                Card details are entered on Stripe&apos;s page and never reach this site.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-[3px] bg-[#fdecec] px-3 py-2.5 text-[13.5px] text-[#8a1f1f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
