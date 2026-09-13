import "server-only";

/**
 * THE THREE DOORS AN ACCOUNT CAN COME THROUGH, DECLARED.
 *
 * Phase 13 Section 1. Operator ruling: an account is one thing however it is
 * created, and the door it came through is recorded on it. Every path produces
 * the same record with a different origin, proven by a check that the three
 * converge.
 *
 * This is the declared inventory idiom again, and the thing it is guarding
 * against is specific: a fourth door added later that writes its own insert.
 * `scripts/accounts-audit.mjs` walks the route tree and fails when a handler
 * creates a customer user and is not declared here, which is the same
 * construction `scripts/lib/surfaces.mjs` uses for surfaces and
 * `supabase/applied.mjs` uses for migrations.
 *
 * WHY A REGISTRY RATHER THAN JUST A UNION TYPE
 * ---------------------------------------------
 * A union stops an invalid origin STRING. It does nothing about a new route
 * that inserts a row with a perfectly valid one, which is how the three
 * converge quietly becomes four that mostly agree. The registry names the
 * ROUTE, so a door that exists in the code and not here is a red board.
 */

/** Which door. Matches the check constraint 0043 put on the column. */
export type AccountOrigin = "self_service" | "operator_created" | "order_checkout";

export type AccountDoor = {
  origin: AccountOrigin;
  /** What it is, for somebody reading the registry rather than the code. */
  what: string;
  /** The route that may create through this door. One each, deliberately. */
  route: string;
  /** Whether the person who ends up owning the account is the one who opened it. */
  openedBySelf: boolean;
  /**
   * Whether the account can act before the address is proven.
   *
   * Only self service says no, and 0043 enforces that one at the database
   * because it is the only door where the claim is made by an anonymous
   * stranger.
   */
  requiresVerificationBeforeActing: boolean;
  /** Who the audit trail names when this door is used. */
  actor: "the person signing up" | "the operator who took the call" | "the customer who paid";
};

export const ACCOUNT_DOORS: AccountDoor[] = [
  {
    origin: "self_service",
    what: "A person creates an account with an address and a password, and proves the address before it can do anything.",
    route: "/api/account/sign-up",
    openedBySelf: true,
    requiresVerificationBeforeActing: true,
    actor: "the person signing up",
  },
  {
    origin: "operator_created",
    what: "An operator takes a call from somebody who is not yet a customer and opens the account from the call, with no order attached. The person receives a set password link, never a password.",
    route: "/api/portal/accounts/create",
    openedBySelf: false,
    /*
     * NOT because the address is proven, but because somebody who can say who
     * they spoke to opened it. The set password link proves the address as a
     * side effect of being used, which is the same evidence arriving through a
     * different act.
     */
    requiresVerificationBeforeActing: false,
    actor: "the operator who took the call",
  },
  {
    origin: "order_checkout",
    /*
     * ==================================================================
     * THIS ENTRY DESCRIBED A DOOR THAT DID NOT EXIST, AND SAID IT DID.
     * ==================================================================
     *
     * It read "the door that already existed. Paying for an order creates the
     * account that owns it", and named /api/orders/place. Read against the code
     * on 2026-09-13, every clause of that was false: there is no such route,
     * checkout creates a CLIENT, an operator later converts the client to an
     * ACCOUNT, and nothing anywhere had ever created a customer USER.
     *
     * It was found by a check written the same afternoon, which asserts that
     * every declared door names a route on disk, and it went red naming this
     * one. Worth recording rather than quietly editing: this file is a
     * DECLARATION, and a declaration that describes something the code does not
     * do is the exact failure the declared inventory idiom exists to prevent,
     * committed by an inventory.
     *
     * OPERATOR RULING, 2026-09-13: build it for real. So the claim is now true
     * rather than deleted, and the route named is the one that exists.
     */
    what: "Paying for an order opens the account that owns it, so the person who paid can sign in and see everything they have ordered rather than only the order they paid for.",
    route: "/api/stripe/webhook",
    openedBySelf: true,
    /*
     * A successful payment is a stronger claim on an address than a link
     * somebody clicked, and refusing to show an order to the person who just
     * paid for it would be the platform disbelieving its own receipt.
     */
    requiresVerificationBeforeActing: false,
    actor: "the customer who paid",
  },
];

export function doorFor(origin: AccountOrigin): AccountDoor {
  const door = ACCOUNT_DOORS.find((d) => d.origin === origin);
  /*
   * Throws rather than returning undefined. Every caller is about to write a
   * row, and a door that cannot be found means the registry and the union have
   * drifted, which is a state where continuing writes an account nobody
   * declared.
   */
  if (!door) throw new Error(`No door is declared for origin ${origin}.`);
  return door;
}

/**
 * HOW MANY ACCOUNTS ONE ADDRESS MAY ATTEMPT TO CREATE IN A WINDOW.
 *
 * Declared as data the way `SISTER_RATE_PER_MINUTE` is, and pinned by
 * accounts-audit, so changing it costs two edits made on purpose.
 *
 * WHY IT IS PER ADDRESS AND PER HOUR RATHER THAN PER IP AND PER MINUTE
 * ---------------------------------------------------------------------
 * The thing worth preventing is not load. It is somebody walking an address
 * list to find out which addresses already have accounts here, and a per minute
 * limit is no obstacle at all to a patient script.
 *
 * A per IP limit would also punish the case this platform actually expects: a
 * builder's office where four people sign up from one connection in an
 * afternoon. Per address, that is four attempts against four limits.
 *
 * THE REFUSAL SAYS THE SAME THING WHETHER OR NOT THE ADDRESS EXISTS, which is
 * the property that makes the limit worth having. A limit that only triggers on
 * addresses that exist is an oracle with a rate limit attached.
 */
export const SIGN_UP_ATTEMPTS_PER_HOUR = 5;

/**
 * How long a verification link lasts, in hours, and in words for the email.
 *
 * The number and the sentence are derived from one constant so they cannot
 * disagree, which is the failure the email port found four times: a template
 * stating a rule the code did not implement.
 */
export const VERIFICATION_TTL_HOURS = 72;
export const VERIFICATION_TTL_WORDS = "3 days";
