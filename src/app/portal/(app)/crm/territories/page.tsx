import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { territoriesView } from "@/lib/crm-territories";
import { countiesByRegion } from "@/lib/crm-territory-rules";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { CountyPicker, HolderControls, NewTerritoryForm, RenameTerritory } from "./TerritoriesClient";

export const dynamic = "force-dynamic";

/**
 * THE SALES TERRITORIES. crm.assign (admin and ops_manager), Robert's sales CRM
 * ruling of 2026-11-02, item R5: "Territories by county grouped into regions; a
 * rep holds one or more; new imports assign round robin within the territory."
 *
 * Each territory shows its counties (chosen by region from the coverage map),
 * who holds it, and how many companies sit in it and how many nobody owns. The
 * county picker shows every region with its counties; a county already in
 * another territory says which and cannot be ticked here.
 */
export default async function TerritoriesPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "crm.assign")) notFound();
  const read = await territoriesView(actor);

  return (
    <>
      <PageHead
        eyebrow="Sales"
        title="Territories"
        lede="Counties grouped into territories. A rep sees their own companies and the unassigned ones in the territories they hold; new imports go to the next rep in the territory, in turn."
      />
      <nav aria-label="Sales" className="mb-6 flex flex-wrap gap-x-6 print:hidden">
        <Link href="/portal/crm" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">The pipeline</Link>
        <Link href="/portal/crm/list" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">The list, to reassign in bulk</Link>
      </nav>

      {!read.ok ? (
        <ErrorState title="The territories could not be read" body={`${read.error} This is a failed read, not an empty list. Nothing was changed.`} />
      ) : (
        <div className="grid gap-8">
          <Panel title="A new territory" description="Name it, then choose its counties and who holds it.">
            <NewTerritoryForm />
          </Panel>

          {read.unplacedUnassigned > 0 ? (
            <p className="text-[14px] text-[var(--ink)]">
              {read.unplacedUnassigned.toLocaleString("en-US")} unassigned {read.unplacedUnassigned === 1 ? "company is" : "companies are"} in no territory, so no rep sees {read.unplacedUnassigned === 1 ? "it" : "them"} yet.{" "}
              <Link href="/portal/crm/list?owner=unowned" className="font-semibold text-[var(--navy)] underline">Open them in the list</Link> to assign them, or add their counties to a territory.
            </p>
          ) : null}

          {read.territories.length === 0 ? (
            <EmptyState title="No territories yet" body="Create the first one above. Until a territory exists, every unassigned company is a manager's to place and no rep sees it." />
          ) : (
            read.territories.map((t) => {
              const others = new Map<string, string>();
              for (const o of read.territories) if (o.id !== t.id) for (const c of o.counties) others.set(c, o.name);
              return (
                <Panel
                  key={t.id}
                  title={t.name}
                  description={`${t.counties.length} ${t.counties.length === 1 ? "county" : "counties"}. ${t.companies.toLocaleString("en-US")} ${t.companies === 1 ? "company" : "companies"} in it, ${t.unassigned.toLocaleString("en-US")} unassigned. ${t.holders.length ? `Held by ${t.holders.map((h) => `${h.name}${h.active ? "" : " (suspended, skipped in turn)"}`).join(", ")}.` : "Nobody holds it, so its new imports stay unassigned."}`}
                >
                  <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="grid content-start gap-6">
                      <RenameTerritory territoryId={t.id} name={t.name} />
                      <HolderControls territoryId={t.id} holders={t.holders} people={read.people} />
                    </div>
                    <CountyPicker territoryId={t.id} chosen={t.counties} others={Object.fromEntries(others)} regions={countiesByRegion()} />
                  </div>
                </Panel>
              );
            })
          )}
        </div>
      )}
    </>
  );
}
