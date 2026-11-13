/**
 * THE FRANCHISE SEED, AS THE BROWSER AUDITS READ IT.
 *
 * scripts/seed-franchise-demo.mjs makes one demonstration franchisee on
 * development, once (Robert's order of 2026-11-12, item 1). This file is the
 * one place its identity lives, and the one way an audit reaches it:
 *
 *   - seededFranchisee(db) reads it back, with what an audit needs to know it
 *     is whole: a territory, a member, an agreement and its certificates. A
 *     missing or partial seed is a FAIL naming the script to run, never a skip,
 *     because these screens have no other way to be measured with a record on
 *     them.
 *   - franchiseSeedScreens(seed) is the list of seeded views: the
 *     administrator's franchisee record at /portal/franchisees?id=..., which no
 *     route walk can reach because the record is a query string, and the
 *     owner's own screen /portal/franchise, opened by an owner who belongs to
 *     it rather than by the administrator, who belongs to nothing.
 *   - attachFranchiseeOwner(base, label, id) makes a probe franchisee owner
 *     through createProbe, so its sign in and its second factor are the same
 *     as every other probe's, and makes it a member of the seed for the run.
 *
 * THE PROBE'S MEMBERSHIP IS WRITTEN DIRECTLY, NOT THROUGH setFranchiseeMember.
 * The product's writer would leave an audit row per run in a table that
 * refuses deletes, for a membership that exists only while an audit looks.
 * The row is the probe's own, on development, and destroyProbes deletes it
 * before the probe's profile (portal-probe.mjs), because eng_franchisee_members
 * restricts the deletion of a profile it names. A run that dies leaves the row
 * for the next sweep, like everything else on the probe domain.
 */
import { createProbe } from "./portal-probe.mjs";

export const SEED_FRANCHISEE = Object.freeze({
  legalName: "Demo Coastal Franchise LLC",
  office: Object.freeze({ street: "100 Demo Franchise Way", city: "Corpus Christi", postalCode: "78401", phone: "(361) 555-0142" }),
  territory: Object.freeze({ name: "Demo Franchise Territory", counties: Object.freeze(["Kleberg", "Kenedy"]) }),
  owner: Object.freeze({ email: "demo.franchise.owner@example.com", name: "Demo Franchise Owner" }),
  agreementSignedOn: "2026-11-02",
  carrier: "Demo Mutual Insurance (DEMONSTRATION)",
  effectiveOn: "2026-11-01",
  expiresOn: "2027-11-01",
  /* Robert's answer 12 of 2026-11-11: the three coverages, workers compensation for the third. */
  certificates: Object.freeze([
    Object.freeze({ kind: "general_liability", label: "General liability", policyNumber: "DEMO-GL-0001" }),
    Object.freeze({ kind: "auto", label: "Auto", policyNumber: "DEMO-AU-0001" }),
    Object.freeze({ kind: "workers_compensation", label: "Workers compensation", policyNumber: "DEMO-WC-0001" }),
  ]),
});

/*
 * THE SECOND SEED: A FRANCHISEE WITH NOTHING RECORDED. Robert's answer 1 of
 * 2026-11-12 to 6835287178. The agreement form shows only until an agreement
 * is recorded, and the first seed has one, so its record never renders the
 * form. This one holds no territory, no person, no agreement and no
 * certificate, so its record renders the agreement form and every step unmet.
 * It must STAY empty: a seed that gains anything is reported as not whole.
 */
export const SEED_ONBOARDING = Object.freeze({ legalName: "Demo Onboarding Franchise LLC" });

export const SEED_SCRIPT = "npx tsx --conditions=react-server scripts/seed-franchise-demo.mjs";

/**
 * The seed as development holds it, or why it is not whole. Never throws: a
 * read that fails is a reason, and the caller FAILs on it naming the script.
 */
export async function seededFranchisee(db) {
  if (!db) return { ok: false, why: "no development database client" };
  const { data: f, error } = await db.from("eng_franchisees").select("id, status, agreement_signed_on").eq("legal_name", SEED_FRANCHISEE.legalName).maybeSingle();
  if (error) return { ok: false, why: `the franchisee could not be read: ${error.message}` };
  if (!f) return { ok: false, why: `${SEED_FRANCHISEE.legalName} is not on this database; run: ${SEED_SCRIPT}` };
  const [{ data: t }, { data: m }, { data: c }] = await Promise.all([
    db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", f.id).is("ended_at", null),
    db.from("eng_franchisee_members").select("profile_id").eq("franchisee_id", f.id).is("ended_at", null),
    db.from("eng_franchisee_certificates").select("kind").eq("franchisee_id", f.id).is("withdrawn_at", null),
  ]);
  const missing = [];
  if (!(t ?? []).length) missing.push("a territory");
  if (!(m ?? []).length) missing.push("a member");
  if (!f.agreement_signed_on) missing.push("an agreement");
  if ((c ?? []).length < SEED_FRANCHISEE.certificates.length) missing.push(`${SEED_FRANCHISEE.certificates.length} certificates (has ${(c ?? []).length})`);
  if (missing.length) return { ok: false, why: `${SEED_FRANCHISEE.legalName} lacks ${missing.join(", ")}; run: ${SEED_SCRIPT}` };

  const { data: e, error: eError } = await db.from("eng_franchisees").select("id, status, agreement_signed_on").eq("legal_name", SEED_ONBOARDING.legalName).maybeSingle();
  if (eError) return { ok: false, why: `the second franchisee could not be read: ${eError.message}` };
  if (!e) return { ok: false, why: `${SEED_ONBOARDING.legalName} is not on this database; run: ${SEED_SCRIPT}` };
  const [{ data: et }, { data: em }, { data: ec }] = await Promise.all([
    db.from("eng_franchisee_territories").select("territory_id").eq("franchisee_id", e.id).is("ended_at", null),
    db.from("eng_franchisee_members").select("profile_id").eq("franchisee_id", e.id).is("ended_at", null),
    db.from("eng_franchisee_certificates").select("kind").eq("franchisee_id", e.id).is("withdrawn_at", null),
  ]);
  const recorded = [];
  if (e.status !== "onboarding") recorded.push(`status ${e.status}`);
  if (e.agreement_signed_on) recorded.push("an agreement");
  if ((et ?? []).length) recorded.push("a territory");
  if ((em ?? []).length) recorded.push("a member");
  if ((ec ?? []).length) recorded.push("a certificate");
  if (recorded.length) return { ok: false, why: `${SEED_ONBOARDING.legalName} must hold nothing and has ${recorded.join(", ")}` };

  return { ok: true, id: String(f.id), onboardingId: String(e.id), status: String(f.status), territories: t.length, members: m.length, certificates: c.length };
}

/** The seeded views, each with the role that opens it. */
export function franchiseSeedScreens(seed) {
  if (!seed?.ok) return [];
  return [
    { path: `/portal/franchisees?id=${seed.id}`, role: "admin", name: "franchisees: the seeded franchisee's record" },
    { path: "/portal/franchise", role: "franchisee_owner", name: "franchise: as the seeded franchisee's owner" },
    { path: `/portal/franchisees?id=${seed.onboardingId}`, role: "admin", name: "franchisees: the record with nothing recorded, its agreement form" },
  ];
}

/** A probe franchisee owner, signed in, and a member of the seed for this run. */
export async function attachFranchiseeOwner(base, label, franchiseeId, db) {
  const probe = await createProbe(base, "franchisee_owner", label);
  if (!probe?.cookie || !probe?.id) return { ...probe, fault: probe?.fault ?? "the owner probe has no session" };
  const { error } = await db.from("eng_franchisee_members").insert({ franchisee_id: franchiseeId, profile_id: probe.id });
  if (error) return { ...probe, cookie: null, fault: `the owner probe could not join the seed: ${error.message}` };
  return probe;
}
