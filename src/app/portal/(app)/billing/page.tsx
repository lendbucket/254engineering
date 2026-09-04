import { redirect } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { fileMargins, marginByPeriod } from "@/lib/ops-docs";
import { canSeeBilling } from "@/lib/ops-dashboard";
import { marginOf, money } from "@/lib/ops-money";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { ButtonLink, Chip, EmptyState, PageHead, Panel, RecordTable } from "@/components/portal/surfaces";

export const dynamic = "force-dynamic";

/**
 * Billing: what a file earns and what it costs.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * It is not invoicing. Nothing here sends a bill, takes a payment, or talks to
 * an accounting system. It is the margin the operator would otherwise rebuild
 * in a spreadsheet every month from three numbers already on each file.
 *
 * Invoicing belongs with the order engine and arrives with it. Building half of
 * it now would leave two billing models to reconcile later.
 *
 * THE ONE RULE THIS SCREEN ENFORCES
 * ---------------------------------
 * An absent figure is not a zero. A file missing its engineer production cost is
 * excluded from every total rather than counted as costing nothing, and the
 * screen says how many files it left out and why. Summing what is present would
 * produce a margin that is too high by exactly the amount nobody has entered,
 * every time, in the flattering direction.
 */
export default async function BillingPage() {
  const actor = await currentActor();
  if (!actor) redirect("/portal/login");
  if (!canSeeBilling(actor)) redirect("/portal");

  const files = await fileMargins(actor);
  const periods = marginByPeriod(files);
  const incomplete = files.filter((f) => marginOf(f).missing.length > 0);

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Billing"
        lede="Margin per file and per period, from the figures on the files. Nothing here is estimated and nothing absent is treated as a zero."
        actions={
          <>
            <ButtonLink href="/api/portal/exports?report=margin" tone="ghost">
              By file
            </ButtonLink>
            <ButtonLink href="/api/portal/exports?report=period">By period</ButtonLink>
          </>
        }
      />

      {files.length === 0 ? (
        <EmptyState
          title="No files carry money yet"
          body="A margin needs a client price, a technician cost and an engineer production figure. When files carry them, this page fills in."
        />
      ) : (
        <>
          <Panel
            title="By period"
            description="A file counts toward the month it was delivered, or the month it was opened if it has not been delivered."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-limestone-line">
                    {["Period", "Files counted", "Revenue", "Cost", "Margin", "What it covers"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="py-2 pr-4 text-[11px] font-bold tracking-[0.1em] text-slate-muted uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.period} className="border-b border-limestone-line last:border-0">
                      <td className="py-2.5 pr-4 align-top text-[13.5px] font-semibold text-slate">{p.period}</td>
                      <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">
                        {p.complete} of {p.files}
                      </td>
                      <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">{money(p.revenue)}</td>
                      <td className="py-2.5 pr-4 align-top text-[13.5px] text-slate">{money(p.cost)}</td>
                      <td className="py-2.5 pr-4 align-top text-[13.5px] font-semibold text-slate">
                        {money(p.margin)}
                        {p.marginPercent === null ? "" : ` (${p.marginPercent}%)`}
                      </td>
                      <td className="max-w-[42ch] py-2.5 pr-4 align-top text-[12px] leading-[1.45] text-slate-muted">
                        {p.coverage}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {incomplete.length > 0 ? (
            <div className="mt-4 rounded-[4px] border border-[#f0d9a8] bg-[#fdf3e0] px-4 py-3.5">
              <p className="text-[13px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
                {incomplete.length} file{incomplete.length === 1 ? "" : "s"} left out of the totals
              </p>
              <p className="mt-1.5 max-w-[74ch] text-[13.5px] leading-[1.6] text-[#7a4c05]">
                Each is missing at least one of the three figures. They are excluded rather than
                counted as nothing, because adding up what is present would report a margin higher
                than the truth by exactly the amount nobody has entered. The table below names what
                is missing on each.
              </p>
            </div>
          ) : null}

          <Panel
            className="mt-4"
            title="By file"
            description="Three figures per file. A blank one has not been entered, which is a different fact from a zero."
          >
            <RecordTable
              rows={files}
              columns={[
                {
                  key: "file",
                  head: "File",
                  cell: (f) => <span className="font-semibold">{f.file_number}</span>,
                },
                { key: "address", head: "Property", cell: (f) => f.property_address, wide: true },
                {
                  key: "status",
                  head: "Status",
                  cell: (f) => STATUS_LABEL[f.status as FileStatus] ?? f.status,
                  wide: true,
                },
                { key: "period", head: "Period", cell: (f) => f.period ?? "not dated" },
                { key: "price", head: "Client price", cell: (f) => money(f.clientPriceCents) },
                { key: "tech", head: "Technician", cell: (f) => money(f.techCostCents) },
                { key: "eng", head: "Production", cell: (f) => money(f.engineerCostCents) },
                {
                  key: "margin",
                  head: "Margin",
                  cell: (f) => {
                    const m = marginOf(f);
                    return (
                      <span className={m.margin === null ? "text-slate-muted" : "font-semibold"}>
                        {money(m.margin)}
                        {m.marginPercent === null ? "" : ` (${m.marginPercent}%)`}
                      </span>
                    );
                  },
                },
                {
                  key: "missing",
                  head: "Missing",
                  cell: (f) => {
                    const m = marginOf(f);
                    return m.missing.length === 0 ? (
                      <Chip label="Complete" tone="good" />
                    ) : (
                      <span className="text-[12.5px] text-slate-muted">{m.missing.join(", ")}</span>
                    );
                  },
                },
              ]}
              card={(f) => {
                const m = marginOf(f);
                return (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[15px] font-bold text-slate">{f.file_number}</p>
                      {m.missing.length === 0 ? (
                        <Chip label="Complete" tone="good" />
                      ) : (
                        <Chip label="Incomplete" tone="warn" />
                      )}
                    </div>
                    <p className="mt-1 text-[13px] leading-[1.5] text-slate-muted">
                      {f.property_address}, {f.county} County
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                      <dt className="text-slate-muted">Client price</dt>
                      <dd className="text-right text-slate">{money(f.clientPriceCents)}</dd>
                      <dt className="text-slate-muted">Technician</dt>
                      <dd className="text-right text-slate">{money(f.techCostCents)}</dd>
                      <dt className="text-slate-muted">Production</dt>
                      <dd className="text-right text-slate">{money(f.engineerCostCents)}</dd>
                      <dt className="font-semibold text-slate">Margin</dt>
                      <dd className="text-right font-semibold text-slate">{money(m.margin)}</dd>
                    </dl>
                    {m.missing.length > 0 ? (
                      <p className="mt-2.5 text-[12.5px] leading-[1.5] text-slate-muted">
                        Not counted in any total. Missing: {m.missing.join(", ")}.
                      </p>
                    ) : null}
                  </div>
                );
              }}
              empty={<EmptyState title="No files" body="Nothing to price yet." />}
            />
          </Panel>
        </>
      )}
    </>
  );
}
