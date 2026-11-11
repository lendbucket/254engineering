import "server-only";
import { supabaseAdmin } from "./supabase";
import { can, type Actor } from "./ops-authz";
import { readEvery } from "./bounded-read";
import type { FranchiseeStatus, Office } from "./franchisee-rules";

/**
 * A FRANCHISEE OWNER SEES THEIR OWN FRANCHISE, AND NOTHING ELSE (0127).
 * Robert's overnight orders of 2026-11-10, platform item X2, the franchisee
 * owner role, cut from X1 under his answer 1 of 2026-11-11.
 *
 * The capability is franchise.read_own. The SCOPE is the person's own live
 * membership in eng_franchisee_members, read by their own profile id and by
 * nothing a caller can pass in: there is no id parameter on this function, so
 * no request can point it at somebody else's franchise.
 *
 * What it reads, and only this: the franchisee's legal name, status and office
 * NAP; the sales territories it holds now; and its people's names and roles.
 * No money of any kind, no other franchisee, no other territory, nothing about
 * sealing and no price. Those are the four exclusions X2 was proposed with
 * (docs/franchise/operations-manual.md section 8), and each is the ABSENCE of
 * a read here rather than a filter on one.
 *
 * Read only. An owner changes nothing; the administrator keeps the record on
 * /portal/franchisees under franchise.manage.
 */

export type OwnFranchise = {
  legalName: string;
  status: FranchiseeStatus;
  office: Office;
  since: string;
  territories: { id: string; name: string }[];
  people: { id: string; name: string; role: string }[];
};

export type OwnFranchiseRead =
  | { ok: true; franchise: OwnFranchise }
  /** Signed in with the capability, and not a live member of any franchisee. */
  | { ok: true; franchise: null }
  | { ok: false; error: string };

const refuse = (error: string) => ({ ok: false as const, error });

export async function ownFranchise(actor: Actor | null): Promise<OwnFranchiseRead> {
  if (!actor || !can(actor, "franchise.read_own")) return refuse("Only a franchisee's owner sees a franchise here.");
  const db = supabaseAdmin();
  if (!db) return refuse("The database is not configured, so your franchise could not be read.");

  const mine = await db
    .from("eng_franchisee_members")
    .select("franchisee_id, created_at")
    .eq("profile_id", actor.id)
    .is("ended_at", null)
    .limit(2);
  if (mine.error) return refuse(`Your membership could not be read: ${mine.error.message || "the database gave no reason"}.`);
  const rows = mine.data ?? [];
  if (rows.length === 0) return { ok: true, franchise: null };
  /* 0126's eng_franchisee_members_one_franchisee makes a second live row impossible; two would be a defect, said rather than guessed between. */
  if (rows.length > 1) return refuse("Your account belongs to more than one franchisee, which the record does not allow. Ask an administrator to look at it.");
  const franchiseeId = String(rows[0].franchisee_id);

  const f = await db
    .from("eng_franchisees")
    .select("legal_name, status, office_street, office_city, office_postal_code, office_phone")
    .eq("id", franchiseeId)
    .maybeSingle();
  if (f.error) return refuse(`Your franchise could not be read: ${f.error.message || "the database gave no reason"}.`);
  if (!f.data) return refuse("Your franchise is not on record. Ask an administrator to look at it.");

  const held = await readEvery<{ territory_id: string }>((from, to) =>
    db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("territory_id", { ascending: true }).range(from, to),
  );
  if (!held.ok) return refuse(`The territories your franchise holds could not be read: ${held.error}`);
  const territoryIds = held.rows.map((r) => String(r.territory_id));
  const names = territoryIds.length
    ? await readEvery<{ id: string; name: string }>((from, to) =>
        db.from("eng_crm_territories").select("id, name").in("id", territoryIds).order("id", { ascending: true }).range(from, to),
      )
    : ({ ok: true, rows: [] } as const);
  if (!names.ok) return refuse(`The names of your territories could not be read: ${names.error}`);

  const members = await readEvery<{ profile_id: string }>((from, to) =>
    db.from("eng_franchisee_members").select("profile_id").eq("franchisee_id", franchiseeId).is("ended_at", null).order("profile_id", { ascending: true }).range(from, to),
  );
  if (!members.ok) return refuse(`Your franchise's people could not be read: ${members.error}`);
  const memberIds = members.rows.map((r) => String(r.profile_id));
  const profiles = memberIds.length
    ? await readEvery<{ id: string; display_name: string | null; role: string }>((from, to) =>
        db.from("eng_profiles").select("id, display_name, role").in("id", memberIds).order("id", { ascending: true }).range(from, to),
      )
    : ({ ok: true, rows: [] } as const);
  if (!profiles.ok) return refuse(`Your franchise's people could not be read: ${profiles.error}`);

  const nameOf = new Map(names.rows.map((r) => [String(r.id), String(r.name)]));
  return {
    ok: true,
    franchise: {
      legalName: String(f.data.legal_name),
      status: f.data.status as FranchiseeStatus,
      office: { street: f.data.office_street, city: f.data.office_city, postalCode: f.data.office_postal_code, phone: f.data.office_phone },
      since: String(rows[0].created_at),
      territories: territoryIds
        .map((id) => ({ id, name: nameOf.get(id) ?? "A territory no longer listed" }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      people: profiles.rows
        .map((p) => ({ id: String(p.id), name: p.display_name?.trim() || "A person with no name on file", role: String(p.role) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    },
  };
}
