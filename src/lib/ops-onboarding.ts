import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import { can, type Actor } from "./ops-authz";
import { createAccount } from "./ops-auth";
import { raise } from "./ops-notify";
import { canonicalCounty } from "./ops-counties";
import { checklistFor } from "@/content/onboarding-checklists";
import { createOnboarding } from "./onboarding";
import {
  CREDENTIAL_LABEL,
  CREDENTIAL_OF_ITEM,
  activationReadiness,
  credentialBlockers,
  expiryState,
  type CredentialRecord,
  type OnboardingItemView,
  type Readiness,
} from "./ops-credentials";

/**
 * The applicant to dispatchable path.
 *
 * WHAT WAS ALREADY HERE, AND WHAT WAS MISSING
 * -------------------------------------------
 * The onboarding system predates the portal and is good: invite tokens that are
 * hashed and never stored in plaintext, a checklist copied per hire so editing
 * the file later does not rewrite somebody's half finished onboarding, a private
 * bucket, and an operator verification step for the two things that have to
 * happen with a human in the room.
 *
 * What it never did was END anywhere. A completed onboarding sat as a folder of
 * accepted documents. Somebody then had to create an account by hand, retype the
 * coverage counties, and remember that the insurance certificate expires in
 * March. Every one of those three is a step where the paperwork and the
 * dispatchable roster drift apart, and the drift is invisible until a technician
 * turns up at a property uninsured.
 *
 * ACTIVATION IS THE JOIN, AND IT IS THE IRREVERSIBLE STEP
 * -------------------------------------------------------
 * activateTechnician creates the account, copies every accepted document into
 * eng_credentials with the expiry date somebody typed while looking at it, sets
 * the coverage gathered during onboarding, and issues the set password link. It
 * refuses unless activationReadiness says yes, and that function is pure and
 * asserted rather than living in the button.
 *
 * IT DOES NOT CERTIFY ANYBODY
 * ---------------------------
 * A new technician is activated with no certifications, so dispatch will not
 * offer them anything until they pass a protocol check. That is deliberate and
 * it is the whole point of the gate: activation says the paperwork is in order,
 * certification says they know what to photograph, and the two are different
 * claims about different things.
 */

type Context = { ip?: string | null; userAgent?: string | null };

// -------------------------------------------------------------- applications

export type ApplicationRow = {
  id: string;
  created_at: string;
  site: string;
  role: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  counties: string | null;
  experience: string | null;
  drone_license: boolean | null;
  reliable_vehicle: boolean | null;
  status: string;
};

const APPLICATION_COLUMNS =
  "id, created_at, site, role, name, email, phone, city, counties, experience, drone_license, reliable_vehicle, status";

export async function listApplications(actor: Actor | null): Promise<ApplicationRow[]> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "profiles.create")) return [];
  const { data } = await db
    .from("eng_applications")
    .select(APPLICATION_COLUMNS)
    .eq("site", "254")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as ApplicationRow[];
}

/**
 * Turn an application into an onboarding invite.
 *
 * The application row is never deleted and never edited beyond its status. It is
 * the origin record and it carries the attribution the three public sites
 * captured, the same reasoning convertLead follows in ops-crm.
 *
 * The counties field on an application is free text somebody typed into a
 * careers form. It is carried across as a STARTING POINT that the operator
 * confirms, not as coverage, because "the coastal bend and sometimes Victoria"
 * is not a list dispatch can match against.
 */
export async function inviteFromApplication(
  actor: Actor & { email: string },
  applicationId: string,
  input: { role: "engineer" | "field_tech"; notes?: string | null },
  context: Context = {},
): Promise<{ ok: true; onboardingId: string; token: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.create")) return { ok: false, error: "Your role cannot invite people." };

  const { data: application } = await db
    .from("eng_applications")
    .select(APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { ok: false, error: "That application does not exist." };

  const app = application as ApplicationRow;
  if (!app.email) return { ok: false, error: "That application has no email address to invite." };
  if (!app.name) return { ok: false, error: "That application has no name on it." };

  const { data: already } = await db
    .from("eng_onboardings")
    .select("id")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (already) return { ok: false, error: "That application has already been invited." };

  const created = await createOnboarding({
    personName: app.name,
    email: app.email,
    phone: app.phone ?? undefined,
    role: input.role,
    notes: input.notes?.trim() || undefined,
  });
  if (!created.ok) return { ok: false, error: created.error };

  await db
    .from("eng_onboardings")
    .update({ application_id: applicationId, base_city: app.city })
    .eq("id", created.data.onboarding.id);

  // Status only. The row itself is the origin record and stays as it is.
  await db.from("eng_applications").update({ status: "invited" }).eq("id", applicationId);

  await writeAudit({
    actor,
    action: "onboarding.invite_from_application",
    entityType: "onboarding",
    entityId: created.data.onboarding.id,
    summary: `Invited ${app.name} as ${input.role} from a careers application`,
    ...context,
  });

  return { ok: true, onboardingId: created.data.onboarding.id, token: created.data.token };
}

// --------------------------------------------------------- item dates, scope

/**
 * Record when a document was issued and when it expires.
 *
 * Typed by whoever is looking at the card. Nothing reads the document: the
 * standing rule is that the firm needs the document, not the data off it, and an
 * expiry date a machine pulled off a phone photograph is a date nobody checked.
 */
export async function setItemDates(
  actor: Actor & { email: string },
  onboardingId: string,
  itemKey: string,
  dates: { issuedOn?: string | null; expiresOn?: string | null },
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.update")) return { ok: false, error: "Your role cannot edit an onboarding." };

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const value of [dates.issuedOn, dates.expiresOn]) {
    if (value && !iso.test(value)) return { ok: false, error: "Dates must be a calendar date." };
  }
  if (dates.issuedOn && dates.expiresOn && dates.issuedOn > dates.expiresOn) {
    return { ok: false, error: "That document expires before it was issued. Check the two dates." };
  }

  const { error } = await db
    .from("eng_onboarding_items")
    .update({ issued_on: dates.issuedOn ?? null, expires_on: dates.expiresOn ?? null })
    .eq("onboarding_id", onboardingId)
    .eq("item_key", itemKey);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "onboarding.set_dates",
    entityType: "onboarding",
    entityId: onboardingId,
    summary: `Recorded dates on ${itemKey}`,
    ...context,
  });
  return { ok: true };
}

/**
 * Where this person would work, gathered during onboarding.
 *
 * Every county is validated against the canonical 254 before it is stored. A
 * typo here is not a cosmetic problem: dispatch matches on the county string, so
 * a misspelled entry silently excludes the technician from every job in a place
 * they cover, and the roster would show the coverage as set.
 */
export async function setOnboardingCoverage(
  actor: Actor & { email: string },
  onboardingId: string,
  input: { counties: string[]; baseCity?: string | null; baseCounty?: string | null },
  context: Context = {},
): Promise<{ ok: true; counties: string[] } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.update")) return { ok: false, error: "Your role cannot edit an onboarding." };

  const canonical: string[] = [];
  const rejected: string[] = [];
  for (const raw of input.counties) {
    const county = canonicalCounty(raw);
    if (county) {
      if (!canonical.includes(county)) canonical.push(county);
    } else if (raw.trim()) {
      rejected.push(raw.trim());
    }
  }
  if (rejected.length) {
    return {
      ok: false,
      error: `Not a Texas county: ${rejected.join(", ")}. Dispatch matches on the county name, so a typo would silently exclude this technician from every job there.`,
    };
  }

  const baseCounty = input.baseCounty ? canonicalCounty(input.baseCounty) : null;
  if (input.baseCounty && !baseCounty) {
    return { ok: false, error: `Not a Texas county: ${input.baseCounty}.` };
  }

  const { error } = await db
    .from("eng_onboardings")
    .update({
      coverage_counties: canonical,
      base_city: input.baseCity?.trim() || null,
      base_county: baseCounty,
    })
    .eq("id", onboardingId);
  if (error) return { ok: false, error: error.message };

  await writeAudit({
    actor,
    action: "onboarding.set_coverage",
    entityType: "onboarding",
    entityId: onboardingId,
    summary: `Set coverage to ${canonical.length} count${canonical.length === 1 ? "y" : "ies"}`,
    ...context,
  });
  return { ok: true, counties: canonical };
}

// ------------------------------------------------------------- activation

export type ActivationView = {
  onboarding: {
    id: string;
    person_name: string;
    email: string;
    phone: string | null;
    role: "engineer" | "field_tech";
    status: string;
    coverage_counties: string[];
    base_city: string | null;
    base_county: string | null;
    activated_at: string | null;
    profile_id: string | null;
  };
  items: (OnboardingItemView & {
    issuedOn: string | null;
    credentialKind: string | null;
    /** Whether this document HAS an expiry date. A W-9 does not. */
    expires: boolean;
  })[];
  readiness: Readiness;
};

export async function activationView(actor: Actor | null, onboardingId: string): Promise<ActivationView | null> {
  const db = supabaseAdmin();
  if (!db || !can(actor, "profiles.create")) return null;

  const { data: onboarding } = await db
    .from("eng_onboardings")
    .select(
      "id, person_name, email, phone, role, status, coverage_counties, base_city, base_county, activated_at, profile_id",
    )
    .eq("id", onboardingId)
    .maybeSingle();
  if (!onboarding) return null;

  const { data: rows } = await db
    .from("eng_onboarding_items")
    .select("item_key, label, status, actor, issued_on, expires_on, sort_order")
    .eq("onboarding_id", onboardingId)
    .order("sort_order");

  const items = (rows ?? []).map((r) => ({
    itemKey: r.item_key as string,
    label: r.label as string,
    status: r.status as OnboardingItemView["status"],
    actor: r.actor as "person" | "admin",
    expiresOn: (r.expires_on as string | null) ?? null,
    issuedOn: (r.issued_on as string | null) ?? null,
    credentialKind: CREDENTIAL_OF_ITEM[r.item_key as string]?.kind ?? null,
    expires: CREDENTIAL_OF_ITEM[r.item_key as string]?.expires ?? false,
  }));

  return {
    onboarding: onboarding as ActivationView["onboarding"],
    items,
    readiness: activationReadiness(items, (onboarding.coverage_counties as string[]) ?? []),
  };
}

/**
 * Turn a finished onboarding into a working technician.
 *
 * ORDER MATTERS AND IS DELIBERATE
 * -------------------------------
 * Readiness first, because everything after it is hard to undo. Then the
 * account, because the credentials reference it. Then the credentials, then the
 * onboarding is stamped. If the credential writes fail the account still exists
 * and the onboarding is not stamped, so the operator can run it again: the
 * credential insert is keyed on the profile and the kind, so a second run
 * updates rather than duplicating.
 *
 * A partially activated person is visible as a profile with no credentials,
 * which dispatch already refuses to offer work to. That is the failure mode this
 * ordering chooses: an account that cannot be dispatched, rather than a
 * dispatchable technician whose paperwork never landed.
 */
export async function activateTechnician(
  actor: Actor & { email: string },
  onboardingId: string,
  context: Context = {},
): Promise<
  | { ok: true; profileId: string; token: string | null; linked: boolean; credentials: number }
  | { ok: false; error: string; blockers?: string[] }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.create")) return { ok: false, error: "Your role cannot activate accounts." };

  const view = await activationView(actor, onboardingId);
  if (!view) return { ok: false, error: "That onboarding does not exist." };
  if (view.onboarding.activated_at) {
    return { ok: false, error: "That onboarding has already been activated." };
  }
  if (!view.readiness.ready) {
    return {
      ok: false,
      error: "This onboarding is not ready to activate.",
      blockers: view.readiness.blockers,
    };
  }

  const created = await createAccount({
    email: view.onboarding.email,
    displayName: view.onboarding.person_name,
    role: view.onboarding.role,
    phone: view.onboarding.phone,
    coverageCounties: view.onboarding.coverage_counties,
    baseCity: view.onboarding.base_city,
    baseCounty: view.onboarding.base_county,
  });
  if (!created.ok) return { ok: false, error: created.error };

  /*
   * Every accepted document that dispatch reads becomes a credential row,
   * carrying the expiry date somebody typed while holding the card.
   *
   * Written as verified rather than pending: the operator accepted the item on
   * the onboarding screen, which is the same act. Two acceptance steps for one
   * document would be a step somebody starts skipping.
   */
  const credentialRows = view.items
    .filter((i) => i.status === "accepted" && i.credentialKind)
    .map((i) => ({
      profile_id: created.profileId,
      kind: i.credentialKind as string,
      label: i.label,
      issued_on: i.issuedOn,
      expires_on: i.expiresOn,
      status: "verified",
      verified_at: new Date().toISOString(),
      verified_by: actor.id,
    }));

  let written = 0;
  if (credentialRows.length) {
    const { error } = await db.from("eng_credentials").insert(credentialRows);
    if (error) {
      return {
        ok: false,
        error:
          `The account was created but the credentials did not save: ${error.message}. ` +
          "The technician cannot be dispatched until they do. Run this again.",
      };
    }
    written = credentialRows.length;
  }

  await db
    .from("eng_onboardings")
    .update({
      activated_at: new Date().toISOString(),
      profile_id: created.profileId,
      status: "complete",
    })
    .eq("id", onboardingId);

  await db.from("eng_profiles").update({ onboarding_id: onboardingId }).eq("id", created.profileId);

  await writeAudit({
    actor,
    action: "onboarding.activate",
    entityType: "profile",
    entityId: created.profileId,
    summary: `Activated ${view.onboarding.person_name} as ${view.onboarding.role} with ${written} credential${written === 1 ? "" : "s"}`,
    ...context,
  });

  return {
    ok: true,
    profileId: created.profileId,
    token: created.token,
    linked: created.linked,
    credentials: written,
  };
}

// ------------------------------------------------------------- credentials

export type CredentialRow = CredentialRecord & {
  id: string;
  profileId: string;
  issuedOn: string | null;
};

export async function credentialsFor(profileIds: string[]): Promise<Map<string, CredentialRow[]>> {
  const db = supabaseAdmin();
  const byProfile = new Map<string, CredentialRow[]>();
  if (!db || profileIds.length === 0) return byProfile;

  const { data } = await db
    .from("eng_credentials")
    .select("id, profile_id, kind, label, status, issued_on, expires_on")
    .in("profile_id", profileIds);

  for (const row of data ?? []) {
    const entry: CredentialRow = {
      id: row.id as string,
      profileId: row.profile_id as string,
      kind: row.kind as CredentialRecord["kind"],
      label: (row.label as string | null) ?? null,
      status: row.status as CredentialRecord["status"],
      issuedOn: (row.issued_on as string | null) ?? null,
      expiresOn: (row.expires_on as string | null) ?? null,
    };
    byProfile.set(entry.profileId, [...(byProfile.get(entry.profileId) ?? []), entry]);
  }
  return byProfile;
}

/** Blockers per technician, for dispatch and the roster. */
export async function credentialBlockersFor(profileIds: string[]): Promise<Map<string, string[]>> {
  const held = await credentialsFor(profileIds);
  const out = new Map<string, string[]>();
  for (const id of profileIds) {
    out.set(id, credentialBlockers(held.get(id) ?? []).map((b) => b.reason));
  }
  return out;
}

/**
 * Update or add a credential directly, for the operator maintaining a roster.
 *
 * A renewed insurance certificate arrives by email eleven months after
 * onboarding finished, and there is no onboarding to attach it to. Without this
 * the only route would be re-running an onboarding for somebody who already
 * works here.
 */
export async function recordCredential(
  actor: Actor & { email: string },
  profileId: string,
  input: {
    id?: string | null;
    kind: string;
    label?: string | null;
    issuedOn?: string | null;
    expiresOn?: string | null;
    status?: "pending" | "verified" | "rejected" | "expired";
  },
  context: Context = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!can(actor, "profiles.update")) return { ok: false, error: "Your role cannot edit credentials." };

  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const value of [input.issuedOn, input.expiresOn]) {
    if (value && !iso.test(value)) return { ok: false, error: "Dates must be a calendar date." };
  }

  const row = {
    profile_id: profileId,
    kind: input.kind,
    label: input.label?.trim() || null,
    issued_on: input.issuedOn || null,
    expires_on: input.expiresOn || null,
    status: input.status ?? "verified",
    verified_at: (input.status ?? "verified") === "verified" ? new Date().toISOString() : null,
    verified_by: actor.id,
  };

  const { error } = input.id
    ? await db.from("eng_credentials").update(row).eq("id", input.id).eq("profile_id", profileId)
    : await db.from("eng_credentials").insert(row);
  if (error) return { ok: false, error: error.message };

  /*
   * If the document that was just recorded is already inside the warning
   * window, say so now rather than waiting for a monthly sweep. Mandatory
   * email: a lapsed credential stops dispatch offering them work.
   */
  if (row.expires_on && expiryState(row.expires_on) !== "current") {
    const { data: person } = await db
      .from("eng_profiles")
      .select("role, display_name")
      .eq("id", profileId)
      .maybeSingle();
    if (person) {
      await raise({
        profileId,
        role: person.role as Actor["role"],
        kind: "credential.expiring",
        title: `Your ${CREDENTIAL_LABEL[input.kind as keyof typeof CREDENTIAL_LABEL] ?? input.kind} expires ${row.expires_on}`,
        body: "Dispatch refuses a technician whose required documents have lapsed. Send the replacement to the operator before then.",
        href: "/portal/certification",
        entityType: "profile",
        entityId: profileId,
      });
    }
  }

  await writeAudit({
    actor,
    action: input.id ? "credential.update" : "credential.add",
    entityType: "profile",
    entityId: profileId,
    summary: `${input.id ? "Updated" : "Recorded"} ${input.kind}${input.expiresOn ? `, expires ${input.expiresOn}` : ""}`,
    ...context,
  });
  return { ok: true };
}

/** The checklist a role is invited to complete, for the invite screen's preview. */
export function checklistPreview(role: "engineer" | "field_tech") {
  return checklistFor(role).map((i) => ({
    key: i.key,
    label: i.label,
    actor: i.actor,
    credentialKind: CREDENTIAL_OF_ITEM[i.key]?.kind ?? null,
    expires: CREDENTIAL_OF_ITEM[i.key]?.expires ?? false,
  }));
}
