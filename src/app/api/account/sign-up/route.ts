import { NextResponse, type NextRequest } from "next/server";
import { business } from "@/config/business";
import { createCustomerAccount, issueLinkForExistingAccount, recordLinkEmailQueued } from "@/lib/account-creation";
import { VERIFICATION_TTL_WORDS, doorFor } from "@/lib/account-doors";
import { emailRefusal, normaliseAddress } from "@/lib/email-address";
import { accountWelcome } from "@/lib/email-templates";
import { queueEmail } from "@/lib/ops-jobs";
import { clientKey, takeSignUpAttempt } from "@/lib/ops-rate-limit";
import { selfServiceSignUpClosedSentence, selfServiceSignUpOpen } from "@/lib/launch";

/**
 * THE SELF SERVICE DOOR.
 *
 * A person creates an account with an address of their own, and proves that
 * address before the account can do anything. It is the only one of the three
 * doors opened by somebody nobody at this firm has spoken to, and every
 * decision below follows from that.
 *
 * ONE ANSWER, WHATEVER HAPPENS
 * ----------------------------
 * This route answers identically whether the address is new, already holds an
 * account, or was refused by the rate limit. Every other shape is an oracle: a
 * form that says "that address already has an account" tells anybody who asks
 * which addresses are customers of this firm, one request at a time, and a form
 * that says "too many attempts" only for addresses that exist is the same
 * oracle with a delay attached.
 *
 * So there is one sentence, and what happens behind it differs:
 *
 *   new address       an account is created and a set password link is mailed
 *   existing address  NOTHING is created, and a fresh link is mailed to the
 *                     account that already exists, so the person who owns it
 *                     gets what they came for and the person who does not
 *                     learns nothing
 *   rate limited      nothing at all
 *
 * The middle case is what makes the identical answer honest rather than merely
 * unhelpful. Somebody who genuinely forgot they had signed up is the most
 * likely person to hit it.
 *
 * THE ACCOUNT CANNOT ACT UNTIL THE ADDRESS IS PROVEN, and that is a check
 * constraint in 0043 rather than a rule in this file. A rule here holds only
 * until somebody writes a second route.
 *
 * NO SESSION IS ISSUED HERE. Signing up is not signing in. The link is the only
 * way forward, so an account can never be reached by somebody who merely typed
 * an address they do not own.
 */

/** The one sentence this route says whenever it has not refused the input. */
const SENT =
  "Check your email. If that address can have an account here, a link to finish setting it up is on its way.";

function setPasswordUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  return `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(token)}`;
}

export async function POST(request: NextRequest) {
  /*
   * THE LAUNCH CONDITION IS CHECKED HERE, NOT ONLY ON THE SCREEN.
   *
   * The eighth condition says this door does not reach production until the
   * operator lifts it. A screen that hides the form is a screen; this is what
   * somebody who reads HTML and posts to the route has to get past, and it is
   * therefore where the condition actually holds.
   *
   * 404 rather than 403, because a door that is not open should not advertise
   * that it exists and is merely shut.
   */
  if (!selfServiceSignUpOpen()) {
    return NextResponse.json({ ok: false, error: selfServiceSignUpClosedSentence() }, { status: 404 });
  }

  const door = doorFor("self_service");

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const displayName = typeof body?.name === "string" ? body.name : "";
  const organisation = typeof body?.organisation === "string" ? body.organisation : null;
  const phone = typeof body?.phone === "string" ? body.phone : null;

  /*
   * THE HONEYPOT ANSWERS WITH SUCCESS, exactly as /api/lead does and for the
   * reason recorded there: a bot told it failed learns, and a bot told it
   * succeeded goes away. The field is off screen and a person cannot fill it.
   */
  if (typeof body?.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, message: SENT });
  }

  /*
   * THE SHAPE OF THE ADDRESS IS THE ONE THING ANSWERED PLAINLY.
   *
   * Somebody who typed their address wrong has to be told, or this form is a
   * black hole for exactly the people it exists to serve. It reveals nothing:
   * whether a string is a well formed address is a fact about the string, not
   * about this firm's customers.
   */
  const refusal = emailRefusal(email);
  if (refusal) {
    return NextResponse.json({ ok: false, error: refusal }, { status: 400 });
  }
  if (!displayName.trim()) {
    return NextResponse.json(
      { ok: false, error: "Give us a name to put on the account." },
      { status: 400 },
    );
  }

  const address = normaliseAddress(email);

  /*
   * RATE LIMITED PER ADDRESS, and the refusal is indistinguishable from
   * success. The ceiling and the reasoning are in src/lib/account-doors.ts.
   */
  if (!takeSignUpAttempt(address, clientKey(request.headers))) {
    return NextResponse.json({ ok: true, message: SENT });
  }

  const created = await createCustomerAccount({
    email: address,
    displayName,
    organisation: organisation?.trim() || null,
    phone: phone?.trim() || null,
    origin: door.origin,
    /*
     * No actor. Nobody at this firm did this, and attributing it to a person
     * would be a false line in an append only trail. createCustomerAccount
     * records it against the system principal instead.
     */
    actor: null,
  });

  /*
   * ALREADY EXISTS IS NOT AN ERROR HERE. The account is left exactly as it is
   * and a fresh link goes to it, which is the only behaviour consistent with
   * the identical answer above.
   */
  if (!created.ok && created.error === "already_exists") {
    const issued = await issueLinkForExistingAccount(address);
    if (issued) {
      const queued = await queueEmail(
        accountWelcome({
          customerName: issued.displayName || displayName.trim(),
          customerEmail: address,
          origin: "self_service",
          link: setPasswordUrl(issued.token),
          expiresIn: VERIFICATION_TTL_WORDS,
        }),
      );
      await recordLinkEmailQueued(issued.customerUserId, queued);
    }
    return NextResponse.json({ ok: true, message: SENT });
  }

  if (!created.ok) {
    /*
     * A real failure, which is this platform's fault rather than the person's.
     * Saying so plainly is right: there is nothing here for anybody to learn
     * about who holds an account.
     */
    return NextResponse.json(
      { ok: false, error: "The account could not be created. Nothing was saved. Try again shortly." },
      { status: 503 },
    );
  }

  if (created.link) {
    const queued = await queueEmail(
      accountWelcome({
        customerName: displayName.trim(),
        customerEmail: address,
        origin: "self_service",
        link: setPasswordUrl(created.link.token),
        expiresIn: created.link.expiresIn,
      }),
    );
    await recordLinkEmailQueued(created.customerUserId, queued);
  }

  return NextResponse.json({ ok: true, message: SENT });
}
