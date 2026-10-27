import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { getQuote, listQuotes } from "@/lib/ops-quotes";
import { QUOTE_SORTS, QUOTE_HOLD_DAYS, hasLapsed, quoteListRows, shownStatus, type QuoteRow } from "@/lib/quote-rules";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/ops-orders";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { catalogFor } from "@data/catalog";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { DeclineQuoteForm, ResendQuoteButton, SendQuoteForm } from "./QuotesClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * QUOTE REQUESTS. Robert's addendum of 2026-10-25, item 3: "The office prices a
 * quote request and sends it ... Quote list screen, quote email, expiry."
 * quotes.manage opens it, the office and the owner. The list and its CSV read
 * the same rows through quoteListRows, so the two cannot disagree.
 */
export default async function QuotesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "quotes.manage")) notFound();
  const params = await searchParams;
  const now = Date.now();

  if (params.id) return <QuoteDetail id={params.id} now={now} back={listHref("/portal/quotes", { ...params, id: undefined }, {})} />;

  const read = await listQuotes(actor);
  const status = params.status ?? "open";
  const query = { q: params.q, status, sort: params.sort, dir: params.dir };
  const rows = read.ok ? quoteListRows(read.rows, query) : [];
  const page = Math.max(1, Number(params.page) || 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const csvQuery = new URLSearchParams(
    Object.entries(query).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();

  const columns: Column<QuoteRow>[] = [
    {
      key: "reference",
      header: "Reference",
      cell: (r) => (
        <Link href={listHref("/portal/quotes", params, { id: r.id })} className="font-semibold text-[var(--navy)] underline">
          {r.reference}
        </Link>
      ),
    },
    { key: "asked", header: "Asked", cell: (r) => formatInFirmZone(r.createdAt) ?? "" },
    { key: "customer", header: "Customer", cell: (r) => r.customerCompany ? `${r.customerName}, ${r.customerCompany}` : r.customerName },
    { key: "phone", header: "Phone", desktopOnly: true, cell: (r) => <PhoneLink phone={r.customerPhone} /> },
    { key: "what", header: "Asked for", cell: (r) => catalogFor(r.serviceSlug, r.tier ?? undefined)?.name ?? r.serviceSlug },
    { key: "status", header: "Status", cell: (r) => shownStatus(r, now, QUOTE_STATUS_LABEL) },
    { key: "price", header: "Quoted", numeric: true, cell: (r) => (r.quotedCents === null ? "Not priced" : money(r.quotedCents)) },
    { key: "expires", header: "Holds until", desktopOnly: true, cell: (r) => (r.expiresAt ? formatInFirmZone(r.expiresAt) ?? "" : "") },
  ];

  return (
    <>
      <PageHead
        eyebrow="Customers"
        title="Quotes"
        lede="Requests for work the firm quotes rather than prices online. Open one to price it and send it; the customer accepts and pays from the link in the email."
      />
      <ListControls
        action="/portal/quotes"
        search={params.q ?? ""}
        searchLabel="Search reference, customer, email, phone or address"
        filters={[
          {
            name: "status",
            label: "Show",
            value: status,
            options: [
              { value: "open", label: "Waiting on the firm or the customer" },
              ...QUOTE_STATUSES.map((s) => ({ value: s, label: QUOTE_STATUS_LABEL[s] })),
              { value: "all", label: "Everything" },
            ],
          },
        ]}
        sorts={[...QUOTE_SORTS]}
        sort={params.sort ?? "asked"}
        direction={params.dir === "asc" ? "asc" : "desc"}
        csvHref={`/api/portal/quotes/export?${csvQuery}`}
      />
      {!read.ok ? (
        <ErrorState title="Quote requests could not be read" body={`${read.error} Nothing here means nothing is waiting.`} />
      ) : (
        <>
          <DataTable
            caption="Quote requests"
            rows={shown}
            total={rows.length}
            columns={columns}
            empty={
              <EmptyState
                title={status === "open" ? "No quote is waiting" : "Nothing matches"}
                body="A quote request arrives when a customer asks for a quoted deliverable from the order page. It appears here until it is accepted, declined or lapses."
              />
            }
          />
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={(n) => listHref("/portal/quotes", params, { page: String(n) })} />
        </>
      )}
    </>
  );
}

async function QuoteDetail({ id, now, back }: { id: string; now: number; back: string }) {
  const actor = await currentActor();
  const read = await getQuote(actor, id);
  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Quotes" title="Quote request" />
        <ErrorState title="This quote request could not be opened" body={`${read.error} Go back to the list and open it again.`} />
        <p className="mt-4 text-[14px]"><Link href={back} className="font-semibold text-[var(--navy)] underline">Back to quotes</Link></p>
      </>
    );
  }
  const { quote, files } = read;
  const entry = catalogFor(quote.serviceSlug, quote.tier ?? undefined);
  /* A sent quote is not re-priced while the customer may still accept it; it is declined, or it lapses and is priced again. */
  const sendable = ["new", "scoping", "expired"].includes(quote.status);
  const declinable = ["new", "scoping", "sent"].includes(quote.status);
  const rows: [string, ReactNode][] = [
    ["Reference", quote.reference],
    ["Asked", formatInFirmZone(quote.createdAt) ?? ""],
    ["Asked for", entry?.name ?? quote.serviceSlug],
    ["Customer", quote.customerCompany ? `${quote.customerName}, ${quote.customerCompany}` : quote.customerName],
    ["Email", <a key="e" href={`mailto:${quote.customerEmail}`} className="font-semibold text-[var(--navy)] underline">{quote.customerEmail}</a>],
    ["Phone", quote.customerPhone ? <PhoneLink key="p" phone={quote.customerPhone} /> : "Not given"],
    ["Property", [quote.propertyAddress, quote.city, quote.county ? `${quote.county} County` : null].filter(Boolean).join(", ") || "Not given"],
    ["Needed by", quote.neededBy ?? "Not given"],
    ["Status", shownStatus(quote, now, QUOTE_STATUS_LABEL)],
    ["Quoted", quote.quotedCents === null ? "Not priced" : money(quote.quotedCents)],
    ["Sent", quote.sentAt ? formatInFirmZone(quote.sentAt) ?? "" : "Not sent"],
    ["Holds until", quote.expiresAt ? formatInFirmZone(quote.expiresAt) ?? "" : "Not sent"],
  ];
  if (quote.declineReason) rows.push(["Declined because", quote.declineReason]);
  if (quote.convertedOrderId) {
    rows.push(["Order", <Link key="o" href={`/portal/order-lookup/${quote.convertedOrderId}`} className="font-semibold text-[var(--navy)] underline">Open the order</Link>]);
  }

  return (
    <>
      <PageHead eyebrow="Quotes" title={`Quote request ${quote.reference}`} lede={entry?.name} />
      <p className="mb-4 text-[14px] print:hidden"><Link href={back} className="font-semibold text-[var(--navy)] underline">Back to quotes</Link></p>
      <Panel title="The request">
        <dl className="divide-y divide-[var(--border)]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-3">
              <dt className="text-[14px] font-semibold text-[var(--ink)]">{k}</dt>
              <dd className="text-[14px] leading-[1.5] text-[var(--secondary)]">{v}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-5 text-[15px] font-semibold text-[var(--ink)]">What they told the firm</h2>
        <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.6] text-[var(--ink)]">{quote.brief || "Nothing was written."}</p>
        {quote.scope ? (
          <>
            <h2 className="mt-5 text-[15px] font-semibold text-[var(--ink)]">The scope the price covers</h2>
            <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.6] text-[var(--ink)]">{quote.scope}</p>
          </>
        ) : null}
      </Panel>
      <Panel className="mt-6" title="Attached files">
        {files.length === 0 ? (
          <p className="text-[14px] text-[var(--secondary)]">The customer attached no files to this request.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={f.id} className="text-[14px]">
                <a href={`/api/portal/quotes?file=${f.id}`} className="font-semibold text-[var(--navy)] underline">
                  {`File ${i + 1}, ${f.inputKey}`}
                </a>
                <span className="text-[var(--secondary)]">{`, ${f.contentType ?? "type not recorded"}${f.byteSize ? `, ${Math.ceil(f.byteSize / 1024)} KB` : ""}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {sendable ? (
        <Panel className="mt-6 print:hidden" title={quote.status === "expired" ? "Price it again and send" : "Price it and send"}>
          <SendQuoteForm
            id={quote.id}
            reference={quote.reference}
            scope={quote.scope ?? ""}
            propertyAddress={quote.propertyAddress ?? ""}
            county={quote.county ?? ""}
            defaultDays={QUOTE_HOLD_DAYS.default}
          />
        </Panel>
      ) : null}
      {quote.status === "sent" && !hasLapsed(quote, now) ? (
        <Panel className="mt-6 print:hidden" title="Send the email again">
          <ResendQuoteButton id={quote.id} reference={quote.reference} />
        </Panel>
      ) : null}
      {declinable ? (
        <Panel className="mt-6 print:hidden" title="Decline it">
          <DeclineQuoteForm id={quote.id} reference={quote.reference} />
        </Panel>
      ) : null}
    </>
  );
}
