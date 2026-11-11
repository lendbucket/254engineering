import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable, type Column } from "@/components/portal/design";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { RetryButton } from "@/components/portal/Unreachable";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { FRANCHISEE_STATUS_LABEL, type FranchiseeStatus } from "@/lib/franchisee-rules";
import { currentActor } from "@/lib/ops-auth";
import { can, roleLabel } from "@/lib/ops-authz";
import { ownFranchise, type OwnFranchise } from "@/lib/own-franchise";

/**
 * YOUR FRANCHISE (0127). Robert's overnight orders of 2026-11-10, platform
 * item X2: a franchisee's owner reads their own franchise, its office, the
 * territories it holds and its people, and nothing else. Read only. The scope
 * is the signed in person's own membership, read in src/lib/own-franchise.ts;
 * nothing in the address can widen it.
 */

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<FranchiseeStatus, "warn" | "good" | "neutral"> = {
  onboarding: "warn",
  operating: "good",
  ended: "neutral",
};

const when = (value: string) => formatInFirmZone(value, { month: "short", day: "numeric", year: "numeric" }) ?? value;

type Person = OwnFranchise["people"][number];
type Territory = OwnFranchise["territories"][number];

const PEOPLE: Column<Person>[] = [
  { key: "name", header: "Name", cell: (p) => <span className="font-semibold text-[var(--navy)]">{p.name}</span> },
  { key: "role", header: "Role", cell: (p) => roleLabel(p.role) },
];

const TERRITORIES: Column<Territory>[] = [{ key: "name", header: "Territory", cell: (t) => t.name }];

export default async function YourFranchisePage() {
  const actor = await currentActor();
  if (!can(actor, "franchise.read_own")) notFound();
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
  return (
    <>
      <PageHead
        eyebrow="Franchise"
        title={f.legalName}
        lede={`Your franchise, as the firm records it. You have belonged to it since ${when(f.since)}. To change anything here, ask an administrator.`}
      />
      <p className="mb-4">
        <Chip label={FRANCHISEE_STATUS_LABEL[f.status]} tone={STATUS_TONE[f.status]} />
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-4">
          <Panel title="Territories it holds" description="The sales territories recorded for your franchise. A territory is held by one franchisee at a time.">
            <DataTable
              caption="Territories your franchise holds"
              columns={TERRITORIES}
              rows={f.territories}
              total={f.territories.length}
              empty={<EmptyState title="No territory is recorded yet" body="An administrator records the territories in your agreement. Ask one if you expected to see yours." />}
            />
          </Panel>
          <Panel title="Its people" description="The technicians, reps and owners recorded for your franchise.">
            <DataTable
              caption="Your franchise's people"
              columns={PEOPLE}
              rows={f.people}
              total={f.people.length}
              empty={<EmptyState title="Nobody is recorded yet" body="An administrator adds your people to the franchisee record. Ask one to add them." />}
            />
          </Panel>
        </div>
        <div className="flex flex-col gap-4">
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
