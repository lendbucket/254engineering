import { NextResponse, after } from "next/server";
import { randomUUID } from "node:crypto";
import { business } from "@/config/business";
import { accountWelcome, rooferApplicationNotice, rooferApplicationReceived } from "@/lib/email-templates";
import { createCustomerAccount, issueLinkForExistingAccount, recordLinkEmailQueued } from "@/lib/account-creation";
import { VERIFICATION_TTL_WORDS, doorFor } from "@/lib/account-doors";
import { emailRefusal, normaliseAddress } from "@/lib/email-address";
import { queueEmail } from "@/lib/ops-jobs";
import { clientKey, takeSignUpAttempt } from "@/lib/ops-rate-limit";
import { selfServiceSignUpClosedSentence, selfServiceSignUpOpen } from "@/lib/launch";
import { takeRooferApplication } from "@/lib/ops-roofer-applications";
import { PUBLIC_FORM_REFUSAL, takePublicFormAttempt } from "@/lib/public-form-limits";
import { rooferFieldErrors, rooferSignUpSchema } from "@/lib/roofer-application";
import { withSaveOutcome } from "@/lib/save-outcome";

/**
 * STEP ONE OF THE ROOFING PARTNER SIGN UP: THE ACCOUNT OPENS. Robert's rework
 * of 2026-11-06, migration 0117.
 *
 * Company, owner, email and phone. On submit a door 1 account opens, exactly
 * as /api/account/sign-up opens one, and the roofer application is written
 * against it with its roofer prospect and due now review, in one transaction
 * (eng_take_roofer_application). The email link proves the address and sets
 * the password (0043), and lands them signed in on their status card.
 *
 * DOOR 1'S RULES, ALL OF THEM, because this IS door 1:
 *   - the self service sign up condition is checked here, not only on the page;
 *   - one answer whatever the address: a new address opens an account, an
 *     address that already has one is left exactly as it is and sent a fresh
 *     link, and the rate limit refuses silently, so nothing here tells anybody
 *     who the firm's customers are;
 *   - no session is issued: the link is the only way in.
 * An address that already holds an account gets no application written, so a
 * stranger cannot attach a partner review to somebody else's account.
 *
 * NOTHING HERE DECIDES ANYTHING. A person approves every partner on
 * /portal/roofer-applications; partner pricing and ordering wait on that.
 */

const SENT =
  "Check your email. If that address can have an account here, a link to set your password and sign in is on its way.";

function setPasswordUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || business.url;
  return `${base.replace(/\/$/, "")}/account/set-password?token=${encodeURIComponent(token)}`;
}

async function handlePOST(request: Request) {
  if (!selfServiceSignUpOpen()) {
    return NextResponse.json({ ok: false, message: selfServiceSignUpClosedSentence() }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const parsed = rooferSignUpSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: rooferFieldErrors(parsed.error) }, { status: 422 });
  }
  const data = parsed.data;
  /* The honeypot answers with success, as door 1 does: a bot told it failed learns. */
  if (data.website) return NextResponse.json({ ok: true, message: SENT });

  const refusal = emailRefusal(data.email);
  if (refusal) return NextResponse.json({ ok: false, errors: { email: refusal } }, { status: 422 });
  const address = normaliseAddress(data.email);

  if (!(await takePublicFormAttempt("roofer", request.headers, address)).allowed) {
    return NextResponse.json({ ok: false, message: PUBLIC_FORM_REFUSAL }, { status: 429 });
  }
  /* Door 1's own per address limit, refused exactly as a success reads. */
  if (!takeSignUpAttempt(address, clientKey(request.headers))) {
    return NextResponse.json({ ok: true, message: SENT });
  }

  const created = await createCustomerAccount({
    email: address,
    displayName: data.ownerName,
    organisation: data.legalName,
    phone: data.phone,
    origin: doorFor("self_service").origin,
    actor: null,
  });

  if (!created.ok && created.error === "already_exists") {
    /* Left exactly as it is, and a fresh link goes to it; no application is attached. */
    const issued = await issueLinkForExistingAccount(address);
    if (issued) {
      const queued = await queueEmail(
        accountWelcome({
          customerName: issued.displayName || data.ownerName,
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
    return NextResponse.json(
      { ok: false, message: "Your partner account could not be opened, so nothing was saved. Please try again in a few minutes, or call the firm." },
      { status: 503 },
    );
  }

  const applicationId = randomUUID();
  const saved = await takeRooferApplication(
    { ...data, email: address, applicationId, accountId: created.accountId },
    { userAgent: request.headers.get("user-agent") },
  );
  if (!saved.ok) {
    /* The account is open and its link still goes out; the review is written by hand if this ever fails, and the firm is told. */
    console.error(`[roofer-application] account ${created.accountId} opened and its application not written: ${saved.error}`);
  }

  const link = created.link;
  after(async () => {
    if (link) {
      const welcome = await queueEmail(
        rooferApplicationReceived({ ownerName: data.ownerName, email: address, link: setPasswordUrl(link.token), expiresIn: link.expiresIn }),
      );
      await recordLinkEmailQueued(created.customerUserId, welcome);
    }
    const notice = await queueEmail(
      rooferApplicationNotice({
        legalName: data.legalName,
        ownerName: data.ownerName,
        rows: [
          ["Owner", data.ownerName],
          ["Email", address],
          ["Phone", data.phone],
          ["Application", saved.ok ? "Written; the profile fills in as they finish it" : `NOT WRITTEN: ${saved.error}`],
        ],
        reviewUrl: saved.ok
          ? `${business.url}/portal/roofer-applications?id=${saved.applicationId}`
          : `${business.url}/portal/roofer-applications`,
      }),
    );
    if (!notice.ok) console.error(`[roofer-application] firm notice not queued: ${notice.error}`);
  });

  return NextResponse.json({ ok: true, message: SENT });
}

/* A save abandoned by the 20 second bound says it may not have saved: save-outcome.ts. */
export const POST = withSaveOutcome(handlePOST);
