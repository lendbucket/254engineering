import { NextResponse, type NextRequest } from "next/server";
import { business } from "@/config/business";
import { createCustomerAccount } from "@/lib/account-creation";
import { VERIFICATION_TTL_WORDS, doorFor } from "@/lib/account-doors";
import { accountWelcome } from "@/lib/email-templates";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { queueEmail } from "@/lib/ops-jobs";

export const dynamic = "force-dynamic";

/**
 * THE OPERATOR DOOR.
 *
 * Somebody telephones who is not yet a customer, and the operator opens an
 * account from the call. No order is attached, because there may never be one:
 * the whole point of this door is that the relationship starts before the work
 * does.
 *
 * IT IS ITS OWN ROUTE RATHER THAN AN ACTION ON THE ACCOUNTS ROUTE.
 *
 * The neighbouring route manages accounts that exist: closing a period,
 * issuing a statement, setting terms. Creating one is a different act with a
 * different failure mode, it is the one thing there that would write into
 * three tables, and the door registry names one route per door so that
 * "which code can create an account" has an answer somebody can read. Folding
 * it in as a fourth action would make that answer "grep".
 *
 * THE OPERATOR NEVER SETS A PASSWORD, AND CANNOT.
 *
 * createCustomerAccount issues a set password link and returns the token; it
 * has no parameter for a password and no branch that writes one. So there is
 * no version of this call where a member of staff knows a customer's
 * credential, and the customer chooses it by opening mail sent to their own
 * address, which proves the address as a side effect.
 *
 * That is why this door does not require the address to be proven before the
 * account may act: it already is, by the time anybody can sign in. The
 * difference from self service is who made the claim, not how strong it is.
 *
 * WHY THE ADDRESS IS NOT CHECKED AGAINST EXISTING ACCOUNTS SILENTLY HERE.
 *
 * The self service door answers identically whether an address is taken,
 * because the person asking is a stranger. An operator is not a stranger, is
 * looking at the account list, and is on the telephone with somebody waiting.
 * Telling them plainly that the address already has an account is the useful
 * answer and reveals nothing to anybody who was not already trusted with the
 * whole list.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  if (!can(actor, "accounts.manage")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const door = doorFor("operator_created");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const displayName = typeof body?.name === "string" ? body.name : "";
  const organisation = typeof body?.organisation === "string" ? body.organisation : null;
  const phone = typeof body?.phone === "string" ? body.phone : null;

  const created = await createCustomerAccount({
    email,
    displayName,
    organisation: organisation?.trim() || null,
    phone: phone?.trim() || null,
    origin: door.origin,
    /*
     * NAMED, because a person did this. The audit row says which member of
     * staff opened the account, which is the question asked afterwards about
     * every account that was not opened by its own holder.
     */
    actor: { id: actor.id, email: actor.email, role: actor.role },
  });

  if (!created.ok) {
    return NextResponse.json(
      {
        ok: false,
        error:
          created.error === "already_exists"
            ? "That address already has an account. Open it from the account list rather than making a second one."
            : created.error,
      },
      { status: 400 },
    );
  }

  if (created.link) {
    const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
    await queueEmail(
      accountWelcome({
        customerName: displayName.trim(),
        customerEmail: email.trim().toLowerCase(),
        origin: "operator_created",
        link: `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(created.link.token)}`,
        expiresIn: created.link.expiresIn ?? VERIFICATION_TTL_WORDS,
      }),
    );
  }

  /*
   * THE TOKEN IS NOT RETURNED TO THE OPERATOR'S SCREEN.
   *
   * It would be convenient: the operator is on the telephone and could read the
   * link out. It is also a credential that opens the account, and putting it on
   * a staff screen makes every future screenshot, support ticket and shoulder a
   * way in. The mail is the channel, and it goes to the address being claimed,
   * which is the whole mechanism.
   */
  return NextResponse.json({
    ok: true,
    accountId: created.accountId,
    customerUserId: created.customerUserId,
    message: `The account is open and a set password link has been emailed. It lasts ${VERIFICATION_TTL_WORDS}.`,
  });
}
