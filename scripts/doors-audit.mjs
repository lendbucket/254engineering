// @runtime react-server
//
// Declared because this audit reaches modules carrying `server-only`.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees.
/**
 * ONE ACCOUNT PER DOOR, WALKED END TO END.
 *
 *   npx tsx --conditions=react-server scripts/doors-audit.mjs
 *
 * WHY THIS IS SEPARATE FROM accounts-audit.
 *
 * accounts-audit is pure and runs in phase zero: no server, no database, no
 * network. Its door checks assert the properties a walk cannot see, which is
 * mostly about a FOURTH door somebody adds next week. This asserts the thing
 * those cannot: that the three that exist actually work.
 *
 * Both are necessary. A structural check passes over a door whose route returns
 * 500 on every request, and a walk passes over a registry that has stopped
 * describing the platform. Neither is the other's substitute.
 *
 * WHY IT STARTS ITS OWN SERVER.
 *
 * The self service door is shut by the eighth launch condition, which is read
 * from a FILE rather than an environment variable, deliberately, so that
 * opening it is an edit somebody makes on purpose. A module constant is bound
 * when the server compiles the module, so the fixture patches the file and this
 * runs `next dev`, which recompiles. That is the same shape launch-audit uses
 * for the same reason.
 *
 * THE FIXTURE IS PUT BACK IN A `finally` AND THE RESTORE IS VERIFIED. A crash
 * mid run must not leave a cleared launch condition in the source tree, because
 * the next thing to read it would be a build.
 *
 * DEVELOPMENT ONLY. It creates accounts, sets passwords and signs in, and every
 * row it makes it removes. The audit trail rows it produces are permanent,
 * because that table refuses deletes by design, which is the same standing this
 * whole board's probes already have.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { startNextServer } from "./lib/dev-server.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { PROBE_DOMAIN, supersedeProbeAccount } from "./lib/portal-probe.mjs";
import { COULD_NOT_TELL } from "./lib/reachable.mjs";
import { VERIFICATION_TTL_HOURS } from "../src/lib/account-doors.ts";

const PORT = Number(process.env.DOORS_PORT || 3232);
const CONDITIONS = "src/config/launch-conditions.ts";

const results = [];
let failures = 0;
/** Set when a probe could not be built, which is a verdict rather than a finding. */
let setupFault = null;

function rec(name, ok, note = "") {
  results.push({ name, ok, note });
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
}

function say(line) {
  console.log(line);
}

/**
 * Clear the self service launch condition for the length of this run.
 *
 * It patches the FILE, which is what the operator's ruling says opening this
 * door takes, rather than reaching for an environment variable the gate would
 * have to honour. A gate with a documented bypass is a gate whose bypass
 * eventually gets set on a deployment.
 */
function openSignUpCondition() {
  const original = readFileSync(CONDITIONS, "utf8");
  /*
   * ANCHORED ON THE CODE LINE, NOT ON THE FIRST TEXTUAL MATCH.
   *
   * The first version of this searched for /cleared:\s*false/ and that file
   * explains itself at length: the phrase appears inside a comment twenty lines
   * above the declaration, so a plain replace would have edited the PROSE and
   * left the value untouched. Every check below would then have failed against
   * a door that was still shut, and the failure would have read as the door
   * being broken.
   *
   * It is the matcher-matching-its-own-prose defect this repository keeps
   * finding, caught before it ran rather than after. The anchor is a line that
   * STARTS with the field, which no comment line in that file does.
   */
  const FIELD = /^(\s*)cleared:\s*false,/m;
  if (!FIELD.test(original)) {
    throw new Error(
      `${CONDITIONS} has no line declaring the condition unmet, so this fixture does not know what it is patching. ` +
        `Either the operator has lifted the condition, in which case this fixture should be removed, or the shape changed.`,
    );
  }
  writeFileSync(CONDITIONS, original.replace(FIELD, "$1cleared: true,"));
  return () => {
    writeFileSync(CONDITIONS, original);
    const back = readFileSync(CONDITIONS, "utf8");
    if (back !== original) {
      throw new Error(`${CONDITIONS} was NOT restored. Put it back by hand before anything builds.`);
    }
  };
}

async function post(base, path, body, cookie) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null), res };
}

/** Read the unspent set password token straight out of the database. */
async function tokenFor(db, customerUserId) {
  /*
   * THE TOKEN IS READ FROM THE DATABASE AND NEVER FROM A RESPONSE.
   *
   * No route returns one, which is the point: it is a credential and it belongs
   * in the mail and nowhere else. An audit that could read it off a response
   * would be proving the opposite of what this platform wants to be true.
   *
   * Only the hash is stored, so the raw token cannot be recovered here. What
   * this does instead is mint a fresh one the same way the product does, which
   * exercises issueCustomerToken and leaves the original unspent.
   */
  const { issueCustomerToken } = await import("../src/lib/customer-auth.ts");
  return await issueCustomerToken(customerUserId, "set_password");
}

async function run() {
  if (!existsSync("src/config/launch-conditions.ts")) {
    console.log("COULD NOT TELL: the launch conditions file is not where this fixture expects it.");
    process.exit(0);
  }

  const db = auditClient("doors-audit", { neverProduction: true });
  if (!db) {
    console.log("");
    console.log("COULD NOT TELL: no database client, so no door could be walked.");
    process.exit(0);
  }

  let restore = null;
  let server = null;
  const made = [];

  try {
    restore = openSignUpCondition();
    say("");
    say(`launch condition cleared for this run, server starting on ${PORT}`);
    server = await startNextServer({ port: PORT, command: "dev", timeoutMs: 240_000 });
    const base = server.base;

    /* ------------------------------------------------ door one: self service */
    say("");
    say("1. self service");

    const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
    const selfEmail = `probe-door-self-${stamp}@${PROBE_DOMAIN}`;

    const signUp = await post(base, "/api/account/sign-up", {
      name: "Audit Probe Self Service",
      organisation: "Audit Probe Company",
      email: selfEmail,
      phone: "",
      website: "",
    });
    rec("the sign up route answers", signUp.status === 200 && signUp.body?.ok === true, signUp.body?.error ?? "");

    const { data: selfRow } = await db
      .from("eng_customer_users")
      .select("id, origin, status, email_verified_at, account_id")
      .eq("email", selfEmail)
      .maybeSingle();

    rec("an account holder exists for that address", Boolean(selfRow), selfRow ? "" : "nothing was written");
    if (selfRow) made.push(selfRow.id);
    rec(
      "and it records which door it came through",
      selfRow?.origin === "self_service",
      selfRow?.origin ?? "no origin",
    );
    rec(
      "and it cannot act yet, because the address is not proven",
      selfRow?.status === "invited" && selfRow?.email_verified_at === null,
      `status ${selfRow?.status}, verified ${selfRow?.email_verified_at ?? "null"}`,
    );

    /*
     * THE SAME ANSWER FOR AN ADDRESS THAT ALREADY EXISTS. This is the oracle
     * the whole door was shaped around, and it is the one property a structural
     * check cannot see, because it is about two responses being identical.
     */
    const again = await post(base, "/api/account/sign-up", {
      name: "Audit Probe Self Service",
      email: selfEmail,
      website: "",
    });
    rec(
      "signing up again with the same address gives the identical answer",
      again.status === signUp.status && again.body?.message === signUp.body?.message,
      again.body?.message === signUp.body?.message ? "" : "the two answers differ, which is an oracle",
    );

    const { count: dupes } = await db
      .from("eng_customer_users")
      .select("id", { count: "exact", head: true })
      .eq("email", selfEmail);
    rec("and no second account was created", dupes === 1, `${dupes} row(s) for that address`);

    /* The link proves the address and sets the password. */
    const selfToken = selfRow ? await tokenFor(db, selfRow.id) : null;
    rec("a set password link can be issued", Boolean(selfToken));

    const password = `probe-${stamp}-doors-audit`;
    if (selfToken) {
      const set = await post(base, "/api/account/set-password", { token: selfToken.token, password });
      rec("the link sets a password", set.status === 200 && set.body?.ok === true, set.body?.error ?? "");
    }

    const { data: selfAfter } = await db
      .from("eng_customer_users")
      .select("status, email_verified_at")
      .eq("email", selfEmail)
      .maybeSingle();
    rec(
      "and opening it is what proves the address",
      Boolean(selfAfter?.email_verified_at) && selfAfter?.status === "active",
      `status ${selfAfter?.status}, verified ${selfAfter?.email_verified_at ?? "null"}`,
    );

    const signIn = await post(base, "/api/account/session", { email: selfEmail, password });
    const cookie = (signIn.res.headers.get("set-cookie") ?? "").match(/eng_customer=([^;]+)/);
    rec(
      "and the account can then sign in",
      signIn.status === 200 && Boolean(cookie),
      signIn.body?.error ?? (cookie ? "" : "no cookie came back"),
    );

    /* ------------------------------------------- door two: operator created */
    say("");
    say("2. operator created");

    const opEmail = `probe-door-op-${stamp}@${PROBE_DOMAIN}`;
    const unauth = await post(base, "/api/portal/accounts/create", {
      name: "Audit Probe Operator Made",
      email: opEmail,
    });
    rec(
      "the operator door refuses a caller with no session",
      unauth.status === 401,
      `HTTP ${unauth.status}`,
    );

    const { data: opBefore } = await db
      .from("eng_customer_users")
      .select("id")
      .eq("email", opEmail)
      .maybeSingle();
    rec(
      "and wrote nothing while refusing",
      !opBefore,
      "a refusal that still created the row would be the permission check doing nothing",
    );

    /*
     * The signed in half is walked with a real staff session rather than a
     * forged cookie, for the reason every probe in this repository uses the
     * real endpoint: a cookie minted here proves this audit can sign a cookie.
     */
    const { createProbe, destroyProbes, probeFault } = await import("./lib/portal-probe.mjs");
    const admin = await createProbe(base, "admin", "doors-audit");

    /*
     * A PROBE THAT COULD NOT BE BUILT IS NOT A BROKEN DOOR. Operator ruling,
     * 2026-09-23, after a transport fault in break-glass-audit was reported as
     * a failed check and read as a broken recovery path.
     *
     * This line used to be
     *
     *   rec("a staff probe with accounts.manage could be made", Boolean(admin?.cookie), "no cookie")
     *
     * which turns "the database refused to make an account" into a red line on
     * the audit that answers whether the OPERATOR DOOR WORKS. The door is fine.
     * Nothing walked through it.
     *
     * The fault names which of the four it was, because `no cookie` covered a
     * missing client, a refused createUser, a rejected profile insert and a
     * sign in that came back empty, and three of those are not about this door.
     */
    const adminFault = probeFault({ "the operator probe": admin });
    if (adminFault) {
      setupFault = `the operator door was not walked (${adminFault})`;
      console.log(`  COULD NOT TELL: ${setupFault}`);
    }

    if (admin?.cookie) {
      const opened = await post(
        base,
        "/api/portal/accounts/create",
        { name: "Audit Probe Operator Made", organisation: "Audit Probe Company", email: opEmail },
        `eng_ops=${admin.cookie}`,
      );
      rec(
        "and a signed in operator opens the account",
        opened.status === 200 && opened.body?.ok === true,
        opened.body?.error ?? "",
      );
      rec(
        "and the response carries no token",
        !JSON.stringify(opened.body ?? {}).includes("token"),
        "a credential on a staff screen is a credential in every screenshot of it",
      );

      const { data: opRow } = await db
        .from("eng_customer_users")
        .select("id, origin, status")
        .eq("email", opEmail)
        .maybeSingle();
      if (opRow) made.push(opRow.id);
      rec("the account records its door", opRow?.origin === "operator_created", opRow?.origin ?? "no origin");

      /*
       * AND THE AUDIT ROW NAMES THE MEMBER OF STAFF, not the system principal.
       * A person did this, and the question asked afterwards about every
       * account nobody opened themselves is which member of staff opened it.
       */
      const { data: trail } = await db
        .from("eng_audit_events")
        .select("actor_email, action")
        .eq("entity_id", opRow?.id ?? "00000000-0000-0000-0000-000000000000")
        .eq("action", "customer_account.create");
      rec(
        "and the trail names the operator who did it",
        (trail ?? []).length === 1 && trail[0].actor_email === admin.email,
        (trail ?? [])[0]?.actor_email ?? `${(trail ?? []).length} rows`,
      );
    }

    await destroyProbes("doors-audit");

    /* ------------------------------------------- door three: order checkout */
    say("");
    say("3. order checkout");

    /*
     * WALKED AT THE FUNCTION RATHER THAN THROUGH STRIPE.
     *
     * The door hangs off releaseForFulfilment, which a webhook reaches after a
     * real charge. Driving a real Stripe webhook from an audit would need a
     * signing secret and a live account, and would be measuring Stripe.
     *
     * So this creates the order the way checkout does, calls the release, and
     * reads the result. What that cannot prove is that the webhook reaches the
     * release, and accounts-audit asserts the wiring separately: the door's
     * declared route exists, and releaseForFulfilment is where it hangs.
     */
    const coEmail = `probe-door-checkout-${stamp}@${PROBE_DOMAIN}`;
    /*
     * "organization", AND THE ERROR IS ASSERTED RATHER THAN DISCARDED.
     *
     * The first version used "company", which eng_clients_kind_check refuses,
     * and threw the error away. So this got null back, inserted an order with
     * no client, and the run reported the DOOR opening a second client for the
     * same person. The check was right and the fixture was the liar.
     *
     * It is the same defect forms-audit recorded once already: a statement that
     * matched nothing returned no error and the audit reported green. A fixture
     * that cannot make its own row has to say so here, not three checks later
     * in somebody else's name.
     */
    const { data: client, error: clientErr } = await db
      .from("eng_clients")
      .insert({ kind: "organization", name: "Audit Probe Checkout Co", email: coEmail, status: "active", is_demo: true })
      .select("id")
      .single();
    rec("a client exists for the order to hang off", Boolean(client), clientErr?.message ?? "");

    const { data: order, error: orderErr } = await db
      .from("eng_service_orders")
      .insert({
        /*
         * EVERY NOT NULL COLUMN, because the first version of this fixture
         * carried four of the eight and was refused by the database:
         *
         *   null value in column "service_slug" violates not-null constraint
         *
         * A fixture that cannot insert its row proves nothing about the door it
         * was written to walk, and it reported that as the DOOR failing. The
         * rule this repository already carries about fixtures carrying a value
         * in every column a figure can sum applies one level down: carry a
         * value in every column the row cannot exist without.
         */
        site: "254",
        reference: `PROBE-${stamp}`.slice(0, 24),
        status: "paid",
        order_type: "desk",
        service_slug: "structural-letter",
        property_address: "1 Audit Probe Way, Corpus Christi",
        county: "Nueces",
        client_id: client?.id ?? null,
        customer_name: "Audit Probe Checkout",
        customer_email: coEmail,
        customer_company: "Audit Probe Checkout Co",
        total_cents: 12345,
      })
      .select("id, account_id")
      .single();

    rec(
      "an order exists to release",
      Boolean(order),
      order ? "" : `without one this door is not walked at all: ${orderErr?.message ?? "no error reported"}`,
    );

    if (order) {
      const { releaseForFulfilment } = await import("../src/lib/ops-payments.ts");
      await releaseForFulfilment(order.id, "desk", null);

      const { data: coRow } = await db
        .from("eng_customer_users")
        .select("id, origin, account_id")
        .eq("email", coEmail)
        .maybeSingle();
      if (coRow) made.push(coRow.id);

      rec("releasing the work opens an account", Boolean(coRow), coRow ? "" : "nothing was created");
      rec("and it records its door", coRow?.origin === "order_checkout", coRow?.origin ?? "no origin");

      const { data: orderAfter } = await db
        .from("eng_service_orders")
        .select("account_id")
        .eq("id", order.id)
        .maybeSingle();
      rec(
        "and the order now names the account",
        Boolean(orderAfter?.account_id) && orderAfter.account_id === coRow?.account_id,
        orderAfter?.account_id ? "" : "the account was opened and the order does not point at it",
      );

      /*
       * THE CLIENT IS THE ORDER'S OWN, NOT A SECOND ONE. The property that
       * keeps one human from appearing in this firm's records twice.
       */
      const { data: acct } = await db
        .from("eng_customer_accounts")
        .select("client_id")
        .eq("id", coRow?.account_id ?? "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      rec(
        "and it hangs off the client the order already made",
        acct?.client_id === client?.id,
        acct?.client_id === client?.id ? "" : "a second client was opened for the same person",
      );

      /* IDEMPOTENT: releasing twice must not open a second account. */
      await releaseForFulfilment(order.id, "desk", null);
      const { count: coCount } = await db
        .from("eng_customer_users")
        .select("id", { count: "exact", head: true })
        .eq("email", coEmail);
      rec(
        "and releasing again opens nothing further",
        coCount === 1,
        `${coCount} account holder(s). Stripe redelivers, so this is not a hypothetical.`,
      );

      /*
       * ==============================================================
       * AND THE REPEAT CUSTOMER, WHICH NOTHING ABOVE REACHES.
       * ==============================================================
       *
       * THIS WAS ADDED BECAUSE AN INJECTION DID NOT FAIL. Disabling the
       * linking branch entirely left all 27 checks green, which means the walk
       * was proving that branch by nothing: "releasing again opens nothing
       * further" passes on the SECOND release of the SAME order, and that
       * returns early on account_id long before it reaches the question of
       * whether this address already has an account.
       *
       * A check that passes over a path it never reaches is this repository's
       * own recurring defect, and the injection is the only thing that could
       * have shown it, because the check reads as though it covers this.
       *
       * So: a SECOND order, from a SECOND client, for the SAME address. That is
       * the repeat customer, which is the case that actually happens, and the
       * failure it guards against is somebody signing in to find one order out
       * of two.
       */
      const { data: client2, error: client2Err } = await db
        .from("eng_clients")
        .insert({ kind: "organization", name: "Audit Probe Checkout Co", email: coEmail, status: "active", is_demo: true })
        .select("id")
        .single();
      rec("a second client exists for the repeat order", Boolean(client2), client2Err?.message ?? "");

      const { data: order2, error: order2Err } = await db
        .from("eng_service_orders")
        .insert({
          site: "254",
          reference: `PROBE2-${stamp}`.slice(0, 24),
          status: "paid",
          order_type: "desk",
          service_slug: "structural-letter",
          property_address: "2 Audit Probe Way, Corpus Christi",
          county: "Nueces",
          client_id: client2?.id ?? null,
          customer_name: "Audit Probe Checkout",
          customer_email: coEmail,
          customer_company: "Audit Probe Checkout Co",
          total_cents: 22222,
        })
        .select("id")
        .single();
      rec("a second order exists to release", Boolean(order2), order2Err?.message ?? "");

      if (order2) {
        await releaseForFulfilment(order2.id, "desk", null);

        const { count: stillOne } = await db
          .from("eng_customer_users")
          .select("id", { count: "exact", head: true })
          .eq("email", coEmail);
        rec(
          "a second order from the same address opens no second account",
          stillOne === 1,
          `${stillOne} account holder(s) for one person`,
        );

        const { data: order2After } = await db
          .from("eng_service_orders")
          .select("account_id")
          .eq("id", order2.id)
          .maybeSingle();
        rec(
          "and the second order is attached to the account the first one opened",
          Boolean(order2After?.account_id) && order2After.account_id === coRow?.account_id,
          order2After?.account_id
            ? order2After.account_id === coRow?.account_id
              ? ""
              : "it points at a DIFFERENT account, so signing in shows one order out of two"
            : "it points at no account at all",
        );

        await db.from("eng_service_orders").delete().eq("id", order2.id);
      }
      if (client2?.id) await db.from("eng_clients").delete().eq("id", client2.id);

      await db.from("eng_service_orders").delete().eq("id", order.id);
      if (client?.id) await db.from("eng_clients").delete().eq("id", client.id);
    }

    /* -------------------------------------------------- all three converge */
    say("");
    const { data: allThree } = await db
      .from("eng_customer_users")
      .select("origin")
      .in("email", [selfEmail, opEmail, coEmail]);
    const origins = new Set((allThree ?? []).map((r) => r.origin));
    /*
     * SKIPPED WHEN A DOOR COULD NOT BE WALKED, and an injection is what found
     * this rather than any reading. Operator ruling, 2026-09-23.
     *
     * Turning the probe fault into a verdict above was not sufficient: with the
     * fault injected, this line still went red saying "three doors produced
     * three accounts" and listing two. That is true, and it names the DOORS
     * when the cause was a database that would not make an account. The red a
     * reader would act on is the wrong one.
     *
     * The convergence check is only meaningful over three doors that were all
     * walked, so it asks its question when they were and says nothing when they
     * were not. The verdict at the bottom is what reports the gap, once, in the
     * words that are actually true.
     */
    if (setupFault) {
      say(`  COULD NOT TELL: the three origins were not compared, because one door was not walked (${[...origins].join(", ") || "none"} seen)`);
    } else {
      rec(
        "three doors produced three accounts with three origins",
        origins.size === 3,
        [...origins].join(", ") || "none",
      );
    }
    rec(
      "and the link life the emails quote is the one the tokens get",
      VERIFICATION_TTL_HOURS === 72,
      "pinned here as a literal so the registry and this audit are two edits apart",
    );
  } catch (err) {
    rec("the run completed", false, err.message);
  } finally {
    if (server) await server.stop().catch(() => {});
    if (restore) restore();

    /*
     * TEARDOWN, sweeping the whole probe domain rather than only the ids made,
     * so a run that died earlier is cleaned up too. Clients and accounts go
     * with the users; the audit rows stay, because that table refuses deletes.
     */
    const { data: strays } = await db
      .from("eng_customer_users")
      .select("id, account_id")
      .like("email", `probe-door-%@${PROBE_DOMAIN}`);
    for (const row of strays ?? []) {
      await db.from("eng_customer_auth_tokens").delete().eq("customer_user_id", row.id);
      await db.from("eng_customer_users").delete().eq("id", row.id);
      const { data: acct } = await db
        .from("eng_customer_accounts")
        .select("client_id")
        .eq("id", row.account_id)
        .maybeSingle();
      /* Since 0048 an account is superseded, never deleted. See portal-probe. */
      await supersedeProbeAccount(db, row.account_id);
      if (acct?.client_id) await db.from("eng_clients").delete().eq("id", acct.client_id);
    }
    const { data: left } = await db
      .from("eng_customer_users")
      .select("id")
      .like("email", `probe-door-%@${PROBE_DOMAIN}`);
    /*
     * IT READS ACCOUNT HOLDERS, AND THE NAME NOW SAYS SO.
     *
     * This was called "every probe account is removed" and reads
     * eng_customer_users. That was accurate enough when both went, and stopped
     * being accurate the hour 0048 made an ACCOUNT undeletable: the sentence
     * claimed something about a row this query never looks at, and would have
     * gone on claiming it while accounts piled up.
     *
     * The account is superseded rather than removed and that is asserted
     * separately below, so the two facts have two checks rather than one name.
     */
    rec(
      "every probe account HOLDER is removed",
      (left ?? []).length === 0,
      `${(left ?? []).length} left behind`,
    );

    const { data: stillInUse } = await db
      .from("eng_customer_accounts")
      .select("id")
      .in("id", (strays ?? []).map((r) => r.account_id).filter(Boolean))
      .is("superseded_at", null);
    rec(
      "and every probe account is superseded rather than deleted",
      (stillInUse ?? []).length === 0,
      (stillInUse ?? []).length
        ? `${(stillInUse ?? []).length} still in use, so a teardown discarded its error`
        : "0048 refuses the delete, so teardown supersedes",
    );
  }
}

console.log("========== THE THREE DOORS, WALKED ==========");
await run();
console.log("");
if (failures) {
  console.log(`FAIL: ${failures} of ${results.length} checks.`);
  console.log("A door that is declared and does not work is a door nobody can come through.");
  process.exit(1);
}
/*
 * READ AFTER the failures, which is the opposite order to break-glass-audit, and
 * the difference is deliberate. There, the probe IS the subject and nothing can
 * be measured without it. Here one door of three could not be walked while the
 * other two were, so a real finding on either of them is still a finding and
 * must outrank the verdict. What must not happen is a green over a door nobody
 * opened.
 */
if (setupFault) {
  console.log(`COULD NOT TELL: ${setupFault}`);
  console.log(`The other checks passed (${results.length}), but one door of three was not walked.`);
  process.exit(COULD_NOT_TELL);
}
console.log(`PASS: ${results.length} checks. Three doors, three accounts, three origins, one creation function.`);
