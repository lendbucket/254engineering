import Link from "next/link";
import { RestrictedMode } from "@/components/portal/design";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listFilesPage, FILE_LIST_CAP, getFile, listClients, fileTimeline, fileRegion } from "@/lib/ops-crm";
import { availableTransitions, STATUS_LABEL, FILE_STATUSES } from "@/lib/ops-files";
import { TEXAS_COUNTIES, twiaStatus } from "@/lib/ops-counties";
import { outstandingFor, answeredFor, readAnswers } from "@/lib/ops-file-inputs";
import { FILE_DETAIL_FIELDS } from "@/lib/file-detail-fields";
import { ContactLogPanel } from "@/components/portal/ContactLog";
import { FileDetailsForm, ReleaseTechnician } from "./DeskFileClient";
import { AuthorityDetailsForm } from "@/components/portal/LetterFactsPanels";
import { recordedFactsFor } from "@/lib/letter-facts";
import { services } from "@/content/services";
import { EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { FileSelection } from "./FileSelection";
import { EXPORT_LIMIT } from "@/lib/ops-bulk-files";
import { dispatchContext, jobView } from "@/lib/ops-field";
import { marginOf, money } from "@/lib/ops-money";
import { partnerCostByFile } from "@/lib/ops-partner-comp";
import { progressLabel } from "@/lib/ops-evidence";
import { NewFileForm, TransitionControls, RequestInformation } from "./FileClient";
import { DispatchPanel } from "./DispatchPanel";
import { FileThreadButton } from "@/components/portal/FileThreadButton";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { ListControls } from "@/components/portal/ListControls";
import { LIST_NOT_LOADED } from "@/lib/outcome-copy";
import { RetryButton } from "@/components/portal/Unreachable";

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
  return (formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "");
}

export default async function FilesPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; status?: string; county?: string; q?: string; page?: string; dir?: string; sort?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "files.list")) notFound();
  const params = await searchParams;
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const oldest = params.dir === "asc";

  const { rows: files, more: moreFiles, error: filesError } = await listFilesPage(actor, {
    status: params.status,
    county: params.county,
    search: params.q,
    page,
    oldest,
  });
  const selected = params.id ? await getFile(actor, params.id) : null;
  const timelineRead = selected ? await fileTimeline(selected.id) : [];
  /* A failed read is said where the timeline would be, never "Nothing recorded yet." (section 6, class A). */
  const timelineFailed = timelineRead === null;
  const timeline = timelineRead ?? [];

  /* The contact, access and scheduling answers, for the details form (files.update_details, 2026-10-20). */
  const answersRead = selected && can(actor, "files.update_details") ? await readAnswers(selected.id) : null;
  /* A failed read is said, never shown as blank boxes to fill in again (finding F12 of the 2026-10-24 audit). */
  const answersUnread = answersRead && !answersRead.ok ? answersRead.error : null;
  const answers = answersRead && answersRead.ok ? answersRead.answers : {};
  const detailValues = Object.fromEntries(FILE_DETAIL_FIELDS.map((f) => [f.id, answers[f.id] ?? ""]));
  /* PL-2, ruling 7 of 2026-10-23: the office records the authority's address and salutation on a permit letter file. */
  const permitLetterFacts =
    selected && selected.service_slug === "structural-letters" && can(actor, "files.update_details")
      ? await recordedFactsFor(selected.id)
      : null;

  /*
   * The margin, from the one function that knows what a margin is.
   *
   * partnerCostByFile returns a knowable ZERO for a file with no partner and
   * null for one whose commission has not been worked out yet, which is the
   * distinction that makes marginOf able to say it does not know.
   */
  const partnerCosts = selected
    ? await partnerCostByFile([{ id: selected.id, partnerId: selected.partner_id ?? null }])
    : null;
  const selectedMargin = {
    partnerCostCents: selected ? (partnerCosts?.get(selected.id) ?? null) : null,
    ...marginOf({
      clientPriceCents: selected?.client_price_cents ?? null,
      techCostCents: selected?.tech_cost_cents ?? null,
      engineerCostCents: selected?.engineer_cost_cents ?? null,
      partnerCostCents: selected ? (partnerCosts?.get(selected.id) ?? null) : null,
    }),
  };

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
  /*
   * WHAT THIS FILE IS STILL MISSING.
   *
   * Phase 10 Section 1.5 Section C item 3. The stage asked about depends on
   * where the file is: a file waiting for dispatch is asked what a technician
   * needs, and a file at review is asked what an engineer needs to issue the
   * document. The same function answers both, reading the same definition, so
   * this screen and the review queue cannot disagree about whether a job is
   * ready.
   */
  const outstanding = selected
    ? await outstandingFor(
        selected.id,
        selected.service_slug,
        selected.deliverable,
        selected.status === "needs_dispatch" || selected.status === "intake" ? "dispatch" : "seal",
      )
    : null;

  const answered = selected
    ? await answeredFor(selected.id, selected.service_slug, selected.deliverable)
    : [];

  const clients = can(actor, "files.create") ? await listClients(actor) : [];

  const filterHref = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) next.set(k, v);
    next.delete("id");
    return `/portal/files${next.toString() ? `?${next}` : ""}`;
  };

  const list = (
    /*
      min-w-0 because this is the GRID ITEM. A grid item defaults to
      min-width:auto and refuses to shrink below its content, so the scrolling
      chip row inside it pushed this div to 1364px in a 358px column and the
      shell clipped the result. Putting min-w-0 on the chip row itself did
      nothing: the constraint that mattered was one level up.
    */
    <div className={selected ? "hidden min-w-0 lg:block" : "block min-w-0"}>
      {/*
        One row on a phone, wrapping at sm and up. See the note in
        docs/PORTAL_DESIGN_STANDARDS.md point 2: a component may scroll
        sideways when it says so, and this one says so with a visible
        scrollbar and a focusable region rather than by waiting to be
        discovered.
      */}
      <div
        role="region"
        aria-label="Filter files by status"
        tabIndex={0}
        className="scroll-x portal-panel-scroll mb-4 flex min-w-0 gap-2 pb-2 sm:flex-wrap sm:overflow-visible sm:pb-0"
      >
        <Link
          href={filterHref({ status: undefined, page: undefined })}
          className={`inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-[2px] border px-3 text-[14px] font-semibold ${
            !params.status ? "border-slate bg-slate text-[var(--on-navy)]" : "border-[var(--border)] text-[var(--secondary)]"
          }`}
        >
          All
        </Link>
        {FILE_STATUSES.filter((s) => s !== "cancelled").map((s) => (
          <Link
            key={s}
            href={filterHref({ status: s, page: undefined })}
            className={`inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-[2px] border px-3 text-[14px] font-semibold ${
              params.status === s ? "border-slate bg-slate text-[var(--on-navy)]" : "border-[var(--border)] text-[var(--secondary)]"
            }`}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <ListControls
        action="/portal/files"
        search={params.q ?? ""}
        searchLabel="Search file number or address"
        filters={[
          {
            name: "status",
            label: "Status",
            value: params.status ?? "",
            options: [{ value: "", label: "All" }, ...FILE_STATUSES.filter((s) => s !== "cancelled").map((s) => ({ value: s, label: STATUS_LABEL[s] }))],
          },
        ]}
        sorts={[{ value: "opened", label: "Opened" }]}
        sort="opened"
        direction={oldest ? "asc" : "desc"}
      />

      {/* Which part of the list this is, and the way to the rest (2026-10-10; paged since 2026-10-24). */}
      {page > 1 || moreFiles ? (
        <p className="mb-3 text-[13px] leading-[1.6] text-[var(--secondary)]">
          Files {(page - 1) * FILE_LIST_CAP + 1} to {(page - 1) * FILE_LIST_CAP + files.length}, {oldest ? "oldest" : "newest"} first.
          {moreFiles ? " More follow on the next page." : " This is the last page."}
        </p>
      ) : null}

      {filesError ? (
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{LIST_NOT_LOADED}</p>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">The files could not be read, so this is not an empty list.</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          title={params.status || params.q ? "Nothing matches that" : "No files yet"}
          body={
            params.status || params.q
              ? "Clear the filter to see everything."
              : "A file is one deliverable request: a property, a client, and a service line. Open one above, or convert a lead from the clients screen."
          }
        />
      ) : (
        /*
          The list moved into a client component so rows can be TICKED. What it
          renders is the same card; what it adds is a checkbox beside each one
          and a toolbar above them when anything is chosen. See
          docs/bulk-actions-reconciliation.md for why Export is the only one of
          the prototype's three bulk buttons that is here.
        */
        <FileSelection
          canDispatch={can(actor, "offers.dispatch")}
          limit={EXPORT_LIMIT}
          selectedId={selected?.id ?? null}
          files={files.map((f) => ({
            id: f.id,
            file_number: f.file_number,
            property_address: f.property_address,
            county: f.county,
            twia_county: f.twia_county,
            status: f.status,
            statusLabel: STATUS_LABEL[f.status],
          }))}
        />
      )}
      {!filesError && (page > 1 || moreFiles) ? (
        <nav aria-label="Pages of files" className="mt-4 flex gap-3 print:hidden">
          {page > 1 ? (
            <Link href={filterHref({ page: page - 1 > 1 ? String(page - 1) : undefined })} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
              Previous page
            </Link>
          ) : null}
          {moreFiles ? (
            <Link href={filterHref({ page: String(page + 1) })} className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
              Next page
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );

  const detail = selected ? (
    <div>
      <Link
        href={filterHref({})}
        className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--secondary)] lg:hidden"
      >
        Back to the list
      </Link>

      <div className="border-t-2 border-[var(--ink)]">
        <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] text-[var(--secondary)]">{selected.file_number}</p>
              <h2 className="mt-1 font-display text-[17px] leading-[1.2] font-bold text-[var(--ink)]">
                {selected.property_address}
              </h2>
              <p className="mt-1 text-[14px] text-[var(--secondary)]">
                {selected.city ? `${selected.city}, ` : ""}
                {selected.county} County
                {fileRegion(selected.county) ? ` (${fileRegion(selected.county)})` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-[14px] font-semibold text-[var(--ink)]">{STATUS_LABEL[selected.status]}</p>
              {selected.twia_county ? (
                <p className="text-[14px] text-[var(--ink)]">TWIA designated</p>
              ) : null}
            </div>
          </div>
        </div>

        {outstanding && (outstanding.now.length > 0 || outstanding.later.length > 0) ? (
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <p className="portal-kicker">Outstanding information</p>
            {outstanding.now.length > 0 ? (
              <>
                <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--ink)]">
                  {selected.status === "needs_dispatch" || selected.status === "intake"
                    ? "Needed before a technician is sent."
                    : "Needed before this can be sealed."}
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {outstanding.now.map((f) => (
                    <li key={f.id} className="text-[14px] leading-[1.5] font-semibold text-[var(--ink)]">
                      {f.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1.5 text-[14px] leading-[1.55] text-[var(--secondary)]">
                Nothing is outstanding for this step.
              </p>
            )}

            {outstanding.now.length > 0 && can(actor, "messages.use") ? (
              <RequestInformation fileId={selected.id} />
            ) : null}

            {can(actor, "messages.use") ? (
              <div className="mt-3">
                <FileThreadButton fileId={selected.id} />
              </div>
            ) : null}

            {outstanding.later.length > 0 ? (
              <>
                <p className="mt-3 text-[13px] font-semibold text-[var(--ink)]">Needed later</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {outstanding.later.map((f) => (
                    <li key={f.id} className="text-[13px] leading-[1.5] text-[var(--secondary)]">
                      {f.label}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}

        {dispatch ? (
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <DispatchPanel
              fileId={selected.id}
              offers={dispatch.plan.offers}
              ineligible={dispatch.plan.ineligible}
              alreadyOffered={dispatch.alreadyOffered}
              feeCents={dispatch.feeCents}
              rateSet={dispatch.rateSet}
              rateVisible={dispatch.rateVisible}
              proximityUnavailable={dispatch.proximityUnavailable}
              propertyLocated={dispatch.propertyLocated}
              protocolName={
                dispatch.protocol ? `${dispatch.protocol.name} v${dispatch.protocol.version}` : null
              }
            />
          </div>
        ) : null}

        {answered.length > 0 ? (
          <div className="border-b border-[var(--border)] px-4 py-4 sm:px-5">
            <p className="portal-kicker">What the job was told</p>
            <dl className="mt-2 flex flex-col gap-2">
              {answered.map(({ field, value }) => (
                <div key={field.id} className="flex flex-wrap items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-[var(--secondary)]">{field.label}</dt>
                  <dd className="text-[14px] font-semibold text-[var(--ink)]">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="grid gap-5 px-4 py-5 sm:px-5 lg:grid-cols-2">
          <div>
            <p className="portal-label">Overview</p>
            <dl className="mt-3 divide-y divide-limestone-line">
              {[
                ["Service line", services.find((s) => s.slug === selected.service_slug)?.name ?? selected.service_slug],
                ["Urgency", selected.urgency],
                ["Due", when(selected.due_at)],
                ["Opened", when(selected.created_at)],
                ["Windstorm", twiaStatus(selected.county) === "check" ? "Harris County: confirm whether the property is east of SH 146" : selected.twia_county ? "Inside the designated catastrophe area" : "Outside the designated area"],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[130px_1fr] sm:gap-3">
                  <dt className="text-[14px] font-semibold text-[var(--ink)]">{k}</dt>
                  <dd className="text-[14px] leading-[1.5] text-[var(--secondary)]">{v}</dd>
                </div>
              ))}
            </dl>

            {can(actor, "pricing.read") ? (
              <>
                <p className="mt-6 portal-label">Billing</p>
                <dl className="mt-3 divide-y divide-limestone-line">
                  {[
                    ["Client price", money(selected.client_price_cents ?? null)],
                    ["Technician cost", money(selected.tech_cost_cents ?? null)],
                    ["Engineer production", money(selected.engineer_cost_cents ?? null)],
                    ["Partner commission", money(selectedMargin.partnerCostCents)],
                    /*
                     * THIS WAS COMPUTED HERE AND IT WAS WRONG TWICE.
                     *
                     * It read `price - (tech ?? 0) - (engineer ?? 0)`, so an
                     * unpriced cost counted as nothing and an unfinished file
                     * showed a margin equal to its full revenue: wrong, in the
                     * flattering direction, with a plausible number in it. That
                     * is the exact failure ops-money.ts was written to prevent,
                     * on the operator's own per file screen.
                     *
                     * And it omitted the partner commission entirely, so this
                     * page and /portal/billing disagreed about the same file
                     * whenever a partner was attributed to it.
                     *
                     * marginOf counts all four costs and propagates absence, so
                     * a missing figure makes the margin unknown rather than
                     * flattering. The `missing` list below names which.
                     */
                    ["Margin", money(selectedMargin.margin)],
                  ].map(([k, v]) => (
                    <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[130px_1fr] sm:gap-3">
                      <dt className="text-[14px] font-semibold text-[var(--ink)]">{k}</dt>
                      <dd className="text-[14px] text-[var(--secondary)]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[13px] leading-[1.5] text-[var(--secondary)]">
                  These are the figures this file&apos;s margin is computed from.
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

            <p className="mt-7 portal-label">Timeline</p>
            {timelineFailed ? (
              <p role="alert" className="mt-2 text-[14px] text-[var(--ink)]">The timeline could not be read just now. Reload the page; nothing was changed.</p>
            ) : timeline.length === 0 ? (
              <p className="mt-2 text-[14px] text-[var(--secondary)]">Nothing recorded yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {timeline.map((e) => (
                  <li key={String(e.id)} className="border-l-2 border-[var(--border)] pl-3">
                    <p className="text-[14px] font-semibold text-[var(--ink)]">
                      {e.kind === "status" && e.to_status
                        ? `${e.from_status ? STATUS_LABEL[e.from_status as keyof typeof STATUS_LABEL] + " to " : ""}${STATUS_LABEL[e.to_status as keyof typeof STATUS_LABEL]}`
                        : e.kind}
                    </p>
                    {e.body ? <p className="mt-0.5 text-[14px] leading-[1.5] text-[var(--secondary)]">{e.body}</p> : null}
                    <p className="mt-0.5 text-[12px] text-[var(--secondary)]">
                      {(formatInFirmZone(e.created_at as string, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }) ?? "")}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {job?.protocol ? (
              <>
                <p className="mt-7 portal-label">
                  Evidence
                </p>
                <p className="mt-2 text-[14px] font-semibold text-[var(--ink)]">
                  {progressLabel(job.state)}
                </p>
                <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                  Working to {job.protocol.name} v{job.protocol.version}.
                </p>
                {job.state.blockers.length > 0 ? (
                  <ul className="mt-2 flex flex-col gap-1">
                    {job.state.blockers.map((b) => (
                      <li key={b} className="text-[14px] leading-[1.5] text-[var(--secondary)]">
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Link
                  href={`/portal/jobs/${selected.id}`}
                  className="mt-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
                >
                  Open the checklist
                </Link>
              </>
            ) : null}

            <div className="mt-7 border-t border-[var(--row-rule)] pt-4">
              <p className="text-[14px] font-semibold text-[var(--ink)]">Documents, tasks, messages</p>
              <p className="mt-1.5 text-[13px] leading-[1.55] text-[var(--secondary)]">
                {/* The old sentence said these "have not shipped"; all three have (product audit, 2026-10-10). */}
                A file&apos;s filed and sealed documents are on Documents, and its tasks and threads are on
                Tasks and Messages.
              </p>
            </div>
          </div>
        </div>

        {can(actor, "files.update_details") ? (
          <div className="mt-8 print:hidden">
            <p className="portal-label">Contact, access and scheduling</p>
            {answersUnread ? (
              <p className="mt-2 text-[14px] text-[var(--ink)]">{answersUnread} Reload the page; nothing was changed.</p>
            ) : (
              <FileDetailsForm fileId={selected.id} values={detailValues} />
            )}
          </div>
        ) : null}

        {selected.service_slug === "structural-letters" && can(actor, "files.update_details") ? (
          <div className="mt-8 print:hidden">
            <p className="portal-label">The permitting authority, for the letter</p>
            {permitLetterFacts && !answersUnread ? (
              <AuthorityDetailsForm
                fileId={selected.id}
                authorityName={answers.authority_name ?? null}
                address={permitLetterFacts.authority_address?.value ?? null}
                salutation={permitLetterFacts.authority_salutation?.value ?? null}
              />
            ) : (
              <p className="mt-2 text-[14px] text-[var(--ink)]">The authority&apos;s details could not be read just now. Reload the page; nothing was changed.</p>
            )}
          </div>
        ) : null}

        {selected.status === "dispatched" && selected.assigned_tech_id && can(actor, "offers.dispatch") ? (
          <div className="mt-8 print:hidden">
            <p className="portal-label">Reassign</p>
            <ReleaseTechnician fileId={selected.id} />
          </div>
        ) : null}

        <ContactLogPanel actor={actor} subject="file" subjectId={selected.id} className="mt-8" />
      </div>
    </div>
  ) : (
    <div className="hidden lg:block">
      <EmptyState title="No file open" body="Choose a file from the list to see it here." />
    </div>
  );

  return (
    <>
      <PageHead
        eyebrow="Work"
        title="Files"
        lede="One file per deliverable request, from intake to delivered. The platform enforces the order."
        actions={
          /*
           * The other way in. Somebody already looking at the work is the
           * person most likely to be told about a new job, and sending them to
           * the sidebar for it is a tax on the common case.
           */
          can(actor, "files.create") ? (
            <Link
              href="/portal/intake"
              className="inline-flex min-h-[var(--tap-target)] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-bold text-white hover:bg-[var(--navy-hover)]"
            >
              New job
            </Link>
          ) : null
        }
      />

      <RestrictedMode also="Files can be created and prepared. The rule is in the state machine, not in these buttons." />

      {/* create_file is admin only (payments.charge), owner ruling 2026-10-20, so the form shows only where it works. */}
      {can(actor, "files.create") && can(actor, "payments.charge") ? (
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
