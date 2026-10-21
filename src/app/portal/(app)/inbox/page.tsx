import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { inbox, type InboxItem, type InboxKind } from "@/lib/ops-inbox";
import { telLink } from "@/lib/phone-link";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { DataTable, type Column } from "@/components/portal/design";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { ListControls, Pager, listHref } from "@/components/portal/ListControls";
import { ActionButton } from "@/components/portal/staff-kit";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<InboxKind, string> = {
  contact: "Contact form",
  waitlist: "Waitlist",
  design: "Design inquiry",
  windstorm: "Windstorm inquiry",
};

const PAGE_SIZE = 50;

/**
 * THE ONE INBOX. inbox.read, 2026-10-20. Contact and waitlist submissions,
 * design inquiries and windstorm inquiries, unanswered first, the promise that
 * runs out soonest at the top.
 */
export default async function InboxPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!actor || !can(actor, "inbox.read")) notFound();
  const params = await searchParams;
  const showAnswered = params.answered === "all";
  const read = await inbox(actor, { includeAnswered: showAnswered });

  const kind = (params.kind ?? "all") as InboxKind | "all";
  const needle = (params.q ?? "").trim().toLowerCase();
  const filtered = read.ok
    ? read.items.filter(
        (i) =>
          (kind === "all" || i.kind === kind) &&
          (!needle || [i.name, i.email, i.phone, i.summary].some((v) => (v ?? "").toLowerCase().includes(needle))),
      )
    : [];
  const sort = params.sort ?? "due";
  const dir = params.dir === "desc" ? -1 : 1;
  if (sort === "received") filtered.sort((a, b) => (a.receivedAt < b.receivedAt ? -dir : dir));
  else if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name) * dir);
  else if (dir === -1) filtered.reverse();
  const page = Math.max(1, Number(params.page) || 1);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canAnswer = can(actor, "inbox.answer");

  const columns: Column<InboxItem>[] = [
    { key: "who", header: "From", cell: (i) => <Link href={i.href} className="font-semibold text-[var(--navy)] underline">{i.name}</Link> },
    { key: "kind", header: "What", cell: (i) => KIND_LABEL[i.kind] },
    { key: "received", header: "Received", cell: (i) => formatInFirmZone(i.receivedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) },
    {
      key: "due",
      header: "Answer by",
      cell: (i) => (i.answered ? "Answered" : i.respondBy ? formatInFirmZone(i.respondBy, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "No promise recorded"),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (i) => {
        const href = telLink(i.phone);
        return href ? <a href={href} className="font-semibold text-[var(--navy)] underline">{i.phone}</a> : i.phone ?? "";
      },
    },
    { key: "email", header: "Email", cell: (i) => (i.email ? <a href={`mailto:${i.email}`} className="text-[var(--navy)] underline">{i.email}</a> : ""), desktopOnly: true },
    { key: "summary", header: "About", cell: (i) => i.summary, desktopOnly: true },
    {
      key: "act",
      header: "Answer",
      cell: (i) =>
        i.answered ? (
          "Done"
        ) : (i.kind === "contact" || i.kind === "waitlist") && canAnswer ? (
          <ActionButton url="/api/portal/desk" payload={{ action: "lead_contacted", leadId: i.id }} done="Marked contacted.">
            Mark contacted
          </ActionButton>
        ) : (
          <Link href={i.href} className="font-semibold text-[var(--navy)] underline">Open to answer</Link>
        ),
    },
  ];

  return (
    <>
      <PageHead
        eyebrow="Customers"
        title="Inbox"
        lede="Everything that came in from the sites and has not been answered, the promise that runs out soonest first."
      />
      <ListControls
        action="/portal/inbox"
        search={params.q ?? ""}
        searchLabel="Search name, email, phone or what they asked"
        filters={[
          { name: "kind", label: "What", value: kind, options: [{ value: "all", label: "Everything" }, ...(Object.keys(KIND_LABEL) as InboxKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))] },
          { name: "answered", label: "Show", value: showAnswered ? "all" : "open", options: [{ value: "open", label: "Waiting for an answer" }, { value: "all", label: "Answered too" }] },
        ]}
        sorts={[{ value: "due", label: "Answer by" }, { value: "received", label: "Received" }, { value: "name", label: "Name" }]}
        sort={sort}
        direction={dir === -1 ? "desc" : "asc"}
      />
      {!read.ok ? (
        <ErrorState title="The inbox could not be read" body={`${read.error} Nothing here means nobody is waiting.`} />
      ) : (
        <>
          {read.failed.length ? (
            <Panel title="Part of the inbox could not be read" description="What is listed below is real; what failed is missing from it, not empty.">
              <ul className="text-[14px] leading-[1.55] text-[var(--ink)]">{read.failed.map((f) => <li key={f}>{f}</li>)}</ul>
            </Panel>
          ) : null}
          <DataTable
            caption="Inbox"
            rows={shown.map((i) => ({ ...i, id: `${i.kind}:${i.id}` }))}
            total={filtered.length}
            columns={columns}
            empty={
              <EmptyState
                title={needle || kind !== "all" ? "Nothing matches that filter" : "Nobody is waiting for an answer"}
                body={needle || kind !== "all" ? "Clear the filter to see everything." : "New contact, waitlist, design and windstorm submissions appear here as they arrive, without reloading the page."}
              />
            }
          />
          <Pager page={page} pageSize={PAGE_SIZE} total={filtered.length} hrefFor={(n) => listHref("/portal/inbox", params, { page: String(n) })} />
        </>
      )}
      <Panel className="mt-8" title="Customer email replies" description="When a customer replies to an email from the firm, the reply goes to the firm's support mailbox. This platform has no route that receives email, so replies are read there and are not in this list.">
        <p className="text-[14px] text-[var(--secondary)]">Log anything a reply changes against the order or the customer, so the next person sees it.</p>
      </Panel>
    </>
  );
}
