import { NextResponse, type NextRequest } from "next/server";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { setTradePrice } from "@/lib/trade-pricing";

export const dynamic = "force-dynamic";

/**
 * SETTING A TRADE PRICE FOR ONE ACCOUNT.
 *
 * GATED ON pricing.write, NOT ON accounts.manage.
 *
 * The neighbouring routes manage an account's terms, credit and statements.
 * Deciding what an account is CHARGED is a different act, and separating the
 * two means a firm can have somebody who sets terms without being able to
 * discount, which is the shape roles.manage already has against profiles.update.
 *
 * THERE IS NO FLOOR PARAMETER AND THERE IS NO OVERRIDE PARAMETER.
 *
 * Not because they are rejected, but because they do not exist: the body this
 * route reads has four fields and none of them is a floor. The operator's rule
 * is that a floor is theirs and is never supplied at quote time, and the
 * strongest form of that is a route with nowhere to put one.
 *
 * EVERY REFUSAL IS setTradePrice's OWN SENTENCE, passed through unchanged.
 *
 * A route that rewrote the refusal would be a second account of why a price was
 * refused, and the one that reaches the operator would be the one nobody
 * updates when a floor changes. The refusal names the floor, who ruled it, when,
 * and why, because a refusal that says only "too low" sends somebody to ask the
 * operator what the number is.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  if (!can(actor, "pricing.write")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const accountId = typeof body?.accountId === "string" ? body.accountId : "";
  const serviceSlug = typeof body?.serviceSlug === "string" ? body.serviceSlug : "";
  const tier = typeof body?.tier === "string" ? body.tier : "";
  const priceCents = typeof body?.priceCents === "number" ? body.priceCents : NaN;

  if (!accountId || !serviceSlug || !tier) {
    return NextResponse.json(
      { ok: false, error: "Which account, and which service?" },
      { status: 400 },
    );
  }

  const result = await setTradePrice({
    accountId,
    serviceSlug,
    tier,
    priceCents,
    actor: { id: actor.id, email: actor.email, role: actor.role },
  });

  if (!result.ok) {
    /*
     * 400 for every refusal, including a floor refusal.
     *
     * Deliberately NOT 403 for the floor. A 403 says "you are not allowed to do
     * this", which invites the question of who is, and the answer is nobody at
     * any role. The price is wrong rather than the person, and the status says
     * so.
     */
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    superseded: result.supersededId,
    message: result.supersededId
      ? "The price is set, and the previous one is kept as the price its orders were quoted under."
      : "The price is set.",
  });
}
