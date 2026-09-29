import { NextResponse, type NextRequest } from "next/server";
import { business } from "@/config/business";
import { issueResetForAccount, recordLinkEmailQueued } from "@/lib/account-creation";
import { VERIFICATION_TTL_WORDS } from "@/lib/account-doors";
import { emailRefusal, normaliseAddress } from "@/lib/email-address";
import { passwordReset } from "@/lib/email-templates";
import { queueEmail } from "@/lib/ops-jobs";
import { clientKey, takeResetAttempt } from "@/lib/ops-rate-limit";

export const dynamic = "force-dynamic";

/**
 * THE WAY BACK IN.
 *
 * Until 2026-09-29 there was not one. `reset_password` had been a declared
 * token purpose since the table was written and nothing anywhere minted one, so
 * a customer who forgot their password could not get back into the account they
 * had bought through, and nobody at the firm could send them a link either. The
 * capability was declared, never issued, and invisible from every direction
 * because the type compiled and the screen it would have led to worked.
 *
 * ONE ANSWER, WHATEVER HAPPENS
 * ----------------------------
 * This route answers identically whether the address holds an account, holds a
 * suspended one, holds none at all, or was refused by the rate limit. The
 * reasoning is written out at length on /api/account/sign-up and is the same
 * here with one addition that makes it sharper: a reset form is the one place
 * where answering honestly would hand over a customer list, because "that
 * address has no account" is a complete answer to the question an attacker is
 * actually asking.
 *
 *   holds an account    a reset link is mailed to it
 *   suspended           NOTHING is sent, because a closed account is not
 *                       reopened by a door somebody else chose
 *   no account          nothing happens, and nothing is said
 *   rate limited        nothing at all
 *
 * NO SESSION IS ISSUED AND NO PASSWORD IS CHANGED HERE. This route mints a link
 * and hands an email to the queue. Everything else happens at
 * /account/set-password, which already spends a token conditionally on it being
 * unspent, so two requests racing the same link cannot both set a password.
 *
 * THE GATE IS NOT READ HERE, AND THAT IS DELIBERATE.
 * ---------------------------------------------------
 * /api/account/sign-up refuses with a 404 when `selfServiceSignUpOpen()` is
 * false, because that condition is about whether the firm is accepting NEW
 * self service accounts. This is not a new account. It is a person who already
 * holds one, created through whichever door the firm chose, needing to get back
 * into it. Gating recovery on the sign up condition would mean the operator
 * closing public sign up silently locked every existing customer out of their
 * own password, which is not what that condition says and is not what anybody
 * would intend by setting it.
 */

/** The one sentence this route says whenever it has not refused the input. */
const SENT =
  "Check your email. If that address has an account here, a link to set a new password is on its way.";

function setPasswordUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  return `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(token)}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";

  /*
   * THE HONEYPOT ANSWERS WITH SUCCESS, as /api/lead and /api/account/sign-up
   * both do and for the reason recorded there: a bot told it failed learns, and
   * a bot told it succeeded goes away. The field is off screen and a person
   * cannot fill it.
   */
  if (typeof body?.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, message: SENT });
  }

  /*
   * THE SHAPE OF THE ADDRESS IS THE ONE THING ANSWERED PLAINLY, and it reveals
   * nothing: whether a string is a well formed address is a fact about the
   * string rather than about this firm's customers. Somebody who mistyped their
   * own address has to be told, or this form is a black hole for exactly the
   * people it exists to serve.
   */
  const refusal = emailRefusal(email);
  if (refusal) {
    return NextResponse.json({ ok: false, error: refusal }, { status: 400 });
  }

  const address = normaliseAddress(email);

  if (!takeResetAttempt(address, clientKey(request.headers))) {
    return NextResponse.json({ ok: true, message: SENT });
  }

  const issued = await issueResetForAccount(address);

  /*
   * NULL COVERS THREE DIFFERENT STATES AND THIS ROUTE CANNOT TELL THEM APART,
   * which is the design rather than a limitation. No account, a suspended
   * account, and a database that refused all return null, so there is no branch
   * here that could leak a difference even by accident.
   *
   * The cost is real and is accepted: a genuine outage looks to the person like
   * a successful request. That is the right trade for a public form whose other
   * failure mode is publishing a customer list, and the outage is visible where
   * outages belong, in the error log and on the queue.
   */
  if (issued) {
    const queued = await queueEmail(
      passwordReset({
        customerName: issued.displayName || "Hello",
        customerEmail: address,
        requestedBy: "customer",
        link: setPasswordUrl(issued.token),
        expiresIn: VERIFICATION_TTL_WORDS,
      }),
    );
    await recordLinkEmailQueued(issued.customerUserId, queued, "password reset");
  }

  return NextResponse.json({ ok: true, message: SENT });
}
