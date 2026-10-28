import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { isOpen } from "@/lib/launch";
import { listBillableJobs } from "@/lib/ops-bill-list";
import { BILL_INTENT_LABEL, BILL_SORTS, billChoices, billListRows, type BillRow } from "@/lib/billing-rules";
import { PAYMENT_INTENTS } from "@/lib/job-intake-rules";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { money } from "@/lib/ops-money";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { catalogFor } from "@data/catalog";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { BillButton } from "./PaymentLinksClient";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * PAYMENT LINKS AND INVOICES. Robert's W2 ruling of 2026-10-27: "The first W2
 * screen is sending a payment link and an account invoice. Today only code can
 * send them" (docs/workflows.md, 254-WF-008 step 4). The owner or the
 * administrator, on payments.charge. The buttons call the door that already
 * exists, /api/portal/files with send_payment_link or invoice_account, which
 * asks every question again and writes the audit rows; this screen adds none.
 */
export default async function PaymentLinksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "payments.charge")) notFound();
  const params = await searchParams;
  const prelaunch = !isOpen();
  const read = await listBillableJobs(actor);

  if (params.id) {
    const row = read.ok ? read.rows.find((r) => r.id === params.id) : undefined;
    return <BillDetail row={row} error={read.ok ? null : read.error} prelaunch={prelaunch} back={listHref("/portal/payment-links", { ...params, id: undefined }, {})} />;
  }

  const show = params.show ?? "waiting";
  const query = { q: params.q, show, sort: params.sort, dir: params.dir };
  const rows = read.ok ? billListRows(read.rows, query) : [];
  const page = Math.max(1, Number(params.page) || 1);
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const csvQuery = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1]))).toString();

  const columns: Column<BillRow>[] = [
    {
      key: "file",
      header: "File",
      cell: (r) => (
        <Link href={listHref("/portal/payment-links", params, { id: r.id })} className="font-semibold text-[var(--navy)] underline">
          {r.fileNumber}
        </Link>
      ),
    },
    { key: "opened", header: "Opened", cell: (r) => formatInFirmZone(r.createdAt) ?? "" },
    { key: "client", header: "Client", cell: (r) => r.clientName },
    { key: "phone", header: "Phone", desktopOnly: true, cell: (r) => <PhoneLink phone={r.clientPhone} /> },
    { key: "what", header: "Work", cell: (r) => catalogFor(r.serviceSlug, r.deliverable ?? undefined)?.name ?? r.serviceSlug },
    { key: "billed", header: "Billing", cell: (r) => BILL_INTENT_LABEL[r.paymentIntent] },
    { key: "price", header: "Price", numeric: true, cell: (r) => (r.priceCents === null ? "No price" : money(r.priceCents)) },
  ];

  return (
    <>
      <PageHead
        eyebrow="Money"
        title="Payment links and invoices"
        lede={
          prelaunch
            ? "Jobs not yet paid. While the firm is not yet accepting engagements, no link or invoice can be sent, and each job says so."
            : "Jobs not yet paid. Open one to send the customer a payment link, or to invoice a client whose account is on invoice terms."
        }
      />
      <ListControls
        action="/portal/payment-links"
        search={params.q ?? ""}
        searchLabel="Search file number, client, email, phone or address"
        filters={[
          {
            name: "show",
            label: "Show",
            value: show,
            options: [
              { value: "waiting", label: "Waiting on money" },
              ...PAYMENT_INTENTS.filter((i) => i !== "paid").map((i) => ({ value: i, label: BILL_INTENT_LABEL[i] })),
              { value: "all", label: "Every job not paid" },
            ],
          },
        ]}
        sorts={[...BILL_SORTS]}
        sort={params.sort ?? "opened"}
        direction={params.dir === "asc" ? "asc" : "desc"}
        csvHref={`/api/portal/payment-links/export?${csvQuery}`}
      />
      {!read.ok ? (
        <ErrorState title="The jobs could not be read" body={`${read.error} Nothing here means nothing is waiting.`} />
      ) : (
        <>
          <DataTable
            caption="Jobs not yet paid"
            rows={shown}
            total={rows.length}
            columns={columns}
            empty={
              <EmptyState
                title={show === "waiting" ? "No job is waiting on money" : "Nothing matches"}
                body="A job appears here from the moment it is taken until it is paid. Take a job over the telephone from New job, or change the filter to see jobs already billed."
              />
            }
          />
          <Pager page={page} pageSize={PAGE_SIZE} total={rows.length} hrefFor={(n) => listHref("/portal/payment-links", params, { page: String(n) })} />
        </>
      )}
    </>
  );
}

function BillDetail({ row, error, prelaunch, back }: { row: BillRow | undefined; error: string | null; prelaunch: boolean; back: string }) {
  const backLink = (
    <p className="mb-4 text-[14px] print:hidden">
      <Link href={back} className="font-semibold text-[var(--navy)] underline">Back to payment links</Link>
    </p>
  );
  if (!row) {
    return (
      <>
        <PageHead eyebrow="Payment links" title="Job" />
        {backLink}
        <ErrorState
          title="This job could not be opened here"
          body={error ? `${error} Go back to the list and open it again.` : "It is paid, it is a demonstration file, or it does not exist. Go back to the list and open it again."}
        />
      </>
    );
  }
  const entry = catalogFor(row.serviceSlug, row.deliverable ?? undefined);
  const facts: [string, ReactNode][] = [
    ["File", <Link key="f" href={`/portal/files?id=${row.id}`} className="font-semibold text-[var(--navy)] underline">{row.fileNumber}</Link>],
    ["Opened", formatInFirmZone(row.createdAt) ?? ""],
    ["Work", entry?.name ?? row.serviceSlug],
    ["Status", STATUS_LABEL[row.status as FileStatus] ?? row.status],
    ["Client", row.clientName],
    ["Email", row.clientEmail ? <a key="e" href={`mailto:${row.clientEmail}`} className="font-semibold text-[var(--navy)] underline">{row.clientEmail}</a> : "Not on record"],
    ["Phone", row.clientPhone ? <PhoneLink key="p" phone={row.clientPhone} /> : "Not on record"],
    ["Property", [row.propertyAddress, row.county ? `${row.county} County` : null].filter(Boolean).join(", ")],
    ["Price", row.priceCents === null ? "No price" : money(row.priceCents)],
    ["Billing", BILL_INTENT_LABEL[row.paymentIntent]],
    ["Account terms", row.accountCanInvoice ? "An active account on invoice terms" : "No account on invoice terms"],
  ];
  if (row.paymentNote) facts.push(["Note", row.paymentNote]);

  return (
    <>
      <PageHead eyebrow="Payment links" title={`Bill ${row.fileNumber}`} lede={entry?.name} />
      {backLink}
      <Panel title="The job">
        <dl className="divide-y divide-[var(--border)]">
          {facts.map(([k, v]) => (
            <div key={k} className="grid gap-1 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-3">
              <dt className="text-[14px] font-semibold text-[var(--ink)]">{k}</dt>
              <dd className="text-[14px] leading-[1.5] text-[var(--secondary)]">{v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <Panel className="mt-6 print:hidden" title="Get paid for it">
        <ul className="flex flex-col gap-5">
          {billChoices(row, prelaunch).map((choice) => (
            <li key={choice.intent} className="border-t border-[var(--border)] pt-4 first:border-t-0 first:pt-0">
              <BillButton
                fileId={row.id}
                fileNumber={row.fileNumber}
                action={choice.intent === "link_sent" ? "send_payment_link" : "invoice_account"}
                label={choice.label}
                available={choice.available}
                because={choice.because ?? null}
                amount={row.priceCents === null ? null : money(row.priceCents)}
                email={row.clientEmail}
              />
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
