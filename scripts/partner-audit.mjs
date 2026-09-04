/**
 * WHO GETS CREDIT, AND WHO DOES NOT.
 *
 *   npx tsx scripts/partner-audit.mjs
 *
 * WHAT THIS AUDIT IS FOR
 * ----------------------
 * If attribution is wrong, partners stop trusting the program and the program
 * dies. Wrong in the generous direction costs the firm money on business it
 * already had; wrong in the mean direction costs it the partner. Neither
 * failure announces itself, because an order attributed to the wrong partner
 * looks exactly like an order attributed to the right one.
 *
 * So this asserts the RULE, by running it. Every case below is the rule module
 * called with a situation and asked who won, which is the only form of check
 * that cannot pass while the rule is broken. Source greps are used only where
 * the subject is genuinely a matter of shape, and they are the minority here
 * for a reason: this audit's predecessors in this repository were greps, and
 * greps are what walked past five injections in one afternoon.
 *
 * It is pure. No server, no database, no network, so it runs in phase zero.
 */

import { readFileSync } from "node:fs";
import {
  attribute,
  normaliseCode,
  looksLikeCode,
  ATTRIBUTION_WINDOW_DAYS,
} from "../src/lib/attribution-rules.ts";

function codeOnly(path) {
  const withoutBlocks = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const DAY = 24 * 60 * 60 * 1000;
const ORDER_AT = Date.parse("2026-06-01T12:00:00Z");
const ago = (days) => ORDER_AT - days * DAY;

const ALPHA = "11111111-1111-4111-8111-111111111111";
const BETA = "22222222-2222-4222-8222-222222222222";

const link = (partnerId, code, days) => ({ partnerId, code, kind: "link", occurredAtMs: ago(days) });
const typed = (partnerId, code, days) => ({ partnerId, code, kind: "code", occurredAtMs: ago(days) });

const call = (touches, firstPaidOrderAtMs = null) =>
  attribute({ touches, orderAtMs: ORDER_AT, firstPaidOrderAtMs });

console.log("");
console.log("PARTNER ATTRIBUTION");
console.log("");

// ===================================================== the rule, exercised

/*
 * RULE 0, THE BASE CASE. One touch, inside the window, attributed.
 *
 * Asserted first and explicitly, because every case below is a variation on it
 * and a rule that attributed nobody would pass most of the negative checks.
 */
{
  const r = call([link(ALPHA, "bayside", 3)]);
  rec("one touch inside the window is attributed", r.attributed === true && r.partnerId === ALPHA);
  rec("and it carries the code that won", r.attributed && r.code === "bayside");
  rec(
    "and a reason a person can read",
    r.attributed && typeof r.because === "string" && r.because.length > 10,
    "a partner asking why gets the platform's own answer, not a reconstruction",
  );
}

/*
 * RULE 1. A TYPED CODE BEATS A CLICK, EVEN AN OLDER TYPED CODE AGAINST A
 * FRESHER CLICK.
 *
 * The ordering matters and is easy to get backwards. Beta's click is TODAY and
 * Alpha's typed code is thirty days old, so a rule that merely sorted by
 * recency would give this to Beta. Somebody typing a code is making a statement
 * about who sent them; a cookie is a record of what they last clicked.
 */
{
  const r = call([link(BETA, "harbor", 0), typed(ALPHA, "bayside", 30)]);
  rec(
    "a typed code beats a more recent click",
    r.attributed && r.partnerId === ALPHA,
    "otherwise the rule is just recency wearing rule 1's name",
  );
  rec("and says so", r.attributed && /by hand/.test(r.because));
}

/*
 * And the reverse, so the check above cannot be passing because typed codes
 * always win by accident of ordering: with two typed codes, recency decides.
 */
{
  const r = call([typed(ALPHA, "bayside", 30), typed(BETA, "harbor", 2)]);
  rec("between two typed codes, the most recent wins", r.attributed && r.partnerId === BETA);
}

/*
 * RULE 2. MOST RECENT TOUCH WINS, NOT FIRST.
 *
 * First touch would mean a partner earning forever from one introduction the
 * customer had forgotten, and would be impossible to explain to the second
 * partner who actually did the work.
 */
{
  const r = call([link(ALPHA, "bayside", 60), link(BETA, "harbor", 1)]);
  rec("the most recent touch wins, not the first", r.attributed && r.partnerId === BETA);
  rec(
    "and the losing touch is counted in the reason",
    r.attributed && /2 touches/.test(r.because),
    "a partner who lost is told how many were in play",
  );
}

/*
 * RULE 3. THE WINDOW IS REAL, AND IT IS EXCLUSIVE AT THE FAR EDGE.
 *
 * Both sides asserted. A window checked with the wrong comparison passes the
 * inside case and fails only for the one partner whose click was on the
 * boundary, which is exactly the dispute nobody can reproduce.
 */
{
  rec(
    `a touch ${ATTRIBUTION_WINDOW_DAYS} days old is still inside the window`,
    call([link(ALPHA, "bayside", ATTRIBUTION_WINDOW_DAYS)]).attributed === true,
  );
  rec(
    `a touch ${ATTRIBUTION_WINDOW_DAYS + 1} days old is outside it`,
    call([link(ALPHA, "bayside", ATTRIBUTION_WINDOW_DAYS + 1)]).attributed === false,
  );
  const r = call([link(ALPHA, "bayside", 200)]);
  rec(
    "and an expired touch is explained as expired, not as absent",
    r.attributed === false && /outside/.test(r.because) && !/no partner touch/.test(r.because),
    "the two are different facts and a partner deserves the right one",
  );
  rec(
    "a fresher touch still wins when an older one has expired",
    call([link(ALPHA, "bayside", 200), link(BETA, "harbor", 5)]).partnerId === BETA,
  );
}

/*
 * A touch recorded AFTER the order was placed cannot count for it.
 *
 * Not a hypothetical: attribution is re-derivable from the touch log, and
 * re-running it later must give the answer it gave at the time. A rule that
 * measured from "now" would hand old orders to whoever touched most recently.
 */
{
  const future = { partnerId: BETA, code: "harbor", kind: "link", occurredAtMs: ORDER_AT + DAY };
  const r = call([link(ALPHA, "bayside", 3), future]);
  rec("a touch after the order does not count for it", r.attributed && r.partnerId === ALPHA);
  rec("and alone, it attributes to nobody", call([future]).attributed === false);
}

/*
 * RULE 4. AN EXISTING CUSTOMER IS NOT A NEW CLIENT.
 *
 * THE RULE THAT PROTECTS THE FIRM, and the one worth the most money. Without
 * it a partner mails their link to the firm's own customer list and earns on
 * business the firm already had.
 */
{
  const r = call([link(ALPHA, "bayside", 5)], ago(200));
  rec(
    "a partner touching an existing customer earns nothing",
    r.attributed === false,
    "otherwise a partner can mail their link to the firm's own customer list",
  );
  rec(
    "and is told why in those terms",
    r.attributed === false && /already had a paid order/.test(r.because),
  );
}

/*
 * And the limit of rule 4, which matters just as much: a partner who genuinely
 * introduced somebody still earns on that customer's repeat orders. The
 * comparison is against the TOUCH, not against the order.
 *
 * Without this check, rule 4 could be implemented as "any returning customer is
 * excluded" and every check above would still pass.
 */
{
  /*
   * The introduction is 60 days old and the first paid order 30 days old, so
   * the touch is inside the window AND before the relationship existed. Both
   * conditions are needed and the first draft of this fixture had only the
   * second: a touch 120 days old, which rule 3 had already expired. The audit
   * failed and the rule was right.
   */
  const r = call([link(ALPHA, "bayside", 60)], ago(30));
  rec(
    "but a partner who introduced the customer still earns on the repeat order",
    r.attributed === true && r.partnerId === ALPHA,
    "the touch came before the first paid order, so the introduction was real",
  );
}

/*
 * And the interaction of rules 3 and 4, which is the conservative outcome and
 * is asserted so nobody later reads it as a bug: an introduction that has aged
 * out of the window earns nothing on a repeat order, even though it was a real
 * introduction. The window is what makes last touch fair, and exempting old
 * introductions from it would reintroduce first touch through the back door.
 */
{
  const r = call([link(ALPHA, "bayside", 120)], ago(150));
  rec(
    "an introduction older than the window earns nothing on a repeat order",
    r.attributed === false,
  );
}

/*
 * Rule 4 is applied PER TOUCH, not to the buyer as a whole. Alpha introduced
 * this customer; Beta turned up afterwards and clicked more recently. Beta must
 * not win, and Alpha must not be excluded by Beta's presence.
 */
{
  const r = call([link(ALPHA, "bayside", 60), link(BETA, "harbor", 2)], ago(30));
  rec(
    "a late arriving partner does not take an existing customer from the one who introduced them",
    r.attributed === true && r.partnerId === ALPHA,
  );
}

/*
 * NOBODY IS A VALID ANSWER, and it is distinguishable from a broken read.
 */
{
  const r = call([]);
  rec("no touches attributes to nobody", r.attributed === false);
  rec(
    "and says no touch was recorded, which is a different fact from an expired one",
    /no partner touch/.test(r.because),
  );
}

/*
 * DETERMINISM. Two touches in the same millisecond must not depend on the order
 * the database happened to return them in. A tie broken by array order is a
 * dispute that changes answer when somebody re-runs the query.
 */
{
  const a = { partnerId: ALPHA, code: "bayside", kind: "link", occurredAtMs: ago(4) };
  const b = { partnerId: BETA, code: "harbor", kind: "link", occurredAtMs: ago(4) };
  rec(
    "a tie is broken the same way whichever order the touches arrive in",
    call([a, b]).partnerId === call([b, a]).partnerId,
  );
}

// ================================================ codes as people type them

{
  rec("a code is compared case insensitively", normaliseCode("BaySide") === "bayside");
  rec("and with surrounding space removed", normaliseCode("  bayside \n") === "bayside");
  rec(
    "a code read down a phone still matches",
    looksLikeCode(" BAYSIDE ") && normaliseCode(" BAYSIDE ") === "bayside",
    "a referral lost to a capital letter is a dispute nobody can explain",
  );

  rec("an empty string is not a code", looksLikeCode("") === false);
  rec("two characters is not a code", looksLikeCode("ab") === false);
  rec("thirty three characters is not a code", looksLikeCode("a".repeat(33)) === false);
  rec(
    "a code carrying SQL or a path is refused",
    !looksLikeCode("bayside' or 1=1") && !looksLikeCode("../../etc") && !looksLikeCode("a b"),
  );
}

// ================================================== the parts that are shape

/*
 * These are source checks, deliberately, because each is about where code sits
 * rather than what it computes.
 */
{
  const partners = codeOnly("src/lib/ops-partners.ts");

  rec(
    "only an active partner's code resolves",
    /status !== "active"/.test(partners) && /return null/.test(partners),
    "suspending a partner must stop their links earning, not just hide them from a list",
  );

  /*
   * Attribution runs before checkout, and the check is positional because that
   * is exactly what the requirement is: after startCheckout the trigger in 0014
   * would refuse the write, and the order would be paid and unattributed.
   */
  const route = codeOnly("src/app/api/order-flow/route.ts");
  const attrAt = route.indexOf("attributeOrder({");
  const checkoutAt = route.indexOf("startCheckout(result.orderId)");
  rec("the order route attributes the order", attrAt !== -1);
  rec(
    "and does it before checkout starts",
    attrAt !== -1 && checkoutAt !== -1 && attrAt < checkoutAt,
    "after payment the freeze trigger refuses the write and the order is paid and unattributed",
  );

  rec(
    "an order attributed to nobody is recorded too",
    /partner\.not_attributed/.test(partners),
    "why did this order not go to a partner is the question that gets asked",
  );

  const sql = readFileSync("supabase/migrations/0014_partner_attribution.sql", "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  rec(
    "touches refuse update and delete",
    /eng_partner_touches_immutable[\s\S]*?eng_forbid_mutation/.test(sql),
    "evidence that can be edited after the decision is not evidence",
  );
  rec(
    "attribution is frozen once an order is paid",
    /old\.paid_at is not null/.test(sql) && /raise exception/.test(sql),
  );
  rec(
    "and the freeze function pins its search_path",
    /eng_freeze_attribution[\s\S]*?set search_path = ''/.test(sql),
  );

  /*
   * The capture endpoint answers the same whatever happened. An endpoint that
   * answered differently for a real code is a free tool for enumerating the
   * firm's partner list.
   */
  const capture = codeOnly("src/app/api/referral/route.ts");
  rec(
    "the capture endpoint never reveals whether a code is real",
    !/status: 40[0-9]/.test(capture) && !/ok: false/.test(capture) && /204/.test(capture),
  );
  rec(
    "and it is not inside the authenticated partner namespace",
    !/PARTNER_OPEN_PATHS/.test(capture),
    "the list of holes in the partner perimeter stays two entries long",
  );

  /*
   * A LEAD IS ATTRIBUTED TOO, AND WITH THE SAME RULE.
   *
   * 0014 put partner_id and partner_code on eng_leads. A column nothing writes
   * is the defect this repository exists to hunt, so these assert that the lead
   * path actually fills them, and that it does so through the shared rule
   * rather than a second one that can drift.
   */
  const intake = codeOnly("src/lib/intake.ts");
  rec(
    "a lead carries the partner who sent it",
    /partner_id: row\.partnerId/.test(intake) && /partner_code: row\.partnerCode/.test(intake),
    "0014 added the columns, and a column nothing writes is a slot that will be read as data",
  );

  const leadRoute = codeOnly("src/app/api/lead/route.ts");
  rec(
    "and the lead route resolves it from the visitor cookie",
    /partnerForVisitor\(/.test(leadRoute) && /VISITOR_COOKIE/.test(leadRoute),
  );
  rec(
    "and reads it before the row is written",
    leadRoute.indexOf("partnerForVisitor(") < leadRoute.indexOf("insertLead({"),
    "the cookie exists only for the length of the request",
  );
  /*
   * SCOPED TO THE FUNCTION, because the first version was not.
   *
   * It asked whether "partnerForVisitor" was followed anywhere later by
   * "attribute({". Deleting the call from partnerValueForVisitor entirely still
   * passed, because the match ran on past the end of that function and found
   * attributeOrder's call instead. Exactly the defect observability-audit's
   * functionBody helper was written for, repeated here.
   *
   * So the body is cut at the next top level declaration and the assertion is
   * made against that slice alone.
   */
  const resolverAt = partners.indexOf("export async function partnerForVisitor");
  const resolverEnd = partners.indexOf("\nexport ", resolverAt + 1);
  const resolverBody =
    resolverAt === -1 ? "" : partners.slice(resolverAt, resolverEnd === -1 ? undefined : resolverEnd);

  rec("there is a lead resolver at all", resolverAt !== -1);
  rec(
    "the lead resolver calls the shared rule rather than a second one",
    /attribute\(\{/.test(resolverBody),
    "two rules for one question is how the two answers start to disagree",
  );
  rec(
    "and it passes no purchase history, so rule 4 is inactive by construction",
    /firstPaidOrderAtMs: null/.test(resolverBody),
    "an existing customer sending a contact form is still a lead worth sourcing, and nobody is paid for it",
  );

  /*
   * THE ONE THAT WAS DEAD CODE.
   *
   * The partner branch in the proxy was written, reviewed, and reachable by
   * nothing, because the matcher did not name the prefix. accounts-audit
   * checked the branch, and checked the matcher for /account, and the gap
   * between those two checks is where every partner page rendered to a signed
   * out visitor. Both prefixes, asserted here as well.
   */
  const proxy = codeOnly("src/proxy.ts");
  rec(
    "both partner prefixes are in the proxy matcher",
    /"\/partner\/:path\*"/.test(proxy) && /"\/api\/partner\/:path\*"/.test(proxy),
    "a gate nothing routes through is a gate in name only",
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("Attribution decides who gets paid. A partner program whose attribution");
  console.log("cannot be trusted is worse than no partner program.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. Credit goes where the rule says it goes.`);
