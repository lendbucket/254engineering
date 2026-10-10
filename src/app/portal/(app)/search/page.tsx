import { notFound } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { searchRecords, SEARCH_LIMIT, SEARCH_MIN_LENGTH } from "@/lib/ops-search";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * ONE RECORD SEARCH FOR STAFF. Operator ruling, 2026-10-10 (gap 6 of the
 * product audit). A reference, an email, a phone number or an address, and the
 * orders and files it matches. src/lib/ops-search.ts holds the rules: nothing
 * here widens what the viewer may see.
 *
 * A GET form, so a search is a URL somebody can paste into a thread, and the
 * screen renders on the server with no client code of its own.
 */
const field =
  "min-h-[var(--tap-target)] w-full rounded-[2px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--ink)]";

const when = (value: string) => formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? "";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await currentActor();
  if (!can(actor, "files.list")) notFound();
  const { q } = await searchParams;
  const asked = (q ?? "").trim();
  const result = asked ? await searchRecords(actor, asked) : null;

  return (
    <>
      <PageHead
        eyebrow="Records"
        title="Search"
        lede="An order reference, an email address, a phone number or a street address. Orders and files that match, newest first."
      />

      <form method="get" action="/portal/search" className="mb-6 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="search-q" className="sr-only">
          Reference, email, phone or address
        </label>
        <input
          id="search-q"
          name="q"
          type="search"
          defaultValue={asked}
          minLength={SEARCH_MIN_LENGTH}
          placeholder="Reference, email, phone or address"
          className={field}
        />
        <button
          type="submit"
          className="inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[2px] bg-[var(--navy)] px-5 text-[15px] font-semibold text-white"
        >
          Search
        </button>
      </form>

      {result === null ? null : !result.ok ? (
        <EmptyState title="Nothing searched" body={result.reason} />
      ) : (
        <>
          {result.orders !== null ? (
            <Panel
              title={`Orders matching "${result.term}"`}
              description={
                result.ordersMore
                  ? `The newest ${SEARCH_LIMIT} are shown and more exist. Narrow the search to find an older one.`
                  : `${result.orders.length} found.`
              }
            >
              {result.orders.length === 0 ? (
                <p className="text-[14px] text-[var(--secondary)]">No order matches.</p>
              ) : (
                <ul className="divide-y divide-[var(--row-rule)]">
                  {result.orders.map((o) => (
                    <li key={o.reference} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                        {o.file_id ? (
                          <Link
                            href={`/portal/files?id=${o.file_id}`}
                            className="inline-flex min-h-[var(--tap-target)] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
                          >
                            {o.reference}
                          </Link>
                        ) : (
                          <span className="text-[14px] font-semibold text-[var(--ink)]">{o.reference}</span>
                        )}
                        <span className="flex flex-wrap gap-2">
                          <Chip tone="neutral" label={o.status.replace(/_/g, " ")} />
                          {o.is_demo ? <Chip tone="warn" label="Demonstration" /> : null}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] leading-[1.6] text-[var(--secondary)]">
                        {[o.customer_name, o.customer_email, o.customer_phone, o.property_address].filter(Boolean).join(" · ")}
                        {` · ${when(o.created_at)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}

          <Panel
            title={`Files matching "${result.term}"`}
            description={
              result.filesMore
                ? `The first ${SEARCH_LIMIT} are shown and more exist. Narrow the search to find another.`
                : `${result.files.length} found, by file number, address, or the client's email or phone.`
            }
          >
            {result.files.length === 0 ? (
              <p className="text-[14px] text-[var(--secondary)]">No file you can see matches.</p>
            ) : (
              <ul className="divide-y divide-[var(--row-rule)]">
                {result.files.map((f) => (
                  <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                      <Link
                        href={`/portal/files?id=${f.id}`}
                        className="inline-flex min-h-[var(--tap-target)] items-center text-[14px] font-semibold text-[var(--ink)] underline underline-offset-4"
                      >
                        {f.file_number}
                      </Link>
                      <Chip tone="neutral" label={STATUS_LABEL[f.status as FileStatus] ?? f.status} />
                    </div>
                    <p className="mt-1 text-[13px] leading-[1.6] text-[var(--secondary)]">{f.property_address}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
