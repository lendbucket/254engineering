import { NextResponse, type NextRequest } from "next/server";
import { currentActor, requestContext } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { setAccountTerms } from "@/lib/ops-accounts-admin";
import { closePeriod, issuableStatement, periodKey } from "@/lib/ops-statements";
import { enqueue } from "@/lib/ops-jobs";
import { supabaseAdmin } from "@/lib/supabase";
import { writeAudit } from "@/lib/ops-audit";
import { withSaveOutcome } from "@/lib/save-outcome";

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

async function handlePOST(request: NextRequest) {
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

    /*
     * THE TERMS GO THROUGH setAccountTerms, Robert's ruling of 10:52 Central
     * 2026-10-29 (254-WF-022 step 3): the password re-entered, the record
     * written before the change, both sides of every field in it, and money in
     * whole cents with nothing rounded. This branch used to patch billing_mode,
     * credit_limit_cents (through Math.round) and net_days itself and record it
     * afterwards; that path is gone, so there is one way to change terms.
     *
     * A credit limit of null is NO credit, and clearing it is a real action
     * rather than an omission: an explicit null clears, an absent field is left
     * alone.
     */
    const termsFields = ["billingMode", "creditLimitCents", "netDays"].filter((k) => body && k in body);
    let termsChanged: string[] = [];
    if (termsFields.length > 0) {
      const set = await setAccountTerms(
        g.actor,
        accountId,
        {
          billingMode: body?.billingMode,
          creditLimitCents: body?.creditLimitCents,
          netDays: body?.netDays,
          password: body?.password,
        },
        await requestContext(),
      );
      if (!set.ok) {
        return NextResponse.json({ ok: false, error: set.error, field: set.field }, { status: set.status });
      }
      termsChanged = set.changed;
    }

    const patch: Record<string, unknown> = {};

    if (body?.status === "active" || body?.status === "suspended" || body?.status === "closed") {
      patch.status = body.status;
      if (body.status === "suspended") {
        patch.suspended_reason = typeof body?.reason === "string" ? body.reason : null;
      }
    }

    if (Object.keys(patch).length === 0) {
      if (termsChanged.length > 0) return NextResponse.json({ ok: true, changed: termsChanged });
      return NextResponse.json({ ok: false, error: "Nothing to change." }, { status: 400 });
    }

    const { error } = await db.from("eng_customer_accounts").update(patch).eq("id", accountId);
    if (error) return NextResponse.json({ ok: false, error: "That could not be saved." }, { status: 400 });

    /*
     * A SUSPENSION IS ITS OWN EVENT, NAMING WHO DID IT. Operator ruling of
     * 2026-09-29, and closing too since 2026-10-07: the triggers in 0063,
     * with 0064's function, are the guarantee that every live link
     * for the account's users is spent, and it cannot know who suspended; this
     * row is the record with the actor. Read beside the trigger's own
     * customer_links.spent_at_suspension event for the same account.
     */
    await writeAudit({
      actor: { id: g.actor.id, role: g.actor.role, email: g.actor.email },
      action:
        patch.status === "suspended"
          ? "account.suspended"
          : patch.status === "closed"
            ? "account.closed"
            : /* A status set back to active. Not account.terms_changed, which since
               * 2026-10-29 is the password-confirmed record setAccountTerms writes. */
              "account.status_changed",
      entityType: "customer_account",
      entityId: accountId,
      summary:
        patch.status === "suspended"
          ? `${g.actor.email} suspended the account${patch.suspended_reason ? `: ${String(patch.suspended_reason)}` : ""}`
          : patch.status === "closed"
            ? `${g.actor.email} closed the account`
            : `${g.actor.email} changed ${Object.keys(patch).join(", ")}`,
    });

    return NextResponse.json({ ok: true, changed: [...termsChanged, "status"] });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
