import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { listSuppressions } from "@/lib/marketing-suppression";
import { Chip, EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { SUPPRESSION_LIST, STAFF_LIST_PAGE_SIZE, staffListPage, staffListQuery, staffListRows } from "@/lib/staff-lists";
import { LIST_EXPORT_GRANT } from "@/lib/list-exports";
import { AddSuppression, VoidSuppression } from "./SuppressionsClient";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * The do not contact list.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * The suppression list shipped with the email port and had exactly one way in:
 * a person clicking the unsubscribe link in an email the firm sent them. Every
 * other way somebody asks, and the common one is saying it out loud on a
 * telephone call, could not be recorded without somebody writing SQL against
 * production. So the honest options were to lose the request or to hand a
 * database console to whoever took the call.
 *
 * TWO KINDS OF ROW, AND THE DIFFERENCE IS THE POINT
 * -------------------------------------------------
 * A row with a token came from a click, in an email addressed to that person.
 * A row without one came from somebody being told and typing what they heard.
 * 0026 kept that distinction in the schema as an honest difference between
 * "they clicked" and "somebody says they asked", and this screen is where it
 * finally means something: only the second kind can be removed.
 *
 * MARKING IS A CORRECTION AND IS NOT A RESUBSCRIBE
 * -------------------------------------------------
 * 0026 says this table has no delete and no resubscribe column, and it is right
 * about why: consent to hear from the firm again is a NEW fact with its own
 * date, not the absence of an old one, and it gets its own table and its own
 * ruling when somebody asks for it.
 *
 * What this removes is a typing mistake. An operator takes a request, mistypes
 * the address, and a customer who never asked for anything quietly stops
 * hearing from the firm. That row records no decision anybody made, and
 * deleting it asserts nothing about consent. The server refuses every other
 * case against the row rather than trusting this screen.
 */
/**
 * Close a sentence somebody typed into a form.
 *
 * An operator writing "wrong address typed on the call" has said the whole
 * thing; asking them to add a full stop so the screen reads properly is the
 * screen's job leaking into theirs. This adds one when there is none, and
 * leaves any other terminal punctuation alone.
 */
function sentence(text: string): string {
  const t = text.trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

export default async function SuppressionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "suppressions.manage")) notFound();

  const params = await searchParams;
  const all = await listSuppressions();
  const query = staffListQuery(params, SUPPRESSION_LIST);
  const shown = all === null ? null : staffListPage(staffListRows(all, query, SUPPRESSION_LIST), query.page);
  const rows = shown?.rows ?? null;
  const searching = Boolean(query.term || query.filters.source || query.filters.state);

  return (
    <>
      <PageHead
        eyebrow="Marketing"
        title="Do not contact"
        lede="Everybody who has asked to stop receiving marketing from the firm, and how the firm came to know. Receipts, sealed document notices and refund decisions are never gated by this list: somebody who paid is owed those whatever their marketing preference says."
      />

      <div className="grid min-w-0 gap-6 [&>*]:min-w-0 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <Panel title="Record a request">
          <AddSuppression />
        </Panel>

        <Panel title={shown && all ? (searching ? `The list (${shown.total} matching of ${all.length})` : `The list (${shown.total})`) : "The list"}>
          <ListControls
            action="/portal/suppressions"
            search={params.q ?? ""}
            searchLabel="Search address or reason"
            filters={[
              {
                name: "source",
                label: "How it came",
                value: query.filters.source,
                options: [
                  { value: "", label: "Either" },
                  { value: "clicked", label: "They clicked the link" },
                  { value: "recorded", label: "Recorded by somebody here" },
                ],
              },
              {
                name: "state",
                label: "Standing",
                value: query.filters.state,
                options: [
                  { value: "", label: "Both" },
                  { value: "standing", label: "In force" },
                  { value: "mistake", label: "Marked as a mistake" },
                ],
              },
            ]}
            sorts={[
              { value: "added", label: "Added" },
              { value: "email", label: "Address" },
            ]}
            sort={query.sort}
            direction={query.ascending ? "asc" : "desc"}
            csvHref={can(actor, LIST_EXPORT_GRANT) ? listHref("/api/portal/exports", { q: params.q, source: params.source, state: params.state, sort: params.sort, dir: params.dir }, { report: "suppressions" }) : undefined}
          />
          {/*
            Null is a failed read and it is not an empty list. Saying "nobody has
            asked" when the query did not run would be the absent-versus-zero
            defect on the one screen where the wrong answer means writing to
            somebody who told the firm to stop.
          */}
          {rows === null ? (
            <ErrorState
              title="The list could not be read"
              body="This is not the same as nobody having asked. Do not send marketing on the strength of this screen until it loads. Tell an administrator."
            />
          ) : rows.length === 0 && searching ? (
            <EmptyState title="No row matches that search" body="This is a search with no match, not an empty list. Clear the search to see every row." />
          ) : rows.length === 0 ? (
            <EmptyState
              title="Nobody has asked to stop"
              body="The query ran and found no rows. Anybody who unsubscribes from an email, or asks somebody here to do it for them, appears on this list."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {rows.map((row) => (
                <li
                  key={row.email}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--row-rule)] py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold break-words text-[var(--ink)]">{row.email}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--secondary)]">{row.because}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-[var(--secondary)]">
                      <Chip
                        label={row.enteredByOperator ? "Recorded by somebody here" : "They clicked the link"}
                        tone={row.enteredByOperator ? "warn" : "good"}
                      />
                      {(formatInFirmZone(row.createdAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }) ?? "")}
                    </p>
                  </div>

                  {/*
                    A row somebody clicked to produce carries no remove control
                    at all, rather than one that fails when pressed. The server
                    refuses it either way; not offering it is the honest version.
                  */}
                  {row.voided ? (
                    /*
                     * TWO THINGS HERE WERE FOUND BY LOOKING AT A SCREENSHOT, WHICH IS
                     * WHY THE RULE SAYS TO LOOK AT ONE.
                     *
                     * It was `text-right` inside `max-w-[280px]`, so three sentences
                     * of explanation rendered as a narrow ragged column hard against
                     * the edge of the row. Right alignment is for a figure or a
                     * control, not for prose somebody has to read.
                     *
                     * And the sentences ran into each other. The reason an operator
                     * types is lowercase and carries no full stop, so the row read
                     * "Marked as a mistake. wrong address typed on the call Recorded
                     * instead for meant@example.com." The copy cannot require the
                     * operator to punctuate; it has to close the sentence itself.
                     */
                    <p className="mt-2 w-full text-[13px] text-[var(--ink-soft)]">
                      Marked as a mistake: {sentence(row.voided.because)}{" "}
                      {row.voided.replacedBy
                        ? `Recorded instead for ${row.voided.replacedBy}.`
                        : `No correct address: ${sentence(row.voided.noReplacementBecause ?? "")}`}{" "}
                      This address hears from the firm again; the row stays, because a consent
                      record is never deleted.
                    </p>
                  ) : row.enteredByOperator ? (
                    <VoidSuppression email={row.email} />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {shown ? (
            <Pager page={shown.page} pageSize={STAFF_LIST_PAGE_SIZE} total={shown.total} hrefFor={(n) => listHref("/portal/suppressions", params, { page: n > 1 ? String(n) : "" })} />
          ) : null}
        </Panel>
      </div>
    </>
  );
}
