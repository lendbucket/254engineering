import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { closePeriod, issuableStatement, periodKey } from "@/lib/ops-statements";
import { enqueue } from "@/lib/ops-jobs";
import { supabaseAdmin } from "@/lib/supabase";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * The operator's side of customer accounts.
 *
 * Closing a period and issuing a statement are the two acts that turn work into
 * a bill, and both are admin only. Setting terms is here too, because a credit
 * limit is the firm deciding how much it is willing to be owed.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * No dunning, no reminders, no automatic suspension, no late fee. The operator
 * ruled that the state is made visible and nothing chases it. The only automatic
 * consequence of an overdue statement anywhere in this platform is that
 * creditDecision stops further invoiced ordering.
 */

async function guard() {
  const actor = await currentActor();
  if (!actor) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 }) };
  }
  if (!can(actor, "accounts.manage")) {
    return { error: NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 }) };
  }
  return { actor };
}

export async function POST(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";

  if (action === "close-period") {
    if (!accountId) return NextResponse.json({ ok: false, error: "Which account?" }, { status: 400 });
    const period = typeof body?.period === "string" && body.period ? body.period : periodKey();
    const result = await closePeriod(accountId, period, { actorEmail: g.actor.email });
    return result.ok
      ? NextResponse.json({
          ok: true,
          statementId: result.statementId,
          reference: result.reference,
          lines: result.lines,
          totalCents: result.totalCents,
          alreadyExisted: result.alreadyExisted,
        })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  /*
   * ISSUING LEAVES THE REQUEST. CLOSING DOES NOT.
   *
   * Closing a period is a read and a set of inserts against this database, and
   * the operator is looking at the result: the line count and the total are the
   * whole reason close and issue are two actions rather than one. So it stays.
   *
   * Issuing sends the statement to the customer, which means a mail provider,
   * and nobody pressing "issue" needs to watch that happen. The refusal cases
   * that matter to the operator, a statement that does not exist or is already
   * issued, are still answered here rather than discovered on the queue, so the
   * button still tells the truth about whether the action was accepted.
   */
  if (action === "issue-statement") {
    const statementId = typeof body?.statementId === "string" ? body.statementId : "";
    if (!statementId) return NextResponse.json({ ok: false, error: "Which statement?" }, { status: 400 });

    /*
     * Asked and answered before it is queued. issuableStatement is the same
     * function the job runs, so the refusals the operator sees here are exactly
     * the refusals the job would produce, and pressing the button on a
     * statement that is already issued still says so rather than succeeding
     * into a queue.
     */
    const eligible = await issuableStatement(statementId);
    if (!eligible.ok) {
      return NextResponse.json({ ok: false, error: eligible.error }, { status: 400 });
    }

    const queued = await enqueue("statement.issue", { statementId });
    if (!queued.ok) {
      return NextResponse.json({ ok: false, error: queued.error }, { status: 503 });
    }
    return NextResponse.json({
      ok: true,
      queued: true,
      duplicate: queued.duplicate,
      reference: eligible.statement.reference,
    });
  }

  if (action === "set-terms") {
    if (!accountId) return NextResponse.json({ ok: false, error: "Which account?" }, { status: 400 });
    const db = supabaseAdmin();
    if (!db) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 503 });

    const patch: Record<string, unknown> = {};

    if (body?.billingMode === "card" || body?.billingMode === "invoice") {
      patch.billing_mode = body.billingMode;
    }

    /*
     * A credit limit of null is NO credit, and clearing it is a real action
     * rather than an omission. So an explicit null clears, an absent field is
     * left alone, and a negative number is refused rather than stored.
     */
    if (body && "creditLimitCents" in body) {
      const raw = body.creditLimitCents;
      if (raw === null) patch.credit_limit_cents = null;
      else if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        patch.credit_limit_cents = Math.round(raw);
      } else {
        return NextResponse.json(
          { ok: false, error: "A credit limit is a whole number of cents, or null for no credit." },
          { status: 400 },
        );
      }
    }

    if (typeof body?.netDays === "number" && body.netDays >= 0 && body.netDays <= 120) {
      patch.net_days = Math.round(body.netDays);
    }

    if (body?.status === "active" || body?.status === "suspended" || body?.status === "closed") {
      patch.status = body.status;
      if (body.status === "suspended") {
        patch.suspended_reason = typeof body?.reason === "string" ? body.reason : null;
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
    }

    const { error } = await db.from("eng_customer_accounts").update(patch).eq("id", accountId);
    if (error) return NextResponse.json({ ok: false, error: "That could not be saved." }, { status: 400 });

    await writeAudit({
      actor: { id: g.actor.id, role: g.actor.role, email: g.actor.email },
      action: "account.terms_changed",
      entityType: "customer_account",
      entityId: accountId,
      summary: `${g.actor.email} changed ${Object.keys(patch).join(", ")}`,
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
