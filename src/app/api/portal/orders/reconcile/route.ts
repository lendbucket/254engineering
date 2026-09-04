import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { writeAudit } from "@/lib/ops-audit";
import { reconcileAll } from "@/lib/ops-reconcile";
import { enqueue } from "@/lib/ops-jobs";

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
 *
 * THE READ STAYS IN THE REQUEST, THE APPLYING SWEEP LEAVES
 * --------------------------------------------------------
 * The read only run IS the report the operator opened this screen to read, so
 * queueing it would be queueing the answer to the question being asked. The
 * applying run is different: it walks every pending order, asks Stripe about
 * each one and records what it finds, and nobody needs to hold a browser open
 * for that. It goes on the queue and the operator reads the result from the
 * read only run afterwards.
 *
 * Running the applying sweep twice is harmless by construction, which is why
 * orders.reconcile is the one job kind that declares itself naturally
 * idempotent: markPaid dedupes on the provider's charge ref, so a second sweep
 * finds the charge already on file and writes nothing.
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

  if (apply) {
    const queued = await enqueue("orders.reconcile", { apply: true, references: references ?? null });
    if (!queued.ok) {
      return NextResponse.json({ ok: false, error: queued.error }, { status: 503 });
    }

    /*
     * Audited at the moment it was ASKED FOR, naming the person who asked,
     * because that is the fact a dispute needs and the job itself has no actor.
     * What the sweep then found is on the order's own record.
     */
    await writeAudit({
      actor: { id: g.actor.id, role: g.actor.role, email: g.actor.email },
      action: "orders.reconcile_applied",
      entityType: "service_order",
      entityId: null,
      summary: references?.length
        ? `Queued an applying reconciliation of ${references.length} named order(s)`
        : "Queued an applying reconciliation of every order awaiting payment",
    });

    return NextResponse.json({ ok: true, queued: true, duplicate: queued.duplicate });
  }

  const report = await reconcileAll({ apply: false, references });

  /*
   * Audited whether or not anything changed, because "an admin asked the
   * provider about these orders and it said nothing was wrong" is exactly the
   * fact somebody will want on record if a customer disputes it later.
   */
  await writeAudit({
    actor: { id: g.actor.id, role: g.actor.role, email: g.actor.email },
    action: "orders.reconcile_read",
    entityType: "service_order",
    entityId: null,
    summary: `Read ${report.examined} order(s) against ${report.provider}, changed nothing`,
  });

  return NextResponse.json({ ok: true, ...report });
}
