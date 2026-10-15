import { NextResponse, type NextRequest } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { startStatementCheckout } from "@/lib/ops-statements";
import { supabaseAdmin } from "@/lib/supabase";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * Paying a statement, through the same Stripe path everything else uses.
 *
 * The statement is verified to belong to this account BEFORE a checkout is
 * created, and in the query rather than after loading, so a reference from
 * another organisation matches nothing rather than being fetched and then
 * hidden.
 */
async function handlePOST(request: NextRequest) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action !== "pay") {
    return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }

  const statementId = typeof body?.statementId === "string" ? body.statementId : "";
  if (!statementId) {
    return NextResponse.json({ ok: false, error: "Which statement?" }, { status: 400 });
  }

  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });

  const { data: mine } = await db
    .from("eng_statements")
    .select("id")
    .eq("id", statementId)
    .eq("account_id", me.accountId)
    .maybeSingle();

  if (!mine) {
    return NextResponse.json(
      { ok: false, error: "That statement is not on this account." },
      { status: 404 },
    );
  }

  const result = await startStatementCheckout(statementId);
  return result.ok
    ? NextResponse.json({ ok: true, checkoutUrl: result.url })
    : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
