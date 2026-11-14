import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { daysWaiting, waitingOnOwners } from "@/lib/ops-engineer";
import { services } from "@/content/services";
import { EmptyState, PageHead } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { STAFF_LIST_PAGE_SIZE, staffListPage, staffListQuery, staffListRows, type StaffListSpec } from "@/lib/staff-lists";

export const dynamic = "force-dynamic";

/**
 * FILES WAITING ON A PROPERTY OWNER.
 *
 * WHY THIS SCREEN EXISTS, AND IT IS NOT A CONVENIENCE.
 *
 * 0053 gave the platform a word for a file whose certification is withheld
 * pending repairs the owner has to arrange, and the operator ruled that it does
 * not age out and cannot reach closed: "a homeowner who takes four months to
 * afford a roof repair has not abandoned anything, and a firm that closes his
 * file is the one who failed."
 *
 * That ruling has one cost and it is not a data cost. Nothing chases these. If
 * the owner never rings back, nobody notices, and a file sits in a true status
 * forever while the person who needs it has forgotten the firm exists.
 *
 * So this is the answer to that cost: VISIBILITY RATHER THAN EXPIRY. The
 * decision not to close these automatically is safe precisely because somebody
 * can see them, oldest first, with the age in days. Without this screen the same
 * decision would be negligence wearing a principle.
 *
 * NO MONEY ON IT. An engineer reaches this because these are files he withheld
 * certification on. What the job is worth and what anybody is paid are not his
 * business at the moment he is looking at a list of roofs he found leaks on.
 */
type WaitingRow = NonNullable<Awaited<ReturnType<typeof waitingOnOwners>>>[number];

/*
 * SEARCH, FILTER, SORT AND PAGES, through the shared engine (Robert's ruling 2 of
 * 2026-11-13, CLAUDE.md 2d). Longest waiting stays the default, for the reason
 * this screen exists; a file with no start date sorts last rather than first.
 */
const WAITING_LIST: StaffListSpec<WaitingRow> = {
  text: (f) => [f.file_number, f.property_address, f.county, services.find((s) => s.slug === f.service_slug)?.name ?? f.service_slug],
  filters: {
    service: Object.fromEntries(services.map((s) => [s.slug, (f: WaitingRow) => f.service_slug === s.slug])),
  },
  sorts: {
    waiting: { key: (f) => f.repairs_required_at, ascending: true },
    open: { key: (f) => f.openItems, ascending: false },
    county: { key: (f) => f.county, ascending: true },
  },
  defaultSort: "waiting",
};

export default async function WaitingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!holdsLicence(actor, "review.queue")) notFound();
  const params = await searchParams;

  const read = await waitingOnOwners(actor);
  const query = staffListQuery(params, WAITING_LIST);
  const matching = read === null ? null : staffListRows(read, query, WAITING_LIST);
  const shown = matching === null ? null : staffListPage(matching, query.page);
  const rows = shown?.rows ?? null;
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Waiting on owners"
        lede="Files where certification is withheld until repairs are done. They do not expire and nothing closes them, so this is the list that makes sure nobody is forgotten. Longest waiting first."
      />

      {read !== null && read.length > 0 ? (
        <ListControls
          action="/portal/waiting"
          search={params.q ?? ""}
          searchLabel="Search file number, address, county or service"
          filters={[
            {
              name: "service",
              label: "Service",
              value: query.filters.service ?? "",
              options: [{ value: "", label: "Every service" }, ...services.map((s) => ({ value: s.slug, label: s.name }))],
            },
          ]}
          sorts={[
            { value: "waiting", label: "Longest waiting" },
            { value: "open", label: "Most repairs open" },
            { value: "county", label: "County" },
          ]}
          sort={query.sort}
          direction={query.ascending ? "asc" : "desc"}
        />
      ) : null}

      {rows === null ? (
        <p role="alert" className="text-[14px] leading-[1.6] text-[var(--ink)]">
          The files waiting on owners could not be read just now, so whether anybody is waiting is not known. Reload the page; nothing was changed.
        </p>
      ) : rows.length === 0 ? (
        read && read.length > 0 ? (
          <EmptyState title="Nothing matches that" body="Clear the search or the filter to see every file waiting on its owner." />
        ) : (
          <EmptyState
            title="Nobody is waiting"
            body="A file arrives here when an engineer withholds certification and issues a repair list. It leaves when the owner says the work is done and the revisit is dispatched."
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((f) => {
            const days = daysWaiting(f.repairs_required_at);
            return (
              <li key={f.id}>
                <Link
                  href={`/portal/files?id=${f.id}`}
                  className="block rounded-[2px] border border-[var(--border)] bg-white p-4 transition-colors hover:border-slate"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] text-[var(--secondary)]">{f.file_number}</p>
                      <p className="mt-1 text-[14px] font-semibold text-[var(--ink)]">
                        {f.property_address}
                      </p>
                      <p className="mt-0.5 text-[14px] text-[var(--secondary)]">
                        {f.county} County, {serviceName(f.service_slug)}
                      </p>
                      <p className="mt-1.5 text-[14px] text-[var(--secondary)]">
                        {f.openItems} of {f.totalItems} repair
                        {f.totalItems === 1 ? "" : "s"} still open
                      </p>
                    </div>
                    {/*
                      * ABSENT IS NOT ZERO. A file with no stamped date has an
                      * UNKNOWN age, not an age of nought, and saying "today"
                      * would put the oldest file at the top reading as the
                      * newest.
                      */}
                    <p className="text-[14px] font-semibold text-[var(--ink)]">
                      {days === null
                        ? "Waiting, start date not recorded"
                        : days === 0
                          ? "Since today"
                          : `${days} day${days === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {shown && shown.total > 0 ? (
        <Pager page={shown.page} pageSize={STAFF_LIST_PAGE_SIZE} total={shown.total} hrefFor={(n) => listHref("/portal/waiting", params, { page: n > 1 ? String(n) : "" })} />
      ) : null}

      <p className="mt-6 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
        Nothing on this list expires. A file leaves it when the owner has had the work done and the
        revisit is dispatched, or when the job is called off deliberately. The protocol has no
        conditional certification, so none of these can be sealed until every item on its repair
        list has been verified one at a time.
      </p>
    </>
  );
}
