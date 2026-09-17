/**
 * WHAT IS REGISTERED IN THE STRIPE DASHBOARD, DECLARED.
 *
 * Operator ruling, 2026-09-16, built with the account consistency check.
 *
 * WHY A DECLARATION AND NOT JUST A LIVE CALL. This is the same split as
 * `supabase/applied.mjs` and its two readers, and it exists for the same
 * reason. Two facts are different facts:
 *
 *   `stripe-webhook-audit` asks "was somebody ASKED what is registered, and
 *   does it agree with the handler?" It needs no credentials and runs on the
 *   board, before any merge that touches payments.
 *
 *   The same audit with a key asks "does Stripe AGREE?" That needs the secret
 *   key, so it is a by hand step, exactly like `production-schema-check`.
 *
 * The first is the one that catches what actually goes wrong, because the
 * failure is never a wrong answer. It is a question nobody was made to answer.
 *
 * WHAT THIS FILE MAY NOT BECOME. A second copy of the handler's event list.
 * The audit PARSES the events the handler compares on out of
 * `src/lib/payments-stripe.ts` and asserts they equal `registeredEvents` here,
 * so a fourth handled event that nobody registered in the dashboard turns the
 * board red and names it. Typing the list in both places would make the check
 * compare a value to itself.
 */
export const stripeWebhookEndpoint: {
  /** The App Router path, asserted to exist on disk. */
  path: string;
  /** The full URL registered in the dashboard, against the production host. */
  url: string;
  /**
   * The events enabled on that endpoint, as the dashboard lists them. Asserted
   * to equal the set the handler actually branches on.
   */
  registeredEvents: string[];
  /** Who registered it, when, and against which account. Never left empty. */
  verified: string;
  /**
   * ISO date the LIVE half of stripe-webhook-audit last confirmed this against
   * the account, or null if it never has.
   *
   * THE ACCOUNT ID IS NOT REPEATED HERE. It lives once, in stripe-console.ts,
   * and the audit asserts the account it reached equals that one. Two accounts
   * of one fact are two accounts that will disagree, which this repository has
   * now written down about the ledger, the compliance sentence, the
   * registration line and the firm name.
   */
  liveConfirmedOn: string | null;
} = {
  path: "/api/stripe/webhook",
  url: "https://254engineering.com/api/stripe/webhook",
  registeredEvents: [
    "checkout.session.completed",
    "checkout.session.expired",
    "charge.refunded",
  ],
  verified:
    "Registered by the operator on 2026-09-16 against the live 254 account, with STRIPE_WEBHOOK_SECRET " +
    "taken from the same account as STRIPE_SECRET_KEY in the same sitting. The live half of " +
    "stripe-webhook-audit confirms this against the account the key belongs to.",

  /*
   * CONFIRMED AT THE KEYBOARD 2026-09-16, 11 of 11 checks: one endpoint,
   * enabled, at the declared URL, subscribed to exactly the three handled
   * events and nothing extra, live mode on both sides, against the account
   * declared in stripe-console.ts.
   *
   * That run closed the SILENT case, which is the one where the endpoint is
   * registered in another account and this platform is never called at all.
   * Recording the date turns a pass into a baseline: the next run has something
   * to disagree with rather than only its own green.
   */
  liveConfirmedOn: "2026-09-16",
};
