import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { attachOrderToAccount } from "@/lib/ops-payments";
import { withSaveOutcome } from "@/lib/save-outcome";

export const dynamic = "force-dynamic";

/**
 * Attach a paid order to an account, and finish its payment's release.
 *
 * Operator ruling, 2026-10-13: an existing client paying from a new address is
 * matched by the order's client record; where no match is safe, nothing is
 * opened, the payment shows as "Paid, work not released", and a person
 * attaches the account with one click. This is that click.
 *
 * accounts.manage, because attaching decides who can sign in and see the
 * order. The account must be one the order offers (its client's, or the
 * paying address's); attachOrderToAccount refuses any other, and refuses an
 * order that already has one. POST only: a GET that attached an order would be
 * a link somebody could be tricked into following.
 */
async function handlePOST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  if (!can(actor, "accounts.manage")) return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = typeof body?.orderId === "string" ? body.orderId : "";
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  if (!orderId || !accountId) {
    return NextResponse.json({ ok: false, error: "Name the order and the account. Nothing was changed." }, { status: 400 });
  }

  const result = await attachOrderToAccount(actor, orderId, accountId);
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, released: result.released, note: result.note });
}

/* A save abandoned by the 20 second bound says it may not have saved, and a failed session read is never "Not signed in": save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
