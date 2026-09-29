import { NextResponse, type NextRequest } from "next/server";
import { business } from "@/config/business";
import { issueResetForAccount, recordLinkEmailQueued } from "@/lib/account-creation";
import { VERIFICATION_TTL_WORDS } from "@/lib/account-doors";
import { emailRefusal, normaliseAddress } from "@/lib/email-address";
import { passwordReset } from "@/lib/email-templates";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { queueEmail } from "@/lib/ops-jobs";
import { writeAudit } from "@/lib/ops-audit";

export const dynamic = "force-dynamic";

/**
 * SEND A CUSTOMER A PASSWORD RESET LINK, FROM THE OPERATOR'S SIDE.
 *
 * The customer is on the telephone saying they cannot get in. Before
 * 2026-09-29 there was nothing the operator could do: no code anywhere minted
 * a `reset_password` token for a customer, so the answer was to open a second
 * account or to give up.
 *
 * IT IS ITS OWN ROUTE, for the reason the neighbouring create route gives about
 * itself. The accounts route manages accounts that exist by closing periods,
 * issuing statements and setting terms. Mailing somebody a credential that
 * opens their account is a different act with a different failure mode, and the
 * question "which code can send a link into a customer's mailbox" should have
 * an answer a person can read rather than grep for.
 *
 * IT ANSWERS PLAINLY, AND THE PUBLIC ROUTE DOES NOT. That difference is
 * deliberate and is the same one the create route makes: the enumeration oracle
 * matters because the person asking is a stranger. An operator holding
 * `accounts.manage` is looking at the account list already, so telling them
 * that an address has no account reveals nothing they were not already trusted
 * with, and refusing to tell them would send them hunting for a typo they
 * cannot see.
 *
 * THE TOKEN IS NOT RETURNED TO THE OPERATOR'S SCREEN, exactly as on the create
 * route and for the same reason: it is a credential that opens the account, and
 * putting it on a staff screen makes every future screenshot and support ticket
 * a way in. The mail is the channel and it goes to the address on the account.
 *
 * A SUSPENDED ACCOUNT IS REFUSED, and here it is refused OUT LOUD. The public
 * route cannot say so without disclosing that the address exists. This one
 * should, because an operator who thinks they have just helped somebody and has
 * not is worse off than one who is told the account is closed and can decide
 * whether to reopen it.
 */
export async function POST(request: NextRequest) {
  const actor = await currentActor();
  if (!actor) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  if (!can(actor, "accounts.manage")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";

  const refusal = emailRefusal(email);
  if (refusal) {
    return NextResponse.json({ ok: false, error: refusal }, { status: 400 });
  }

  const address = normaliseAddress(email);
  const issued = await issueResetForAccount(address);

  if (!issued) {
    /*
     * THREE STATES ARRIVE HERE AS ONE null AND THE SENTENCE SAYS SO.
     *
     * `issueResetForAccount` cannot distinguish "no such address" from
     * "suspended" from "the database refused", because the public caller must
     * not be able to. Rather than guess which one it was and put a confident
     * wrong sentence on a staff screen, this names all three.
     *
     * That is the MFA lockout lesson applied before it costs anything: an error
     * assembled from a function that can only see some of the faults reports
     * the fault it cannot see as one it can. The honest answer here is the list.
     */
    return NextResponse.json(
      {
        ok: false,
        error:
          "No link was sent. Either that address has no customer account, or the account is suspended, or the account system did not answer. Check the address against the account list first.",
      },
      { status: 400 },
    );
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  const queued = await queueEmail(
    passwordReset({
      customerName: issued.displayName || "Hello",
      customerEmail: address,
      requestedBy: "firm",
      link: `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(issued.token)}`,
      expiresIn: VERIFICATION_TTL_WORDS,
    }),
  );
  await recordLinkEmailQueued(issued.customerUserId, queued, "password reset");

  /*
   * NAMED, because a person did this. `issueResetForAccount` writes a system
   * row saying a link was issued, which is all that function knows; this row
   * says WHICH member of staff caused it, which is the question asked
   * afterwards about every link that was not requested by its own holder.
   */
  await writeAudit({
    actor: { id: actor.id, role: actor.role, email: actor.email },
    action: "customer_account.reset_link_sent_by_staff",
    entityType: "customer_user",
    entityId: issued.customerUserId,
    summary: `${actor.email} sent a password reset link to ${address}. No password was changed.`,
  });

  if (!queued.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: `The link was issued but the email could not be queued, so nothing has been sent: ${queued.error}`,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ok: true,
    message: `A password reset link has been emailed to ${address}. It lasts ${VERIFICATION_TTL_WORDS} and works once. Their current password keeps working until they use it.`,
  });
}
