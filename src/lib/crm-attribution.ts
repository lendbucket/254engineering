import "server-only";
import { supabaseAdmin } from "./supabase";
import { captureError } from "./ops-observability";
import { creditedRep } from "./crm-report-rules";

/**
 * THE ATTRIBUTION CHAIN, PROSPECT TO ACCOUNT TO ORDER. Robert's sales CRM
 * ruling R8 of 2026-11-02: "Attribution chain prospect to account to order
 * written on conversion and on each order."
 *
 * Written where the fact happens, never on read: attributeConversion from
 * convertProspect, attributeOrder from placeOrder (the web, sister, bulk and
 * quote doors all place through it) and from invoiceAccount (the telephoned
 * job billed to an account). Each write is idempotent on its unique key
 * (0119): a second call for the same order or the same opening finds the row
 * already there and reports it, so a retried placement credits once.
 *
 * A failed write does NOT undo the order or the conversion. The money and the
 * account are the customer's; the credit is the firm's bookkeeping, and
 * refusing a paying customer's order because a sales row did not save would
 * be the wrong trade. The fault is recorded, and the reports screen counts
 * orders on converted accounts that carry no attribution and says so, so a
 * missed row is visible rather than silently absent from a leaderboard.
 */

type Db = NonNullable<ReturnType<typeof supabaseAdmin>>;

export type AttributionResult =
  | { ok: true; attributed: "written" | "already" | "not_from_a_prospect" }
  | { ok: false; error: string };

type ProspectForCredit = {
  id: string;
  owner_id: string | null;
  converted_by: string | null;
  converted_account_id: string | null;
};

async function prospectForAccount(db: Db, accountId: string) {
  return db
    .from("eng_prospects")
    .select("id, owner_id, converted_by, converted_account_id")
    .eq("converted_account_id", accountId)
    .order("converted_at", { ascending: true })
    .limit(1)
    .maybeSingle();
}

async function insertRow(
  db: Db,
  row: { kind: "account_opened" | "order"; prospect_id: string; account_id: string; order_id: string | null; rep_id: string | null },
  where: string,
): Promise<AttributionResult> {
  const { error } = await db.from("eng_crm_attributions").insert(row);
  if (!error) return { ok: true, attributed: "written" };
  /* The unique index (0119) is what makes a repeat credit once. */
  if (error.code === "23505") return { ok: true, attributed: "already" };
  await captureError(new Error(`The sales attribution could not be written: ${error.message}`), {
    route: where,
    kind: "route",
    level: "error",
    extra: { kind: row.kind, prospectId: row.prospect_id, accountId: row.account_id, orderId: row.order_id },
  });
  return { ok: false, error: `The sales attribution could not be written: ${error.message}` };
}

/** On conversion: the account is credited to the rep who owned the company, or who converted it. */
export async function attributeConversion(prospectId: string, db: Db | null = supabaseAdmin()): Promise<AttributionResult> {
  if (!db) return { ok: false, error: "The database is not configured, so the account was not attributed." };
  const { data, error } = await db
    .from("eng_prospects")
    .select("id, owner_id, converted_by, converted_account_id")
    .eq("id", prospectId)
    .maybeSingle();
  if (error) return { ok: false, error: `The converted prospect could not be read for its attribution: ${error.message}` };
  const p = data as ProspectForCredit | null;
  if (!p?.converted_account_id) return { ok: true, attributed: "not_from_a_prospect" };
  return insertRow(
    db,
    { kind: "account_opened", prospect_id: p.id, account_id: p.converted_account_id, order_id: null, rep_id: creditedRep(p) },
    "crm.attribution.conversion",
  );
}

/** On each order for an account: credited when the account came from a prospect, and only then. */
export async function attributeOrder(orderId: string, accountId: string | null, db: Db | null = supabaseAdmin()): Promise<AttributionResult> {
  if (!accountId) return { ok: true, attributed: "not_from_a_prospect" };
  if (!db) return { ok: false, error: "The database is not configured, so the order was not attributed." };
  const { data, error } = await prospectForAccount(db, accountId);
  if (error) return { ok: false, error: `The account's prospect could not be read for the order's attribution: ${error.message}` };
  const p = data as ProspectForCredit | null;
  if (!p) return { ok: true, attributed: "not_from_a_prospect" };
  return insertRow(
    db,
    { kind: "order", prospect_id: p.id, account_id: accountId, order_id: orderId, rep_id: creditedRep(p) },
    "crm.attribution.order",
  );
}
