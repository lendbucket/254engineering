import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { awaitingVerification } from "@/lib/ops-credential-submissions";
import { calendarDateLabel, firmDateLabel } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { VerificationQueue } from "../techs/VerificationQueue";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { CREDENTIAL_LIST, STAFF_LIST_PAGE_SIZE, staffListPage, staffListQuery, staffListRows } from "@/lib/staff-lists";

export const dynamic = "force-dynamic";

/**
 * CREDENTIAL REVIEW, WITHOUT THE PAY LEDGER. technicians.onboard, 2026-10-20.
 *
 * The verification queue already lives on /portal/techs, and that screen also
 * carries every technician's pay, which neither staff level may see. So the
 * queue is here on its own, the same component and the same read. The verify
 * and reject actions behind it check technicians.onboard against the
 * credential owner being a field technician.
 */
export default async function CredentialsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "technicians.onboard")) notFound();
  const params = await searchParams;
  const all = await awaitingVerification();
  const query = staffListQuery(params, CREDENTIAL_LIST);
  const shown = all === null ? null : staffListPage(staffListRows(all, query, CREDENTIAL_LIST), query.page);
  const queue = shown?.rows ?? null;
  const searching = Boolean(query.term || query.filters.expiry);

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Credential review"
        lede="Credentials field technicians submitted themselves: the type, the issuing state and the expiry. Dispatch counts none of them until one is verified here."
        actions={
          <Link href="/portal/onboarding" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
            Onboarding
          </Link>
        }
      />
      <ListControls
        action="/portal/credentials"
        search={params.q ?? ""}
        searchLabel="Search technician, credential or state"
        filters={[
          {
            name: "expiry",
            label: "Expiry",
            value: query.filters.expiry,
            options: [
              { value: "", label: "Either" },
              { value: "dated", label: "Carries an expiry" },
              { value: "undated", label: "No expiry" },
            ],
          },
        ]}
        sorts={[
          { value: "submitted", label: "Submitted" },
          { value: "name", label: "Technician" },
          { value: "expires", label: "Expires" },
        ]}
        sort={query.sort}
        direction={query.ascending ? "asc" : "desc"}
      />
      <Panel title={`Awaiting verification${all && all.length ? ` (${searching ? `${shown?.total ?? 0} matching of ${all.length}` : all.length})` : ""}`}>
        {queue === null ? (
          <ErrorState title="The submissions could not be read" body="This is not an empty queue. Reload in a minute; if it persists, tell an administrator." />
        ) : queue.length === 0 && searching ? (
          <EmptyState title="No submission matches that search" body="This is a search with no match, not an empty queue. Clear the search to see every submission." />
        ) : queue.length === 0 ? (
          <EmptyState
            title="Nothing is waiting"
            body="When a technician submits a credential from their own screen, it appears here to be checked against the document they hold."
          />
        ) : (
          <VerificationQueue
            rows={queue.map((s) => ({
              id: s.id,
              name: s.name,
              label: s.label,
              detail: [s.issuingState ? `Issued in ${s.issuingState}` : null, s.expiresOn ? `expires ${calendarDateLabel(s.expiresOn)}` : "no expiry"]
                .filter(Boolean)
                .join(", "),
              submitted: firmDateLabel(s.submittedAt) ?? "on an unrecorded date",
            }))}
          />
        )}
        {shown ? (
          <Pager page={shown.page} pageSize={STAFF_LIST_PAGE_SIZE} total={shown.total} hrefFor={(n) => listHref("/portal/credentials", params, { page: n > 1 ? String(n) : "" })} />
        ) : null}
      </Panel>
    </>
  );
}
