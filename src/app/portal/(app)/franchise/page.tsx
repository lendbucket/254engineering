import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, type Column } from "@/components/portal/design";
import { Pager, listHref } from "@/components/portal/ListControls";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { RetryButton } from "@/components/portal/Unreachable";
import { STAGE_LABEL, type CrmStage } from "@/lib/crm-rules";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { FRANCHISEE_STATUS_LABEL } from "@/lib/franchisee-rules";
import { currentActor } from "@/lib/ops-auth";
import { can, roleLabel } from "@/lib/ops-authz";
import { moneyOr } from "@/lib/ops-money";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/ops-orders";
import { ownFranchise, type OwnFranchise } from "@/lib/own-franchise";
import type { MonthRevenue } from "@/lib/own-franchise-rules";

/**
 * YOUR FRANCHISE (0127). Robert's overnight orders of 2026-11-10, platform
 * item X2: a franchisee's owner sees its territory's prospects, orders,
 * technicians, reps, academy progress and its own revenue, and nothing else.
 * Read only.
 *
 * THE SCOPE IS NOT IN THE ADDRESS. The franchise is the signed in person's own
 * membership, read in src/lib/own-franchise.ts, which takes no id. The address
 * carries two page numbers and nothing else, `op` for the orders and `pp` for
 * the sales list, each parsed as a whole number; neither can widen what is read.
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;


const when = (value: string) => formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? value;
const pageOf = (raw: string | undefined) => Math.max(1, Number.parseInt(raw ?? "1", 10) || 1);
const monthName = (month: string) => formatInFirmZone(`${month}-15T12:00:00Z`, { month: "long", year: "numeric" }) ?? month;

type Person = OwnFranchise["people"][number];
type Territory = OwnFranchise["territories"][number];
type Prospect = OwnFranchise["prospects"][number];
type Order = OwnFranchise["orders"][number];
type Month = MonthRevenue & { id: string };

const academyLine = (p: Person) => {
  if (!p.academy) return "Not started";
  if (p.academy.graduated) return "Graduated";
  const passed = p.academy.courses.reduce((n, c) => n + c.lessonsPassed, 0);
  const total = p.academy.courses.reduce((n, c) => n + c.lessonsTotal, 0);
  return `${passed} of ${total} lessons passed`;
};

const PEOPLE: Column<Person>[] = [
  { key: "name", header: "Name", cell: (p) => <span className="font-semibold text-[var(--navy)]">{p.name}</span> },
  { key: "role", header: "Role", cell: (p) => roleLabel(p.role) },
  { key: "academy", header: "Academy", cell: academyLine },
];

const TERRITORIES: Column<Territory>[] = [{ key: "name", header: "Territory", cell: (t) => t.name }];

const MONTHS: Column<Month>[] = [
  { key: "month", header: "Month", cell: (m) => monthName(m.month) },
  { key: "orders", header: "Orders", numeric: true, cell: (m) => String(m.orders) },
  {
    key: "revenue",
    header: "Revenue",
    numeric: true,
    cell: (m) => moneyOr(m.revenueCents, "Not known: an order this month carries no total"),
  },
];

const ORDERS: Column<Order>[] = [
  { key: "reference", header: "Order", cell: (o) => <span className="font-semibold text-[var(--navy)]">{o.reference}</span> },
  { key: "county", header: "County", cell: (o) => o.county },
  { key: "status", header: "Status", cell: (o) => ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status },
  { key: "day", header: "Placed", cell: (o) => when(`${o.day}T12:00:00Z`) },
];

const PROSPECTS: Column<Prospect>[] = [
  { key: "company", header: "Company", cell: (p) => <span className="font-semibold text-[var(--navy)]">{p.company}</span> },
  { key: "county", header: "County", cell: (p) => p.county },
  { key: "stage", header: "Stage", cell: (p) => STAGE_LABEL[p.stage as CrmStage] ?? p.stage },
];

export default async function YourFranchisePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const actor = await currentActor();
  if (!can(actor, "franchise.read_own")) notFound();
  const params = await searchParams;
  const op = pageOf(params.op);
  const pp = pageOf(params.pp);
  const read = await ownFranchise(actor);

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Franchise" title="Your franchise" lede="Your franchise could not be shown." />
        <div role="alert" data-list-not-loaded className="py-6">
          <p className="text-[15px] font-semibold text-[var(--ink)]">{read.error}</p>
          <div className="mt-4 flex">
            <RetryButton />
          </div>
        </div>
      </>
    );
  }

  if (!read.franchise) {
    const keeper = can(actor, "franchise.manage");
    return (
      <>
        <PageHead eyebrow="Franchise" title="Your franchise" lede="A franchisee's owner reads their own franchise here." />
        <EmptyState
          title="This account does not belong to a franchisee"
          body={
            keeper
              ? "Your account keeps the firm's record of every franchisee instead. Open Franchisees to add an owner to one."
              : "An administrator adds an owner to their franchise on the franchisee record. Ask one to add you."
          }
        />
        {keeper ? (
          <p className="mt-4">
            <Link href="/portal/franchisees" className="text-[14px] font-semibold text-[var(--navy)] underline">Open Franchisees</Link>
          </p>
        ) : null}
      </>
    );
  }

  const f = read.franchise;
  const base = { op: String(op), pp: String(pp) };
  const orders = f.orders.slice((op - 1) * PAGE_SIZE, op * PAGE_SIZE);
  const prospects = f.prospects.slice((pp - 1) * PAGE_SIZE, pp * PAGE_SIZE);
  const months: Month[] = f.revenue.map((m) => ({ ...m, id: m.month }));
  const countyLine = f.counties.length ? `${f.counties.length} ${f.counties.length === 1 ? "county" : "counties"}: ${f.counties.join(", ")}.` : "No county is in your territories yet.";

  return (
    <>
      <PageHead
        eyebrow="Franchise"
        title={f.legalName}
        lede={`Your franchise, as the firm records it. You have belonged to it since ${when(f.since)}. Read only: to change anything here, ask an administrator.`}
      />
      {/* The status, with the four steps the record shows under it, read only (Robert, 2026-11-12). */}
      <Panel
        title={FRANCHISEE_STATUS_LABEL[f.status]}
        className="mb-4"
        description="The four steps a franchisee meets before it starts operating, as the firm's record shows them. An administrator records each one."
      >
        <ul className="flex flex-col gap-2">
          {f.onboarding.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-2 text-[14px] text-[var(--ink)]">
              <Chip label={s.met ? "Met" : "Not yet"} tone={s.met ? "good" : "warn"} />
              <span className="font-semibold">{s.label}.</span>
              <span className="text-[var(--secondary)]">{s.says}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-4">
          <Panel
            title="Revenue in your territories"
            description="Paid orders in your territories' counties, net of refunds, by calendar month. A month with an order that carries no total says so rather than showing a figure."
          >
            <DataTable
              caption="Revenue in your territories by month"
              columns={MONTHS}
              rows={months}
              total={months.length}
              empty={<EmptyState title="No paid order in your territories yet" body="Revenue appears here by month once an order in one of your counties is paid." />}
            />
          </Panel>
          <Panel title="Orders in your territories" description={`Every order placed for a property in your counties, newest first. ${f.orders.length} in all.`}>
            <DataTable
              caption="Orders in your territories"
              columns={ORDERS}
              rows={orders}
              total={f.orders.length}
              empty={<EmptyState title="No order in your territories yet" body="Orders for properties in your counties appear here as they are placed." />}
            />
            {f.orders.length > PAGE_SIZE ? (
              <Pager page={op} pageSize={PAGE_SIZE} total={f.orders.length} hrefFor={(p) => listHref("/portal/franchise", base, { op: String(p) })} />
            ) : null}
          </Panel>
          <Panel title="Companies on the sales list in your territories" description={`Their name, county and stage. ${f.prospects.length} in all.`}>
            <DataTable
              caption="Sales list companies in your territories"
              columns={PROSPECTS}
              rows={prospects}
              total={f.prospects.length}
              empty={<EmptyState title="No company on the sales list in your territories" body="Companies in your counties appear here as they are added to the sales list." />}
            />
            {f.prospects.length > PAGE_SIZE ? (
              <Pager page={pp} pageSize={PAGE_SIZE} total={f.prospects.length} hrefFor={(p) => listHref("/portal/franchise", base, { pp: String(p) })} />
            ) : null}
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
          <Panel title="Territories it holds" description={countyLine}>
            <DataTable
              caption="Territories your franchise holds"
              columns={TERRITORIES}
              rows={f.territories}
              total={f.territories.length}
              empty={<EmptyState title="No territory is recorded yet" body="An administrator records the territories in your agreement. Ask one if you expected to see yours." />}
            />
          </Panel>
          <Panel title="Its people" description="Your technicians, reps and owners, and where each stands in the academy.">
            <DataTable
              caption="Your franchise's people"
              columns={PEOPLE}
              rows={f.people}
              total={f.people.length}
              empty={<EmptyState title="Nobody is recorded yet" body="An administrator adds your people to the franchisee record. Ask one to add them." />}
            />
          </Panel>
          <Panel title="Office" description="Your office's name, address and phone, as recorded.">
            {f.office.street ? (
              <p className="text-[14px] text-[var(--ink)]">
                {f.office.street}, {f.office.city} {f.office.postalCode}
              </p>
            ) : (
              <p className="text-[14px] text-[var(--secondary)]">No office is recorded yet. Ask an administrator to add it.</p>
            )}
            {f.office.phone ? (
              <p className="mt-2 text-[14px]">
                Dial <PhoneLink phone={f.office.phone} />
              </p>
            ) : null}
          </Panel>
        </div>
      </div>
    </>
  );
}
