import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { supabaseAdmin } from "./supabase";
import { can, holdsLicence, type Actor } from "./ops-authz";
import type { ProfileRow } from "./ops-auth";
import { verifyFreshCode } from "./ops-mfa";
import { verifiedEngineers } from "@/config/credentials";
import { SCOPE_ADDENDUM_REQUIRED } from "@/config/engineer-pay";
import { HELD_UNTIL_ADDENDUM } from "@/content/protocols/signable";
import { putHeldProtocolInForce } from "./protocol-sign";
import { dollarsToCentsStrict } from "./ops-insurance";

/**
 * ===========================================================================
 * A SCOPE ADDENDUM, SIGNED IN THE PORTAL EXACTLY AS A PROTOCOL IS.
 * ===========================================================================
 *
 * Operator rulings of 2026-10-22 (migration 0082): custom design pays the
 * engineer 35% of the engineering fee under a signed scope addendum, and
 * nothing without one; he signs it "in the portal, under his own account, with
 * a fresh second factor, recorded as a seal-act style record exactly like a
 * protocol signature. No PDF signing, no email signing."
 *
 * src/lib/protocol-sign.ts is the pattern, step for step: the licence on the
 * register, the hash of the text he reads, a fresh code, his current seal and
 * signature images by id, and one database function as the door. The text is
 * the database's own (0082 writes it from the addendum's figures), so what he
 * reads, what is hashed and what pays are one record.
 */

type SignedIn = Actor & ProfileRow;

/*
 * TWO KINDS SINCE 0095. design_share prices one design quote: quote, fee and
 * share are all set. per_job pays a flat pay_cents for every job of one
 * deliverable: quote, fee and share are null, by the shape check.
 */
export type AddendumRow = {
  id: string;
  created_at: string;
  basis: "design_share" | "per_job";
  quote_id: string | null;
  deliverable: string;
  scope: string;
  fee_cents: number | null;
  share_bp: number | null;
  pay_cents: number;
  addendum_text: string;
  content_sha256: string;
};

/** What an addendum is about, from the text the database wrote: its job, or its deliverable. */
export function addendumHeading(text: string): string {
  const lines = text.split("\n");
  return (
    lines.find((l) => l.startsWith("Job: "))?.slice(5) ??
    lines.find((l) => l.startsWith("Deliverable: "))?.slice(13) ??
    "this addendum"
  );
}

export type AddendumState =
  | { state: "unsigned" }
  | { state: "signed"; signedAt: string }
  | { state: "unknown"; why: string };

/** The addenda naming this engineer, newest first, each with its signature state. */
export async function addendaFor(engineerId: string): Promise<
  { ok: true; addenda: (AddendumRow & { signature: AddendumState })[] } | { ok: false; why: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, why: "The database is not configured." };
  const { data, error } = await db
    .from("eng_scope_addenda")
    .select("id, created_at, basis, quote_id, deliverable, scope, fee_cents, share_bp, pay_cents, addendum_text, content_sha256")
    .eq("engineer_id", engineerId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return { ok: false, why: `The scope addenda could not be read: ${error.message}` };
  const rows = (data ?? []) as AddendumRow[];
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("addendum_id, created_at, content_sha256")
    .eq("kind", "addendum")
    .is("voided_at", null)
    .in("addendum_id", rows.map((r) => r.id));
  if (actsError) return { ok: false, why: `The addendum signatures could not be read: ${actsError.message}` };
  return {
    ok: true,
    addenda: rows.map((r) => {
      const act = (acts ?? []).find((a) => a.addendum_id === r.id && a.content_sha256 === r.content_sha256);
      return { ...r, signature: act ? { state: "signed", signedAt: act.created_at as string } : { state: "unsigned" } };
    }),
  };
}

export async function signAddendum(
  actor: SignedIn | null,
  input: { addendumId: string; code: string },
): Promise<{ ok: true; sha256: string; note?: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!holdsLicence(actor, "protocols.author")) {
    return { ok: false, error: "Only the engineer of record signs a scope addendum. No other role can stand in for him." };
  }
  const engineer = verifiedEngineers.find((e) => e.licenseNumber === actor!.license_number);
  if (!engineer) {
    return { ok: false, error: "Your license number on this account does not match the engineer on the firm's register." };
  }

  const { data: addendum, error } = await db
    .from("eng_scope_addenda")
    .select("id, engineer_id, deliverable, addendum_text, content_sha256")
    .eq("id", input.addendumId)
    .maybeSingle();
  if (error) return { ok: false, error: `The addendum could not be read: ${error.message}` };
  if (!addendum) return { ok: false, error: "That scope addendum does not exist." };
  if (addendum.engineer_id !== actor!.id) return { ok: false, error: "This scope addendum names another engineer." };

  /* The hash he signs is recomputed from the text he reads, never taken on trust from the row. */
  const sha256 = createHash("sha256").update(addendum.addendum_text as string, "utf8").digest("hex");
  if (sha256 !== addendum.content_sha256) {
    return { ok: false, error: "This addendum's text does not match its recorded hash, so it cannot be signed." };
  }

  const fresh = await verifyFreshCode(actor!.id, input.code);
  if (!fresh.ok) return { ok: false, error: fresh.error };

  const { data: images, error: imageError } = await db
    .from("eng_seal_images")
    .select("id, kind")
    .eq("profile_id", actor!.id)
    .is("superseded_at", null);
  if (imageError) return { ok: false, error: `Your seal images could not be read: ${imageError.message}` };
  const sealId = images?.find((i) => i.kind === "seal")?.id as string | undefined;
  const signatureId = images?.find((i) => i.kind === "signature")?.id as string | undefined;
  if (!sealId || !signatureId) return { ok: false, error: "Upload your seal and your signature on your profile before signing." };

  const recorded = await db.rpc("eng_record_addendum_signature", {
    p_seal_act_id: randomUUID(),
    p_addendum_id: input.addendumId,
    p_sha256: sha256,
    p_sealed_by: actor!.id,
    p_seal_image_id: sealId,
    p_signature_image_id: signatureId,
    p_mfa_verified_at: fresh.verifiedAt,
  });
  if (recorded.error) return { ok: false, error: `The signature could not be recorded: ${recorded.error.message}` };

  /*
   * A PROTOCOL HELD UNTIL THIS ADDENDUM GOES IN FORCE NOW. Robert's answer 12
   * of 2026-10-26: his 254-WP-001 signature is already live, and the addendum
   * for windstorm-wpi-8/ongoing is what it waited for. The addendum's signature
   * stands whatever happens here; if the protocol cannot be put in force, he is
   * told why and the line stays shut, because its door asks for both.
   */
  const held = Object.entries(HELD_UNTIL_ADDENDUM).filter(([, deliverable]) => deliverable === addendum.deliverable);
  for (const [documentNumber] of held) {
    const put = await putHeldProtocolInForce(actor, documentNumber);
    if (!put.ok) {
      return { ok: true, sha256, note: `Your signature on the addendum is recorded. ${put.error} The line stays closed until it is.` };
    }
  }
  return { ok: true, sha256 };
}

/**
 * WHERE A DELIVERABLE'S ADDENDUM STANDS, for the owner's screen: the newest
 * per_job addendum (which is the one that decides, as eng_line_pay reads it),
 * and whether he has signed it. A failed read says so, never "none drafted".
 */
export async function lineAddendumState(
  deliverable: string,
): Promise<
  | { ok: true; newest: { id: string; payCents: number; createdAt: string } | null; signed: boolean }
  | { ok: false; why: string }
> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, why: "The database is not configured." };
  const { data, error } = await db
    .from("eng_scope_addenda")
    .select("id, pay_cents, created_at, content_sha256")
    .eq("basis", "per_job")
    .eq("deliverable", deliverable)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);
  if (error) return { ok: false, why: `The scope addenda could not be read: ${error.message}` };
  const row = data?.[0];
  if (!row) return { ok: true, newest: null, signed: false };
  const { data: acts, error: actsError } = await db
    .from("eng_seal_acts")
    .select("id")
    .eq("kind", "addendum")
    .eq("addendum_id", row.id)
    .eq("content_sha256", row.content_sha256)
    .is("voided_at", null)
    .limit(1);
  if (actsError) return { ok: false, why: `The addendum's signature could not be read: ${actsError.message}` };
  return {
    ok: true,
    newest: { id: row.id as string, payCents: Number(row.pay_cents), createdAt: row.created_at as string },
    signed: (acts ?? []).length > 0,
  };
}

/**
 * THE OWNER DRAFTS AN ADDENDUM FOR A DELIVERABLE HIS AGREEMENT DOES NOT COVER.
 * Robert's ruling of 2026-10-26, 07:10 Central: "owner or admin drafts the
 * addendum (line, amount, text), it appears on the engineer's portal home as
 * waiting for his signature". addenda.draft, the administrator alone (0095).
 *
 * Only a deliverable SCOPE_ADDENDUM_REQUIRED lists can be drafted here, so this
 * cannot be used to rewrite pay his agreement already sets. The database writes
 * the text and its hash from the figures; nothing typed here reaches the hash
 * except the scope, which is printed as written. Drafting opens nothing and pays
 * nothing: only his signature does.
 */
export async function draftLineAddendum(
  actor: SignedIn | null,
  input: { deliverable: string; payDollars: string; scope: string },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, error: "The database is not configured." };
  if (!actor || !can(actor, "addenda.draft")) return { ok: false, error: "Only the owner drafts a scope addendum." };
  const deliverable = input.deliverable.trim();
  if (!(deliverable in SCOPE_ADDENDUM_REQUIRED)) {
    return { ok: false, error: `${deliverable || "That deliverable"} is not one the engineer's agreement leaves out, so it needs no addendum.` };
  }
  /* A blank or unreadable amount is no amount, never a zero (the strict parser of the insurance register). */
  const payCents = dollarsToCentsStrict(input.payDollars);
  if (payCents === null) return { ok: false, error: "Enter his pay per job in dollars, more than zero." };
  const scope = input.scope.trim();
  if (scope.length < 20) return { ok: false, error: "Write the scope in plain words: what the pay covers, and what else changes, if anything." };

  /* The engineer it names is the one engineer of record on the register, by licence. */
  const engineer = verifiedEngineers[0];
  if (!engineer) return { ok: false, error: "No engineer of record is on the firm's register." };
  const { data: profile, error: profileError } = await db
    .from("eng_profiles")
    .select("id")
    .eq("role", "engineer")
    .eq("license_number", engineer.licenseNumber)
    .maybeSingle();
  if (profileError) return { ok: false, error: `The engineer's account could not be read: ${profileError.message}` };
  if (!profile) return { ok: false, error: "The engineer of record has no portal account with his licence number, so there is nobody to sign it." };

  const { data, error } = await db
    .from("eng_scope_addenda")
    .insert({ basis: "per_job", deliverable, engineer_id: profile.id, scope, pay_cents: payCents, created_by: actor.id })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: `The addendum could not be recorded: ${error?.message ?? "no row came back"}` };
  return { ok: true, id: data.id as string };
}

/**
 * HIS PAY ON A DESIGN QUOTE, OR WHY THERE IS NONE. Read through eng_design_pay
 * (0082), so the rule that pays is the database's and cannot drift from the
 * proof. A failed read is not a figure, and neither is a missing signature.
 */
export async function designPayFor(
  quoteId: string,
): Promise<{ ok: true; cents: number; addendumId: string } | { ok: false; reason: string }> {
  const db = supabaseAdmin();
  if (!db) return { ok: false, reason: "the database is not configured, so the scope addendum could not be read" };
  const { data, error } = await db.rpc("eng_design_pay", { p_quote_id: quoteId });
  if (error) return { ok: false, reason: `the scope addendum could not be read: ${error.message}` };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return {
      ok: false,
      reason: "no scope addendum signed by the engineer covers this design job, so no pay is owed until he signs one",
    };
  }
  return { ok: true, cents: Number(row.pay_cents), addendumId: row.addendum_id as string };
}
