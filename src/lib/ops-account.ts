import "server-only";
import { supabaseAdmin } from "./supabase";
import { writeAudit } from "./ops-audit";
import type { CustomerPrincipal } from "./customer-auth";

/**
 * An organisation's saved defaults and its saved properties.
 *
 * WHAT EACH DEFAULT ACTUALLY DOES, WHICH IS THE POINT
 * ---------------------------------------------------
 * A stored preference that nothing reads is a settings screen that lies. Each
 * one below is wired, and the one that could not be wired honestly says so:
 *
 *   billing contact and email  used on statements
 *   standing access instructions  prefills the access_notes input on every order
 *   default counties  prefills the property rows in a bulk submission
 *   saved properties  chosen directly instead of retyped
 *   preferred turnaround  RECORDED AND SHOWN TO THE FIRM, and nothing more
 *
 * The last one is deliberate. eng_fee_schedule prices by (kind, service_slug,
 * tier, county_band, urgency) but the catalog does not sell an expedited tier,
 * so setting a file to expedited from a saved preference would commit the firm
 * to faster work at the standard price. Until urgency is priced, this is a
 * request the operator sees, and the screen says exactly that rather than
 * implying a guarantee.
 *
 * ONLY AN OWNER CHANGES ANY OF IT
 * -------------------------------
 * account_role has two values and this is the one place it matters. A member
 * places orders; an owner also decides the billing contact and the standing
 * instructions that go onto every order the organisation places. Checked here
 * rather than in the route, so a second caller cannot skip it.
 */

export type AccountDefaults = {
  billingEmail: string | null;
  billingContact: string | null;
  preferredUrgency: "standard" | "expedited" | "emergency" | null;
  accessInstructions: string | null;
  defaultCounties: string[];
};

export type SavedProperty = {
  id: string;
  label: string | null;
  propertyAddress: string;
  city: string | null;
  county: string;
  postalCode: string | null;
  accessNotes: string | null;
};

const OWNER_ONLY = "Only an account owner can change these. Ask whoever set the account up.";

export async function accountDefaults(accountId: string): Promise<AccountDefaults | null> {
  const db = supabaseAdmin();
  if (!db) return null;

  const { data } = await db
    .from("eng_customer_accounts")
    .select("billing_email, billing_contact, preferred_urgency, access_instructions, default_counties")
    .eq("id", accountId)
    .maybeSingle();
  if (!data) return null;

  return {
    billingEmail: (data.billing_email as string | null) ?? null,
    billingContact: (data.billing_contact as string | null) ?? null,
    preferredUrgency: (data.preferred_urgency as AccountDefaults["preferredUrgency"]) ?? null,
    accessInstructions: (data.access_instructions as string | null) ?? null,
    defaultCounties: (data.default_counties as string[] | null) ?? [],
  };
}

export async function updateDefaults(
  me: CustomerPrincipal,
  input: Partial<AccountDefaults>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (me.accountRole !== "owner") return { ok: false, error: OWNER_ONLY };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  /*
   * Only the fields that were sent, so a screen that renders four of five
   * settings cannot blank the fifth by omitting it.
   */
  const patch: Record<string, unknown> = {};
  if (input.billingEmail !== undefined) patch.billing_email = input.billingEmail || null;
  if (input.billingContact !== undefined) patch.billing_contact = input.billingContact || null;
  if (input.accessInstructions !== undefined) {
    patch.access_instructions = input.accessInstructions || null;
  }
  if (input.defaultCounties !== undefined) {
    patch.default_counties = input.defaultCounties.map((c) => c.trim()).filter(Boolean);
  }
  if (input.preferredUrgency !== undefined) {
    const allowed = ["standard", "expedited", "emergency"];
    patch.preferred_urgency =
      input.preferredUrgency && allowed.includes(input.preferredUrgency) ? input.preferredUrgency : null;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const { error } = await db.from("eng_customer_accounts").update(patch).eq("id", me.accountId);
  if (error) return { ok: false, error: "That could not be saved." };

  await writeAudit({
    actor: { id: null, role: "customer" as never, email: me.email },
    action: "account.defaults_changed",
    entityType: "customer_account",
    entityId: me.accountId,
    summary: `${me.displayName} changed ${Object.keys(patch).join(", ")}`,
  });

  return { ok: true };
}

// ------------------------------------------------------------- properties

export async function savedProperties(accountId: string): Promise<SavedProperty[]> {
  const db = supabaseAdmin();
  if (!db) return [];

  const { data } = await db
    .from("eng_account_properties")
    .select("id, label, property_address, city, county, postal_code, access_notes")
    .eq("account_id", accountId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  return (data ?? []).map((p) => ({
    id: p.id as string,
    label: (p.label as string | null) ?? null,
    propertyAddress: p.property_address as string,
    city: (p.city as string | null) ?? null,
    county: p.county as string,
    postalCode: (p.postal_code as string | null) ?? null,
    accessNotes: (p.access_notes as string | null) ?? null,
  }));
}

export async function addProperty(
  me: CustomerPrincipal,
  input: { label?: string; propertyAddress: string; city?: string; county: string; postalCode?: string; accessNotes?: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (me.accountRole !== "owner") return { ok: false, error: OWNER_ONLY };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  const address = input.propertyAddress?.trim();
  const county = input.county?.trim();
  if (!address) return { ok: false, error: "A saved property needs an address." };
  if (!county) {
    return {
      ok: false,
      error: "A saved property needs a county. The county decides both the protocol and the price.",
    };
  }

  const { data, error } = await db
    .from("eng_account_properties")
    .insert({
      account_id: me.accountId,
      label: input.label?.trim() || null,
      property_address: address,
      city: input.city?.trim() || null,
      county,
      postal_code: input.postalCode?.trim() || null,
      access_notes: input.accessNotes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: "That could not be saved." };
  return { ok: true, id: data.id as string };
}

/**
 * Archived, never deleted.
 *
 * A saved property can be named on orders that already exist, and a customer
 * tidying their list should not remove the record of what an order was placed
 * against. Archiving takes it out of the picker and leaves the history alone.
 */
export async function archiveProperty(
  me: CustomerPrincipal,
  propertyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (me.accountRole !== "owner") return { ok: false, error: OWNER_ONLY };

  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The account system is not configured." };

  /*
   * Scoped to the account in the WHERE clause. An id from another organisation
   * matches nothing rather than being loaded and then refused.
   */
  const { data } = await db
    .from("eng_account_properties")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("account_id", me.accountId)
    .select("id");

  if (!data || data.length === 0) return { ok: false, error: "That property is not on this account." };
  return { ok: true };
}
