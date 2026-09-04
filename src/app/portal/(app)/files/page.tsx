import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listFiles, getFile, listClients, fileTimeline, fileRegion } from "@/lib/ops-crm";
import { availableTransitions, STATUS_LABEL, STATUS_TONE, FILE_STATUSES } from "@/lib/ops-files";
import { TEXAS_COUNTIES, twiaStatus } from "@/lib/ops-counties";
import { services } from "@/content/services";
import { isPrelaunch } from "@/lib/launch";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { dispatchContext, jobView } from "@/lib/ops-field";
import { progressLabel } from "@/lib/ops-evidence";
import { NewFileForm, TransitionControls } from "./FileClient";
import { DispatchPanel } from "./DispatchPanel";

export const dynamic = "force-dynamic";

/**
 * Files: one route, two form factors.
 *
 * On a large screen this is a split view, the list on the left and the selected
 * file on the right, which is what an operator working a queue actually wants.
 * On a phone it is a stack: the list, and tapping a file replaces it with the
 * file full screen, with a back link.
 *
 * The same URL serves both. `?id=` selects a file; the layout classes decide
 * whether that means "show the detail beside the list" or "show the detail
 * instead of the list". One route, no duplicated data loading, and a link an
 * operator can send to a colleague that works on whatever they open it on.
 */

function when(value: string | null): string {
  if (!value) return "not set";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "not set";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string; county?: string; q?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "files.list")) notFound();
  const params = await searchParams;

  const files = await listFiles(actor, {
    status: params.status,
    county: params.county,
    search: params.q,
  });
  const selected = params.id ? await getFile(actor, params.id) : null;
  const timeline = selected ? await fileTimeline(selected.id) : [];

  /*
   * Dispatch is loaded only when the file is actually waiting for one. Planning
   * a dispatch reads every technician, their certifications and their live
   * workload, which is three queries nobody needs on a delivered file.
   */
  const dispatch =
    selected && selected.status === "needs_dispatch" && can(actor, "offers.dispatch")
      ? await dispatchContext(actor, selected)
      : null;

  // The evidence summary, for an administrator or engineer watching a job in the
  // field. Same jobView the technician's own screen renders, same gate.
  const job =
    selected &&
    ["dispatched", "evidence_in_progress", "evidence_submitted", "revisions_requested", "under_review"].includes(
      selected.status,
    )
      ? await jobView(actor, selected.id)
      : null;
  const clients = can(actor, "files.create") ? await listClients(actor) : [];

  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) next.set(k, v);
    next.delete("id");
    return `/portal/files${next.toString() ? `?${next}` : ""}`;
  };

  const list = (
    <div className={selected ? "hidden lg:block" : "block"}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={filterHref({ status: undefined })}
          className={`inline-flex min-h-[36px] items-center rounded-[3px] border px-3 text-[13px] font-semibold ${
            !params.status ? "border-slate bg-slate text-slate-fg" : "border-limestone-line text-slate-muted"
          }`}
        >
          All
        </Link>
        {FILE_STATUSES.filter((s) => s !== "cancelled").map((s) => (
          <Link
            key={s}
            href={filterHref({ status: s })}
            className={`inline-flex min-h-[36px] items-center rounded-[3px] border px-3 text-[13px] font-semibold ${
              params.status === s ? "border-slate bg-slate text-slate-fg" : "border-limestone-line text-slate-muted"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      {files.length === 0 ? (
        <EmptyState
          title={params.status || params.q ? "Nothing matches that" : "No files yet"}
          body={
            params.status || params.q
              ? "Clear the filter to see everything."
              : "A file is one deliverable request: a property, a client, and a service line. Open one above, or convert a lead from the clients screen."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {files.map((f) => (
            <li key={f.id}>
              <Link
                href={`/portal/files?id=${f.id}`}
                className={`block rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                  selected?.id === f.id ? "border-slate" : "border-limestone-line"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-brass-ink">{f.file_number}</p>
                    <p className="mt-1 text-[14.5px] font-semibold text-slate">{f.property_address}</p>
                    <p className="mt-0.5 text-[13px] text-slate-muted">
                      {f.county} County{f.twia_county ? ", windstorm" : ""}
                    </p>
                  </div>
                  <Chip label={STATUS_LABEL[f.status]} tone={STATUS_TONE[f.status]} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const detail = selected ? (
    <div>
      <Link
        href={filterHref({})}
        className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted lg:hidden"
      >
        Back to the list
      </Link>

      <div className="rounded-[4px] border border-limestone-line bg-white">
        <div className="border-b border-limestone-line px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[12.5px] text-brass-ink">{selected.file_number}</p>
              <h2 className="mt-1 font-display text-[20px] leading-[1.2] font-bold text-slate">
                {selected.property_address}
              </h2>
              <p className="mt-1 text-[13.5px] text-slate-muted">
                {selected.city ? `${selected.city}, ` : ""}
                {selected.county} County
                {fileRegion(selected.county) ? ` (${fileRegion(selected.county)})` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Chip label={STATUS_LABEL[selected.status]} tone={STATUS_TONE[selected.status]} />
              {selected.twia_county ? <Chip label="TWIA designated" tone="warn" /> : null}
            </div>
          </div>
        </div>

        {dispatch ? (
          <div className="border-b border-limestone-line px-4 py-4 sm:px-5">
            <DispatchPanel
              fileId={selected.id}
              offers={dispatch.plan.offers}
              ineligible={dispatch.plan.ineligible}
              alreadyOffered={dispatch.alreadyOffered}
              feeCents={dispatch.feeCents}
              proximityUnavailable={dispatch.proximityUnavailable}
              propertyLocated={dispatch.propertyLocated}
              protocolName={
                dispatch.protocol ? `${dispatch.protocol.name} v${dispatch.protocol.version}` : null
              }
            />
          </div>
        ) : null}

        <div className="grid gap-5 px-4 py-5 sm:px-5 lg:grid-cols-2">
          <div>
            <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Overview</p>
            <dl className="mt-3 divide-y divide-limestone-line">
              {[
                ["Service line", services.find((s) => s.slug === selected.service_slug)?.name ?? selected.service_slug],
                ["Urgency", selected.urgency],
                ["Due", when(selected.due_at)],
                ["Opened", when(selected.created_at)],
                ["Windstorm", twiaStatus(selected.county) === "check" ? "Harris County: confirm whether the property is east of SH 146" : selected.twia_county ? "Inside the designated catastrophe area" : "Outside the designated area"],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[130px_1fr] sm:gap-3">
                  <dt className="text-[13px] font-semibold text-slate">{k}</dt>
                  <dd className="text-[13.5px] leading-[1.5] text-slate-muted">{v}</dd>
                </div>
              ))}
            </dl>

            {can(actor, "pricing.read") ? (
              <>
                <p className="mt-6 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Billing</p>
                <dl className="mt-3 divide-y divide-limestone-line">
                  {[
                    ["Client price", money(selected.client_price_cents)],
                    ["Technician cost", money(selected.tech_cost_cents)],
                    ["Engineer production", money(selected.engineer_cost_cents)],
                    [
                      "Margin",
                      selected.client_price_cents
                        ? money(
                            selected.client_price_cents -
                              (selected.tech_cost_cents ?? 0) -
                              (selected.engineer_cost_cents ?? 0),
                          )
                        : "not set",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[130px_1fr] sm:gap-3">
                      <dt className="text-[13px] font-semibold text-slate">{k}</dt>
                      <dd className="text-[13.5px] text-slate-muted">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[12.5px] leading-[1.5] text-slate-muted">
                  Invoicing arrives with Stripe in a later phase. The figures are here so margin is
                  visible from the start rather than reconstructed later.
                </p>
              </>
            ) : null}
          </div>

          <div>
            <TransitionControls
              fileId={selected.id}
              status={selected.status}
              options={availableTransitions(actor, selected.status, {
                assignedTech: Boolean(selected.assigned_tech_id),
              })}
            />

            <p className="mt-7 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Timeline</p>
            {timeline.length === 0 ? (
              <p className="mt-2 text-[13.5px] text-slate-muted">Nothing recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {timeline.map((e) => (
                  <li key={String(e.id)} className="border-l-2 border-limestone-line pl-3">
                    <p className="text-[13.5px] font-semibold text-slate">
                      {e.kind === "status" && e.to_status
                        ? `${e.from_status ? STATUS_LABEL[e.from_status as keyof typeof STATUS_LABEL] + " to " : ""}${STATUS_LABEL[e.to_status as keyof typeof STATUS_LABEL]}`
                        : e.kind}
                    </p>
                    {e.body ? <p className="mt-0.5 text-[13px] leading-[1.5] text-slate-muted">{e.body}</p> : null}
                    <p className="mt-0.5 text-[12px] text-slate-muted">
                      {new Date(e.created_at as string).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {job?.protocol ? (
              <>
                <p className="mt-7 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                  Evidence
                </p>
                <p className="mt-2 text-[13.5px] font-semibold text-slate">
                  {progressLabel(job.state)}
                </p>
                <p className="mt-0.5 text-[13px] text-slate-muted">
                  Working to {job.protocol.name} v{job.protocol.version}.
                </p>
                {job.state.blockers.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {job.state.blockers.map((b) => (
                      <li key={b} className="text-[13px] leading-[1.5] text-slate-muted">
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href={`/portal/jobs/${selected.id}`}
                  className="mt-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-slate underline underline-offset-4"
                >
                  Open the checklist
                </Link>
              </>
            ) : null}

            <div className="mt-7 rounded-[4px] border border-dashed border-limestone-line px-4 py-4">
              <p className="text-[13px] font-semibold text-slate">Documents, tasks, messages</p>
              <p className="mt-1.5 text-[12.5px] leading-[1.55] text-slate-muted">
                Documents and sealing arrive with review, and tasks and messages after that. They are
                empty because those phases have not shipped, not because this file is missing
                anything.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="hidden lg:block">
      <EmptyState title="No file selected" body="Choose a file from the list to see it here." />
    </div>
  );

  return (
    <>
      <PageHead
        eyebrow="Work"
        title="Files"
        lede="One file per deliverable request, from intake to delivered. The platform enforces the order."
      />

      {isPrelaunch() ? (
        <div className="mb-5 rounded-[4px] border border-[#f0d9a8] bg-[#fdf3e0] px-4 py-3">
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
            Compliance gate active
          </p>
          <p className="mt-1 max-w-[75ch] text-[13px] leading-[1.55] text-[#7a4c05]">
            Files can be created and prepared. None can reach sealed or delivered while firm
            registration is pending and no Professional Engineer is in responsible charge. The rule
            is in the state machine, not in these buttons.
          </p>
        </div>
      ) : null}

      {can(actor, "files.create") ? (
        <div className="mb-6">
          <NewFileForm
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            services={services.map((s) => ({ slug: s.slug, name: s.name }))}
            counties={TEXAS_COUNTIES}
          />
        </div>
      ) : null}

      {/* The split. On lg the list keeps a fixed column and the detail takes the
          rest; below lg exactly one of them is rendered. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        {list}
        {detail}
      </div>
    </>
  );
}
