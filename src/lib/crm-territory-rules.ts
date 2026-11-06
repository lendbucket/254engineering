import { regions } from "@/content/regions";
import { territoryFor } from "./crm-rules";

/**
 * TERRITORIES, AS RULES. Robert's sales CRM ruling of 2026-11-02, item R5:
 * "Territories by county grouped into regions; a rep holds one or more; new
 * imports assign round robin within the territory; ops_manager and admin
 * reassign singly or in bulk; a rep sees only their own and unassigned in their
 * territory, managers see all." Migration 0116.
 *
 * Client safe and free of the database: the territory screen, the import's
 * round robin, the visibility rule and the proof read these. The region is
 * never stored: a territory is counties, and the region a county sits in comes
 * from the coverage map (src/content/regions.ts), the same place territoryFor
 * reads.
 */

/** The canonical name of a Texas county, or why it is not one. */
export function canonicalCounty(county: string): { ok: true; county: string } | { ok: false; error: string } {
  const place = territoryFor(county);
  if (!place) return { ok: false, error: `${county.trim() || "That"} is not one of the 254 Texas counties.` };
  return { ok: true, county: place.county };
}

export function territoryNameProblem(name: string): string | null {
  const n = name.trim();
  if (!n) return "Name the territory.";
  if (n.length > 80) return "A territory name is at most 80 characters.";
  return null;
}

/** The coverage map's regions with their counties, for the territory screen's county picker. */
export function countiesByRegion(): { slug: string; name: string; counties: string[] }[] {
  return regions.map((r) => ({ slug: r.slug, name: r.name, counties: [...r.counties].sort((a, b) => a.localeCompare(b)) }));
}

/**
 * Which counties a territory may take: every county named must be a Texas
 * county, named once, and in no OTHER territory. `held` maps each county
 * already placed (canonical name) to the territory that holds it.
 */
export function countiesProblem(
  territoryId: string | null,
  wanted: readonly string[],
  held: ReadonlyMap<string, { territoryId: string; territoryName: string }>,
): { ok: true; counties: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  for (const raw of wanted) {
    const c = canonicalCounty(raw);
    if (!c.ok) return c;
    if (out.includes(c.county)) continue;
    const owner = held.get(c.county);
    if (owner && owner.territoryId !== territoryId) {
      return { ok: false, error: `${c.county} County is already in ${owner.territoryName}. A county is in one territory; take it out of ${owner.territoryName} first.` };
    }
    out.push(c.county);
  }
  return { ok: true, counties: out.sort((a, b) => a.localeCompare(b)) };
}

/**
 * THE ROUND ROBIN. Each new company whose county is in a territory goes to the
 * next holder of that territory: the holder at (cursor mod holders), holders in
 * a fixed order (by id, so the order does not shift with a name change), and the
 * cursor moves on one per company. A territory whose holders are all suspended
 * or gone, or a company in no territory, stays unassigned for a manager.
 *
 * `holders` lists only ACTIVE holders: a suspended rep is skipped, never handed
 * a company they cannot work.
 */
export function planRoundRobin(
  companies: readonly { id: string; county: string | null }[],
  territoryOfCounty: ReadonlyMap<string, string>,
  holders: ReadonlyMap<string, readonly string[]>,
  cursors: ReadonlyMap<string, number>,
): { owners: Map<string, string | null>; cursors: Map<string, number> } {
  const next = new Map<string, number>(cursors);
  const owners = new Map<string, string | null>();
  for (const c of companies) {
    const place = territoryFor(c.county);
    const territory = place ? territoryOfCounty.get(place.county) ?? null : null;
    const people = territory ? [...(holders.get(territory) ?? [])].sort() : [];
    if (!territory || people.length === 0) {
      owners.set(c.id, null);
      continue;
    }
    const at = next.get(territory) ?? 0;
    owners.set(c.id, people[at % people.length]);
    next.set(territory, at + 1);
  }
  return { owners, cursors: next };
}
