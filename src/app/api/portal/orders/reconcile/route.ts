import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { reconcileAll } from "@/lib/ops-reconcile";

export const dynamic = "force-dynamic";

/**
 * Ask the payment provider what became of the orders still waiting on payment.
 *
 * WHY THIS IS A ROUTE AND NOT A SCRIPT
 * ------------------------------------
 * The Stripe keys live in the deployment's environment and nowhere else, which
 * is deliberate and is not going to change. A local script cannot reach Stripe,
 * so a reconciler that only exists as a script is a reconciler that can only be
 * run by putting a production key on somebody's laptop.
 *
 * IT READS UNLESS TOLD OTHERWISE
 * ------------------------------
 * `apply` defaults to false. The read only run is the one an operator should
 * look at first, and it answers the question that matters (did anybody pay for
 * something they never got) without writing anything at all.
 *
 * A GET is the read only run, and cannot apply whatever it is asked, because a
 * request that changes money should not be something a browser can be tricked
 * into making by following a link.
 */

async function guard() {
  const actor = await currentActor();
  if (!actor) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 }) };
  }
  if (!can(actor, "payments.reconcile")) {
    return { error: NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 }) };
  }
  return { actor };
}

export async function GET() {
  const g = await guard();
  if (g.error) return g.error;

  const report = await reconcileAll({ apply: false });
  return NextResponse.json({ ok: true, ...report });
}

export async function POST(request: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const apply = body?.apply === true;

  /*
   * References narrow the sweep. Naming the orders is how the first real run of
   * this was done, and it stays available because settling three known orders
   * is a different act from settling everything the sweep happens to find.
   */
  const references = Array.isArray(body?.references)
    ? (body.references as unknown[]).filter((r): r is string => typeof r === "string")
    : undefined;

  const report = await reconcileAll({ apply, references });

  /*
   * Audited whether or not anything changed, because "an admin asked the
   * provider about these orders and it said nothing was wrong" is exactly the
   * fact somebody will want on record if a customer disputes it later.
   */
  const changed = report.findings.filter((f) => f.action === "recorded_payment" || f.action === "cancelled");
  await writeAudit({
    actor: { id: g.actor.id, role: g.actor.role, email: g.actor.email },
    action: apply ? "orders.reconcile_applied" : "orders.reconcile_read",
    entityType: "service_order",
    entityId: null,
    summary: apply
      ? `Reconciled ${report.examined} order(s) against ${report.provider}: ${changed.length} changed`
      : `Read ${report.examined} order(s) against ${report.provider}, changed nothing`,
  });

  return NextResponse.json({ ok: true, ...report });
}
