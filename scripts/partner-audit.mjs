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

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import {
  attribute,
  normaliseCode,
  looksLikeCode,
  ATTRIBUTION_WINDOW_DAYS,
} from "../src/lib/attribution-rules.ts";
import { copyVerdict, performingFirmLine } from "../src/lib/partner-copy.ts";
import { DEFAULT_ROLES } from "../src/lib/ops-authz.ts";
import {
  applyBps,
  commissionForDelivery,
  commissionForQualifiedLead,
  netOf,
  payableAt,
  reversalFor,
  tierFor,
} from "../src/lib/partner-comp.ts";

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
  /*
   * NINETY DAYS, AS A LITERAL. IT IS WHAT A PARTNER IS OWED.
   *
   * These two lines used to be written in terms of ATTRIBUTION_WINDOW_DAYS on
   * both sides, which proved the edge was sharp and inclusive and could not see
   * the window move. Ninety to a hundred and eighty is a change to what the firm
   * pays partners, and it would have passed this audit in silence.
   *
   * Operator ruling, 2026-09-08: a commission window is a decision made twice on
   * purpose, once in the rule and once here.
   */
  const WINDOW_DAYS = 90;

  rec(
    "the attribution window is still the ruled 90 days",
    ATTRIBUTION_WINDOW_DAYS === WINDOW_DAYS,
    `the module says ${ATTRIBUTION_WINDOW_DAYS}`,
  );

  rec(
    `a touch ${WINDOW_DAYS} days old is still inside the window`,
    call([link(ALPHA, "bayside", WINDOW_DAYS)]).attributed === true,
  );
  rec(
    `a touch ${WINDOW_DAYS + 1} days old is outside it`,
    call([link(ALPHA, "bayside", WINDOW_DAYS + 1)]).attributed === false,
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

// =========================================================================
// WHAT A PARTNER EARNED. Phase 9 Section 3.
//
// Exercised by calling the rule, for the reason the attribution half is: this
// decides how much money leaves the firm, and a source grep asserting that a
// percentage appears somewhere in the file would pass while the arithmetic was
// wrong.
// =========================================================================

const terms = (over = {}) => ({
  model: "percent_of_order",
  percentBps: null,
  flatCents: null,
  tiers: null,
  holdbackDays: 30,
  ...over,
});

// ------------------------------------------------------------- the arithmetic
{
  rec("two and a half percent of four hundred and fifty dollars is $11.25", applyBps(45000, 250) === 1125);
  rec("a hundred percent is the whole thing", applyBps(45000, 10000) === 45000);
  rec("nothing is nothing", applyBps(45000, 0) === 0);
  /*
   * Half away from zero, in both directions, because a reversal is negative and
   * a rounding rule that behaved differently on the way back would leave a
   * partner a cent short every time money moved twice.
   */
  rec("a half cent rounds away from zero", applyBps(100, 50) === 1, String(applyBps(100, 50)));
  rec("and does the same when negative", applyBps(-100, 50) === -1, String(applyBps(-100, 50)));
  rec("the result is always an integer number of cents", Number.isInteger(applyBps(33333, 275)));
}

// ------------------------------------------------------------- the four models
{
  const percent = commissionForDelivery({
    terms: terms({ model: "percent_of_order", percentBps: 250 }),
    orderTotalCents: 45000,
    priorQualifyingCount: 0,
  });
  rec("percent of order pays the percentage", percent.ok && percent.amountCents === 1125);
  rec("and records what it took the percentage of", percent.ok && percent.basisCents === 45000);
  rec(
    "and explains itself in a sentence a partner can check",
    percent.ok && /2.5 percent/.test(percent.explanation) && /\$450.00/.test(percent.explanation),
    percent.ok ? percent.explanation : "",
  );

  const flat = commissionForDelivery({
    terms: terms({ model: "flat_per_order", flatCents: 5000 }),
    orderTotalCents: 45000,
    priorQualifyingCount: 0,
  });
  rec("a flat fee per order pays the flat fee", flat.ok && flat.amountCents === 5000);
  rec("and does not vary with the order", flat.ok && flat.amountCents !== applyBps(45000, 250));

  /*
   * THE ONE THAT MUST NOT RETURN ZERO.
   *
   * A percentage model with no order to take a percentage of. Something is owed
   * and its figure is not knowable, which is not the same as owing nothing, and
   * the whole reason the ledger has a blocked state.
   */
  const noOrder = commissionForDelivery({
    terms: terms({ model: "percent_of_order", percentBps: 250 }),
    orderTotalCents: null,
    priorQualifyingCount: 0,
  });
  rec("a percentage with no order value does not resolve", noOrder.ok === false);
  rec(
    "and says the figure is unknown rather than that nothing is owed",
    noOrder.ok === false && noOrder.reason === "unknown",
    "unknown becomes a blocked ledger entry; not_earned_here becomes a real zero, and confusing them pays the wrong number",
  );

  const noRate = commissionForDelivery({
    terms: terms({ model: "percent_of_order", percentBps: null }),
    orderTotalCents: 45000,
    priorQualifyingCount: 0,
  });
  rec("a percentage model with no rate set is unknown, not zero", noRate.ok === false && noRate.reason === "unknown");

  /*
   * A partner paid per lead earns nothing from a delivery, and that is a
   * knowable nothing rather than an unknown. It becomes a real zero on the
   * file, which is what lets that file's margin be complete.
   */
  const leadPartnerOnDelivery = commissionForDelivery({
    terms: terms({ model: "flat_per_qualified_lead", flatCents: 2500 }),
    orderTotalCents: 45000,
    priorQualifyingCount: 0,
  });
  rec(
    "a lead fee partner earns nothing from a delivery",
    leadPartnerOnDelivery.ok === false && leadPartnerOnDelivery.reason === "not_earned_here",
  );

  const lead = commissionForQualifiedLead(terms({ model: "flat_per_qualified_lead", flatCents: 2500 }));
  rec("and earns the flat fee when the firm qualifies a lead", lead.ok && lead.amountCents === 2500);

  const wrongModelOnLead = commissionForQualifiedLead(terms({ model: "flat_per_order", flatCents: 5000 }));
  rec(
    "while a per order partner earns nothing for a converted lead",
    wrongModelOnLead.ok === false && wrongModelOnLead.reason === "not_earned_here",
  );
}

// ------------------------------------------------------------------- the tiers
{
  const ladder = [
    { min: 0, bps: 250 },
    { min: 10, bps: 300 },
    { min: 25, bps: 350 },
  ];

  rec("the first tier applies from nothing", tierFor(0, ladder)?.bps === 250);
  rec("the boundary belongs to the tier it starts", tierFor(10, ladder)?.bps === 300);
  rec("one below the boundary is the tier before", tierFor(9, ladder)?.bps === 250);
  rec("above the top step stays at the top", tierFor(500, ladder)?.bps === 350);
  rec(
    "an unsorted ladder is sorted rather than trusted",
    tierFor(10, [{ min: 25, bps: 350 }, { min: 0, bps: 250 }, { min: 10, bps: 300 }])?.bps === 300,
    "the ladder comes from a jsonb column somebody typed",
  );
  rec("no ladder is not a rate of zero", tierFor(5, null) === null);

  /*
   * TIERS APPLY FORWARD. The eleventh delivery is paid at the higher rate; the
   * ten before it are not repriced. The alternative would mean no accrual is
   * final until the period closes, which contradicts accruing at delivery and
   * never editing an accrual.
   */
  const tenth = commissionForDelivery({
    terms: terms({ model: "tiered_by_volume", tiers: ladder }),
    orderTotalCents: 100000,
    priorQualifyingCount: 9,
  });
  const eleventh = commissionForDelivery({
    terms: terms({ model: "tiered_by_volume", tiers: ladder }),
    orderTotalCents: 100000,
    priorQualifyingCount: 10,
  });
  rec("the tenth delivery is at the first rate", tenth.ok && tenth.amountCents === 2500);
  rec("the eleventh is at the second", eleventh.ok && eleventh.amountCents === 3000);
  rec(
    "and the rule says which orders the new rate covers",
    eleventh.ok && /rather than to the earlier ones/.test(eleventh.explanation),
  );

  const noStep = commissionForDelivery({
    terms: terms({ model: "tiered_by_volume", tiers: [{ min: 5, bps: 300 }] }),
    orderTotalCents: 100000,
    priorQualifyingCount: 0,
  });
  rec(
    "a ladder with no step at the bottom is unknown rather than free",
    noStep.ok === false && noStep.reason === "unknown",
  );
}

// -------------------------------------------------------------- the reversal
{
  const full = reversalFor({
    model: "percent_of_order",
    accruedCents: 1125,
    basisCents: 45000,
    refundedCents: 45000,
  });
  rec("a full refund reverses the whole commission", full.reverse && full.amountCents === -1125);
  rec("and the counter entry is negative", full.reverse && full.amountCents < 0);

  const half = reversalFor({
    model: "percent_of_order",
    accruedCents: 1125,
    basisCents: 45000,
    refundedCents: 22500,
  });
  rec("half the order back takes half the commission back", half.reverse && half.amountCents === -563, String(half.reverse ? half.amountCents : ""));

  const none = reversalFor({
    model: "percent_of_order",
    accruedCents: 1125,
    basisCents: 45000,
    refundedCents: 0,
  });
  rec("no refund reverses nothing", none.reverse === false);

  /*
   * A flat fee is not a share of anything, so there is no proportion to take.
   * The order stood, and the partner brought the order.
   */
  const flatPartial = reversalFor({
    model: "flat_per_order",
    accruedCents: 5000,
    basisCents: 45000,
    refundedCents: 22500,
  });
  rec("a partial refund does not touch a flat fee per order", flatPartial.reverse === false);

  const flatFull = reversalFor({
    model: "flat_per_order",
    accruedCents: 5000,
    basisCents: 45000,
    refundedCents: 45000,
  });
  rec("a full refund takes the whole flat fee back", flatFull.reverse && flatFull.amountCents === -5000);

  /*
   * The ruling worth arguing with, so it is asserted rather than assumed. A
   * partner paid for a qualified lead did what they were paid for. An engineer
   * declining to certify afterwards is the firm's technical risk, not theirs.
   */
  const leadFee = reversalFor({
    model: "flat_per_qualified_lead",
    accruedCents: 2500,
    basisCents: null,
    refundedCents: 45000,
  });
  rec("a qualified lead fee is never reversed by a refund", leadFee.reverse === false);
  rec(
    "and says whose risk that is",
    /not the partner's to carry/.test(leadFee.explanation),
    leadFee.explanation,
  );

  const noBasis = reversalFor({
    model: "percent_of_order",
    accruedCents: 1125,
    basisCents: null,
    refundedCents: 45000,
  });
  rec(
    "a share of value with no recorded basis reverses in full rather than guessing a portion",
    noBasis.reverse && noBasis.amountCents === -1125,
  );

  const overRefund = reversalFor({
    model: "percent_of_order",
    accruedCents: 1125,
    basisCents: 45000,
    refundedCents: 90000,
  });
  rec(
    "a refund larger than the basis cannot reverse more than was accrued",
    overRefund.reverse && overRefund.amountCents === -1125,
  );
}

// ------------------------------------------------------- holdback and netting
{
  const DAYS = 24 * 60 * 60 * 1000;
  rec("a thirty day holdback is thirty days", payableAt(0, 30) === 30 * DAYS);
  rec("no holdback is payable at once", payableAt(1000, 0) === 1000);
  rec("a nonsense holdback is treated as none rather than as forever", payableAt(1000, -5) === 1000);

  const net = netOf([
    { amountCents: 1125, status: "accrued" },
    { amountCents: -563, status: "accrued" },
    { amountCents: null, status: "blocked" },
  ]);
  rec("an accrual and its reversal net", net.netCents === 562);
  rec("a blocked entry is left out of the total", net.counted === 2);
  rec("and counted, so a screen can say what it left out", net.blocked === 1);
  rec(
    "a blocked entry is not read as a zero",
    netOf([{ amountCents: null, status: "blocked" }]).counted === 0,
    "counting it would make a statement claim it covered a commission it could not compute",
  );
}

// =========================================================================
// THE FOUR NON NEGOTIABLES, MECHANICALLY. Phase 9 Section 5.
//
// docs/partner-program-decision.md set four rules about who the customer
// believes they are buying engineering from. Until Section 5 they were
// sentences in a document. Each one below is now something that fails.
// =========================================================================

// ---- NON NEGOTIABLE 2: no partner surface may say what the site could not ----
{
  /*
   * Exercised by calling the checker, not by reading it. The claim that matters
   * is that copy which would fail the site's own voice audit cannot be
   * published into the partner library, and the only way to know that is to
   * hand it a sentence.
   */
  const claim = copyVerdict(
    "254 Engineering Services performs and seals every engagement referred through this programme.",
  );
  rec("a present tense service claim cannot be published to partners", claim.ok === false);
  rec(
    "and the refusal names the sentence rather than saying no",
    claim.ok === false && /performs and seals/.test(claim.summary),
    claim.summary.slice(0, 90),
  );

  const guarantee = copyVerdict("We guarantee approval, or your money back.");
  rec("a guaranteed approval cannot be published either", guarantee.ok === false);
  rec(
    "and it is refused as a never claim rather than as a gate claim",
    guarantee.findings.some((f) => f.kind === "never"),
    "a guarantee stays forbidden after the registration issues, and a gate claim does not",
  );

  const dash = copyVerdict("Referrals are simple \u2014 send them and we do the rest.");
  rec("an em dash cannot be published", dash.ok === false);

  const fine = copyVerdict(
    "Work referred through this programme will be carried out by 254 Engineering Services, the firm of record on every engagement.",
  );
  rec(
    "and compliant copy passes, so the check is not simply refusing everything",
    fine.ok === true,
    fine.ok ? "" : fine.summary,
  );

  const assets = codeOnly("src/lib/ops-partner-assets.ts");
  /*
   * SCOPED TO THE FUNCTION, because the first version was not and it failed
   * correctly: the earliest mention of eng_partner_asset_versions in the file
   * is a READ in publishedAssets, two hundred lines above the publish path, so
   * the comparison was between a check and an unrelated query.
   *
   * The same defect this audit already records for partnerForVisitor, made
   * again in the same file.
   */
  const publishAt = assets.indexOf("export async function publishAsset");
  const publishEnd = assets.indexOf("\nexport ", publishAt + 1);
  const publishBody =
    publishAt === -1 ? "" : assets.slice(publishAt, publishEnd === -1 ? undefined : publishEnd);

  rec("there is a publish path at all", publishAt !== -1);
  rec(
    "publishing checks the copy BEFORE it writes anything",
    publishBody.indexOf("copyVerdict(") !== -1 &&
      publishBody.indexOf("copyVerdict(") < publishBody.indexOf('from("eng_partner_asset_versions")'),
    "a check after the insert is a record of a claim the firm published",
  );
  rec(
    "and the title and summary are checked as well as the body",
    /\[input\.title, input\.summary \?\? "", input\.body \?\? ""\]/.test(assets),
    "the title is the line that ends up in a list and gets pasted into an email",
  );

  /*
   * AND THE OTHER DIRECTION, WHICH IS THE ONE THAT LOOKS LIKE A BUG.
   *
   * A submission is a partner asking whether something is allowed. It is
   * accepted whatever it says, and the verdict comes back as advice. Refusing
   * the form would mean the firm never sees the thing the partner was about to
   * publish anyway.
   */
  const submitAt = assets.indexOf("export async function submitMaterial");
  const submitEnd = assets.indexOf("\nexport ", submitAt + 1);
  const submitBody = submitAt === -1 ? "" : assets.slice(submitAt, submitEnd === -1 ? undefined : submitEnd);
  rec("a partner submission is accepted even when it fails the check", submitAt !== -1 && !/if \(!verdict\.ok\) return/.test(submitBody));
  rec(
    "and the verdict is kept with it as advice",
    /decision_note: verdict\.ok \? null : verdict\.summary/.test(submitBody),
  );

  /*
   * ONE LIST OF REGULATED PATTERNS, SHARED WITH THE AUDITS.
   *
   * The application imports scripts/lib/regulatory.mjs rather than carrying its
   * own copy. That import direction is unusual and it is the point: two copies
   * of this vocabulary disagreed within a day the last time they existed, and
   * the stale one was the half that mattered.
   */
  const copyModule = codeOnly("src/lib/partner-copy.ts");
  rec(
    "the app checks copy against the same patterns the audits use",
    /scripts\/lib\/regulatory\.mjs/.test(copyModule),
    "a second copy of the regulated vocabulary is a second answer to the same question",
  );
  rec(
    "and does not define regulated patterns of its own",
    !/PRESENT_TENSE|sealed by|we seal/i.test(copyModule.replace(/import[^;]+;/g, "")),
  );
  rec(
    "the regulated check is conditional on the gate and the never claims are not",
    /if \(isPrelaunch\(\)\) check\(REGULATED/.test(copyModule) && /check\(NEVER, "never"\)/.test(copyModule),
    "a service claim becomes true on registration day; a guaranteed approval never does",
  );
}

// ---- NON NEGOTIABLE 1: the performing firm is named, in one wording --------
{
  rec(
    "the performing firm sentence names the firm",
    /254 Engineering Services/.test(performingFirmLine()),
  );
  rec(
    "and states the registration is pending while the gate is down",
    /registration is pending/i.test(performingFirmLine()),
  );
  rec(
    "and it is not itself a claim the firm could not make",
    copyVerdict(performingFirmLine()).ok,
    copyVerdict(performingFirmLine()).summary,
  );

  /*
   * ONE WORDING. Three partner surfaces carried a hand written copy of this
   * sentence when Section 4 built them, which is the drift the function exists
   * to prevent, in the same repository as the function.
   */
  const surfaces = [
    "src/app/partner/(app)/layout.tsx",
    "src/app/partner/(public)/login/page.tsx",
    "src/app/partner/(public)/set-password/page.tsx",
    "src/app/partner/(app)/materials/page.tsx",
  ];
  const handWritten = surfaces.filter((f) => /is the firm of record for work referred/.test(codeOnly(f)));
  rec(
    "no partner surface writes that sentence out by hand",
    handWritten.length === 0,
    handWritten.join(", ") || "every one calls performingFirmLine()",
  );
  const callers = surfaces.filter((f) => /performingFirmLine\(\)/.test(codeOnly(f)));
  rec(
    "and every one of them renders it",
    callers.length === surfaces.length,
    `${callers.length} of ${surfaces.length}`,
  );
}

// ---- NON NEGOTIABLE 3: no partner name on a deliverable or the RC log ------
{
  const binder = codeOnly("src/lib/ops-binder.ts");
  const docs = codeOnly("src/lib/ops-docs.ts");
  const review = codeOnly("src/lib/ops-review.ts");

  for (const [name, source] of [
    ["the evidence binder", binder],
    ["the document exports", docs],
    ["the responsible charge log", review],
  ]) {
    rec(
      `${name} never reads a partner`,
      !/eng_partners|partner_code|organisation/.test(source),
      "those are the engineer's record, and a referrer's name on one is a claim about who did the work",
    );
  }

  /*
   * partner_id on eng_files exists and ops-docs reads it, which is the one
   * legitimate use: the margin needs to know whether a commission is owed. It
   * reads the ID and never the NAME, so nothing a partner is called can reach a
   * document.
   */
  rec(
    "the margin may know a file has a partner and never which one",
    /partner_id/.test(docs) && !/organisation/.test(docs),
  );
}

// ---- NON NEGOTIABLE 4: partner branding is primary only in their portal ----
{
  const walkTsx = (dir, acc = []) => {
    if (!existsSync(dir)) return acc;
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walkTsx(full, acc);
      else if (/\.tsx$/.test(entry)) acc.push(full);
    }
    return acc;
  };

  /*
   * THE CUSTOMER FACING SURFACES, WHICH IS WHAT THE RULE IS ABOUT.
   *
   * The first version walked the staff portal too and failed on the operator's
   * own partner page, which renders the organisation name in its heading. That
   * was the check being wider than the rule: non negotiable 4 is about who the
   * CUSTOMER believes they are buying engineering from, and the firm looking at
   * its own roster is not that.
   *
   * The staff portal is covered by non negotiable 3 instead, which is the one
   * that matters there: no partner name may reach a deliverable, a binder or
   * the responsible charge log.
   */
  const elsewhere = [
    ...walkTsx("src/app/(site)"),
    ...walkTsx("src/app/account"),
    ...walkTsx("src/components/home"),
    ...walkTsx("src/components/order"),
  ].filter((f) => /partner\.organisation|partner_organisation/.test(codeOnly(f)));

  rec(
    "no customer facing surface renders a partner's name",
    elsewhere.length === 0,
    elsewhere.join(", ") || "the customer never sees whose referral they arrived on",
  );

  const partnerLayout = codeOnly("src/app/partner/(app)/layout.tsx");
  rec(
    "and inside it, the partner's name is the identity of the surface",
    /principal\.partner\.organisation/.test(partnerLayout),
    "the one place their branding is primary, and no customer sees it",
  );
}

// =========================================================================
// THE OPERATOR'S SIDE. Phase 9 Section 6.
// =========================================================================
{
  const admin = codeOnly("src/lib/ops-partners-admin.ts");

  /*
   * THE CAPABILITY IS ASKED WHERE THE WRITE IS.
   *
   * Every exported function in that module either checks partners.manage or is
   * a type. The route checks too, and neither is redundant: the route answers
   * the request, and this one is what a second route added next month cannot
   * skip. Derived by counting rather than listed, so a function added later is
   * covered by the check that already exists.
   */
  const exported = [...admin.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  const guarded = exported.filter((name) => {
    const at = admin.indexOf(`export async function ${name}`);
    const end = admin.indexOf("\nexport ", at + 1);
    const body = admin.slice(at, end === -1 ? undefined : end);
    return /can\(actor, "partners\.manage"\)/.test(body);
  });
  rec("there are operator functions to check", exported.length >= 5, exported.join(", "));
  rec(
    "every one of them asks for partners.manage",
    guarded.length === exported.length,
    exported.filter((n) => !guarded.includes(n)).join(", ") || `${guarded.length} function(s)`,
  );

  const route = codeOnly("src/app/api/portal/partners/[id]/route.ts");
  rec(
    "and the route asks before it reaches any of them",
    route.indexOf('can(actor, "partners.manage")') < route.indexOf("switch (action)"),
    "one door, resolved once, so every branch is past it by construction",
  );

  /*
   * A partner code an operator can create but a customer cannot type is a
   * partner who never gets credited, and it would show up as an attribution
   * complaint months later rather than as a validation error now.
   */
  rec(
    "a new partner's code goes through the same rule the capture endpoint uses",
    /looksLikeCode\(code\)/.test(admin) && /normaliseCode\(input\.code\)/.test(admin),
  );

  rec(
    "suspending a partner is recorded with a reason",
    /reason\.trim\(\)\.length < 10/.test(admin),
    "it stops their links earning, and somebody will ask when and why",
  );

  /*
   * TERMS ARE A NEW ROW. A ledger entry snapshots the model and the rate it was
   * computed under, so editing the terms row would leave the entry right and
   * the terms it points at saying something else.
   */
  const termsAt = admin.indexOf("export async function setPartnerTerms");
  const termsEnd = admin.indexOf("\nexport ", termsAt + 1);
  const termsBody = termsAt === -1 ? "" : admin.slice(termsAt, termsEnd === -1 ? undefined : termsEnd);
  rec("setting terms inserts rather than updates the rate", /\.insert\(\{/.test(termsBody));
  rec(
    "and closes the previous terms the day before",
    /effective_to: dayBefore/.test(termsBody),
    "so there is never a day with two answers or a day with none",
  );
  rec(
    "and refuses a model with no figure to compute from",
    /A percentage model needs a rate/.test(termsBody) && /A flat fee model needs an amount/.test(termsBody),
    "terms that cannot produce a commission write a blocked entry on every delivery",
  );

  /*
   * THE INVITE LINK IS NEVER WRITTEN TO THE AUDIT TRAIL. That table refuses
   * deletes, so a one time credential in it is a one time credential forever.
   */
  const inviteAt = admin.indexOf("export async function invitePartnerUser");
  const inviteEnd = admin.indexOf("\nexport ", inviteAt + 1);
  const inviteBody = inviteAt === -1 ? "" : admin.slice(inviteAt, inviteEnd === -1 ? undefined : inviteEnd);
  rec("an invite issues a one time link", /issuePartnerToken\(/.test(inviteBody));
  rec(
    "and the link never reaches the audit trail",
    !/setPasswordUrl[\s\S]{0,200}writeAudit/.test(inviteBody) && !/token\.token[\s\S]{0,120}summary/.test(inviteBody),
    "eng_audit_events refuses deletes, so a credential written there is permanent",
  );
  rec(
    "and one address cannot sign in for two partners",
    /already signs in for a different partner/.test(inviteBody),
    "the session carries one partner id, so the person would see whichever the login resolved to",
  );

  // ------------------------------------------------------------- the dispute
  const disputeAt = admin.indexOf("export async function disputeView");
  const disputeEnd = admin.indexOf("\nexport ", disputeAt + 1);
  const disputeBody = disputeAt === -1 ? "" : admin.slice(disputeAt, disputeEnd === -1 ? undefined : disputeEnd);

  rec("there is a dispute view", disputeAt !== -1);
  rec(
    "it reads BOTH keys, the cookie and the synthetic order key",
    /\.in\("visitor_key", keys\)/.test(disputeBody) && /order:\$\{order\.id/.test(disputeBody),
    "reading one shows half the evidence, and half the evidence in a dispute is worse than none",
  );
  rec(
    "and says when the link touches cannot be reconstructed",
    /reconstructable/.test(disputeBody),
    "an empty list would be the claim that there were no touches",
  );

  /*
   * SCOPED TO attributeOrder, AND THE FIRST VERSION WAS NOT.
   *
   * `visitor_key: input.visitorKey` appears twice in that file: once in
   * recordTouch, which has written it since Section 2, and once in the order
   * update that 0022 added. An unscoped match found the first and passed while
   * the injection had deleted the second.
   *
   * Caught by injection, which is the only reason it is written down here
   * rather than shipped as a green check looking at the wrong line.
   */
  const orders = codeOnly("src/lib/ops-partners.ts");
  const attributeAt = orders.indexOf("export async function attributeOrder");
  const attributeEnd = orders.indexOf("\nexport ", attributeAt + 1);
  const attributeBody =
    attributeAt === -1 ? "" : orders.slice(attributeAt, attributeEnd === -1 ? undefined : attributeEnd);

  rec("there is an attributeOrder to check", attributeAt !== -1);
  rec(
    "the order now keeps the visitor key its attribution was decided from",
    /\.from\("eng_service_orders"\)[\s\S]{0,600}visitor_key: input\.visitorKey/.test(attributeBody),
    "0014 kept every losing touch and 0022 made them findable from the order",
  );

  const disputeScreen = codeOnly("src/app/portal/(app)/partners/disputes/page.tsx");
  rec(
    "and the dispute screen changes no attribution",
    !/attributeOrder|partner_id:/.test(disputeScreen),
    "the columns are frozen on a paid order; a dispute is settled by an adjustment beside the entry",
  );

  // ---------------------------------------------------------- the adjustment
  const comp = codeOnly("src/lib/ops-partner-comp.ts");
  const adjustAt = comp.indexOf("export async function recordAdjustment");
  const adjustEnd = comp.indexOf("\nexport ", adjustAt + 1);
  const adjustBody = adjustAt === -1 ? "" : comp.slice(adjustAt, adjustEnd === -1 ? undefined : adjustEnd);

  rec("an adjustment is its own entry kind", /kind: "adjustment"/.test(adjustBody));
  rec(
    "and needs a reason long enough to be a sentence",
    /reason\.length < 20/.test(adjustBody),
    "an adjustment with no explanation is a figure a partner cannot check",
  );
  rec(
    "and is payable at once rather than held back",
    /payableAtMs: Date\.now\(\)/.test(adjustBody),
    "holding back a correction the firm made itself would make a partner wait for money the firm agrees it owes",
  );
  rec(
    "and asks for partners.manage",
    /can\(actor, "partners\.manage"\)/.test(adjustBody),
  );

  // ------------------------------------------------------ the capability itself
  const authz = codeOnly("src/lib/ops-authz.ts");
  rec("partners.manage is an action", /\| "partners\.manage"/.test(authz));

  /*
   * ASKED OF THE DECLARATION, NOT OF THE SOURCE TEXT.
   *
   * The first version matched MATRIX blocks with a regex, so it could see the
   * three system roles and was blind to the five roles DEFAULT_ROLES declares
   * with their own grant lists. An injection that gave partners.manage to sales
   * passed it.
   *
   * DEFAULT_ROLES is what the migration is generated from and what roles-audit
   * compares the database to, so it is the thing to ask.
   */
  const grantingRoles = DEFAULT_ROLES.filter((r) => r.grants.includes("partners.manage")).map(
    (r) => r.key,
  );
  rec(
    "and only the administrator is declared with it",
    grantingRoles.length === 1 && grantingRoles[0] === "admin",
    grantingRoles.join(", ") || "nobody, which would make the screen unreachable",
  );

  const seedSql = readFileSync("supabase/migrations/0021_partners_manage_grant.sql", "utf8");
  rec(
    "and a migration seeds it, because 0018 had already run",
    /'admin', 'partners\.manage'/.test(seedSql) && /on conflict/.test(seedSql),
    "a migration that changes after it has run is a migration nobody can reason about",
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

  // ================================================ the ledger, Section 3
  //
  // Shape checks, and each is about where something sits rather than what it
  // computes. The arithmetic is exercised above by calling it.

  const ledgerSql = readFileSync("supabase/migrations/0019_partner_compensation.sql", "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  rec(
    "an entry refuses every change except being claimed by a statement",
    /new\.amount_cents is distinct from old\.amount_cents/.test(ledgerSql) &&
      /new\.explanation  *is distinct from old\.explanation/.test(ledgerSql),
    "an accrual that can be edited is a number a partner cannot check next month",
  );
  rec(
    "and statement_id is deliberately NOT in the frozen list",
    !/new\.statement_id is distinct from old\.statement_id/.test(ledgerSql),
    "freezing it would make the close impossible, which is how a corrections column gets invented",
  );
  rec("and the freeze function pins its search_path", /eng_freeze_partner_entry[\s\S]*?set search_path = ''/.test(ledgerSql));
  rec(
    "an entry is never deleted",
    /eng_partner_entries_no_delete[\s\S]*?before delete/.test(ledgerSql) &&
      /eng_forbid_partner_entry_delete[\s\S]*?set search_path = ''/.test(ledgerSql),
  );

  rec(
    "blocked and having no figure are one fact rather than two",
    /\(status = 'blocked'\) = \(amount_cents is null\)/.test(ledgerSql),
    "two columns that have to agree are two columns that will one day disagree",
  );
  rec(
    "an accrual cannot be negative and a reversal cannot be positive",
    /kind = 'accrual'  and amount_cents >= 0/.test(ledgerSql) &&
      /kind = 'reversal' and amount_cents <= 0/.test(ledgerSql),
  );

  /*
   * IDEMPOTENCE BY INDEX, NOT BY CARE. Three of them, and each names the thing
   * that can be attempted twice: a delivery, a conversion, a refund.
   */
  for (const [what, index] of [
    ["file", "eng_partner_entries_one_accrual_per_file"],
    ["lead", "eng_partner_entries_one_accrual_per_lead"],
    ["refund", "eng_partner_entries_one_reversal_per_payment"],
  ]) {
    rec(
      `one entry per ${what}, enforced by a unique index`,
      new RegExp(`create unique index[^;]*${index}`).test(ledgerSql),
      "a retried job that pays twice is the failure nobody notices until the partner does",
    );
  }

  // ------------------------------------------------------------- the wiring
  const crm = codeOnly("src/lib/ops-crm.ts");
  const transitionAt = crm.indexOf("export async function transitionFile");
  const transitionEnd = crm.indexOf("\nexport ", transitionAt + 1);
  const transitionBody =
    transitionAt === -1 ? "" : crm.slice(transitionAt, transitionEnd === -1 ? undefined : transitionEnd);

  rec("delivery accrues, in the one function that can deliver", /accrueForDelivery\(/.test(transitionBody));
  rec(
    "and only on delivery",
    /to === "delivered"/.test(transitionBody),
    "accruing on any transition would pay a partner when a file was dispatched",
  );

  const convertAt = crm.indexOf("export async function convertLead");
  const convertEnd = crm.indexOf("\nexport ", convertAt + 1);
  const convertBody = convertAt === -1 ? "" : crm.slice(convertAt, convertEnd === -1 ? undefined : convertEnd);
  rec("converting a lead is what qualifies it", /accrueForQualifiedLead\(/.test(convertBody));

  /*
   * EVERY REFUND REVERSES, AND THE EXPECTATION IS DERIVED RATHER THAN TYPED.
   *
   * There are three paths that write a refund row: the decision rule, a firm
   * cancellation, and a refund somebody made in the provider's dashboard. A
   * hand maintained list of three would go stale the day a fourth arrived,
   * which is exactly when a commission would quietly be paid on money that went
   * back. So the check counts the refund rows the file writes and requires a
   * reversal call for each.
   */
  const payments = codeOnly("src/lib/ops-payments.ts");
  const refundWrites = (payments.match(/kind: "refund"/g) ?? []).length;
  const reversals = (payments.match(/reverseForRefund\(\{/g) ?? []).length;
  rec(
    "every path that records a refund also reverses the commission",
    refundWrites > 0 && reversals === refundWrites,
    `${refundWrites} refund write(s), ${reversals} reversal call(s)`,
  );

  // ------------------------------------------------- what the module will not do
  const comp = codeOnly("src/lib/ops-partner-comp.ts");
  rec(
    "the payout is recorded, never performed",
    !/paymentProvider\(/.test(comp) && !/provider\.(refund|charge|payout)/.test(comp),
    "a platform that can send money to a third party is one where anybody who reaches it can",
  );
  rec(
    "a payout cannot be recorded without the reference it was paid under",
    /reference\.length < 3/.test(comp),
    "a payout with nothing to check it against is somebody's word three years later",
  );
  rec(
    "a statement is issued before it is paid",
    /status !== "issued"/.test(comp),
    "recording a payout against an unissued statement would be paying something nobody was told they were owed",
  );

  /*
   * NOTHING ANYWHERE EDITS AN AMOUNT. The trigger refuses it at the database,
   * and this asserts no application code even tries, because code that tries is
   * code somebody will later "fix" by loosening the trigger.
   */
  const writesAmount = [
    "src/lib/ops-partner-comp.ts",
    "src/lib/ops-payments.ts",
    "src/lib/ops-crm.ts",
  ].filter((file) => /\.update\(\{[^}]*amount_cents/.test(codeOnly(file)));
  rec(
    "no code updates a ledger amount",
    writesAmount.length === 0,
    writesAmount.join(", ") || "a correction is an adjustment entry beside it",
  );

  /*
   * THE FOURTH COST IS READ FROM THE LEDGER RATHER THAN STORED BESIDE IT.
   *
   * A partner_cost_cents column on eng_files would be a second copy of a figure
   * the ledger already holds, and the two would agree until the day a reversal
   * landed and something forgot.
   */
  const docs = codeOnly("src/lib/ops-docs.ts");
  rec(
    "the margin reads the commission from the ledger",
    /partnerCostByFile\(/.test(docs) && !/partner_cost_cents/.test(docs),
    "a second copy of a figure is a figure that will one day disagree with itself",
  );

  // ============================================ the portal, Section 4
  //
  // WHAT A PARTNER MAY READ IS A LIST OF COLUMNS, AND A LIST OF COLUMNS SPREAD
  // ACROSS SIX SCREENS IS A LIST NOBODY CAN CHECK.
  //
  // So every partner read goes through one module and this asserts what that
  // module is allowed to name. Adding property_address to a query there fails
  // the suite rather than shipping a leak. The reasoning for each exclusion is
  // in docs/partner-portal.md.

  const portal = codeOnly("src/lib/ops-partner-portal.ts");

  const FORBIDDEN = [
    ["property_address", "the property is the client's, and a partner knowing it does not make it theirs to be shown"],
    ["client_id", "who the client is"],
    ["customer_name", "who the client is"],
    ["customer_email", "how to reach the client, which is how a referral becomes a poached client"],
    ["file_number", "the firm's own record identifier for the engineering"],
    ["evidence", "what a technician captured at a property"],
    ["refusal_reason", "why an engineer would not certify, which is the engineer's judgment"],
    ["sealed_at", "whether a document was sealed"],
    ["engineer_cost_cents", "what the firm pays an engineer"],
    ["tech_cost_cents", "what the firm pays a technician"],
    ["client_price_cents", "what the firm charged, which is the firm's margin one subtraction away"],
  ];

  for (const [column, why] of FORBIDDEN) {
    rec(
      `a partner read never names ${column}`,
      !new RegExp(`["'\\s,(]${column}\\b`).test(portal),
      why,
    );
  }

  /*
   * And the check is not vacuous. It would pass on an empty file, so this
   * asserts the module actually contains the reads it is being checked for.
   */
  rec(
    "and there are reads in that module to check",
    /from\("eng_service_orders"\)/.test(portal) && /from\("eng_partner_entries"\)/.test(portal),
    "a forbidden column check against a file with no queries in it proves nothing",
  );

  /*
   * THE PARTNER COMES FROM THE SESSION. Every exported read takes the whole
   * principal rather than an id, so there is no signature a route could call
   * with somebody else's partner.
   */
  const readsTakingAnId = [...portal.matchAll(/export async function (\w+)\(\s*(\w+): string/g)]
    .map((m) => m[1])
    .filter((name) => name !== "acceptAgreement");
  rec(
    "no partner read takes a bare partner id",
    readsTakingAnId.length === 0,
    readsTakingAnId.join(", ") || "every read takes the principal the session produced",
  );

  rec(
    "a statement is looked up by partner AND reference",
    /eq\("partner_id", principal\.partnerId\)[\s\S]{0,200}eq\("reference", reference\)/.test(portal),
    "a reference is short enough to guess, and a lookup by reference alone hands one partner another's statement",
  );

  rec(
    "an open statement is not shown to a partner",
    /in\("status", \["issued", "paid"\]\)/.test(portal),
    "an open statement is the firm's working total during a close, not a thing anybody has been told",
  );

  // -------------------------------------------------- the surface itself
  const partnerFiles = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry)) partnerFiles.push(full);
    }
  };
  walk("src/app/partner");
  walk("src/components/partner");
  walk("src/app/api/partner");

  rec("there are partner surfaces to check", partnerFiles.length >= 8, `${partnerFiles.length} files`);

  /*
   * A PARTNER IS NEVER IN THE STAFF AUTHORIZATION SYSTEM.
   *
   * ops-authz is where roles grant capabilities. A partner has no role and must
   * never appear there, so no file on this surface may reach for it. That is
   * the boundary that stops a partner nav being built from NavItem and a
   * partner being handed an Actor to make it compile.
   */
  const reachesForAuthz = partnerFiles.filter((f) => /from "@\/lib\/ops-authz"/.test(codeOnly(f)));
  rec(
    "no partner surface imports the staff authorization matrix",
    reachesForAuthz.length === 0,
    reachesForAuthz.join(", ") || "a partner has no role and cannot be given one",
  );

  const layout = codeOnly("src/app/partner/(app)/layout.tsx");
  rec(
    "the partner layout is a lock as well as the proxy being a gate",
    /currentPartner\(\)/.test(layout) && /redirect\("\/partner\/login"\)/.test(layout),
    "a matcher is a pattern, and a pattern is one typo from leaving a route uncovered",
  );
  rec(
    "and it checks the deployment is not mispointed before it reads anything",
    layout.indexOf("mispointing()") < layout.indexOf("currentPartner()"),
    "an unauthenticated visitor to a mispointed preview should meet an explanation, not a stack trace",
  );

  const sessionRoute = codeOnly("src/app/api/partner/session/route.ts");
  rec(
    "the partner sign in takes no next parameter",
    /*
     * The NAME, in a quoted string or as a destination, rather than the word.
     * The first version matched \bnext\b and failed on the import of
     * next/server at the top of the file, which is the check being wrong rather
     * than the route.
     */
    !/["']next["']/.test(sessionRoute) && !/\bsafeNext\b/.test(sessionRoute),
    "an open redirect out of a sign in page is a phishing primitive, and not accepting the parameter is the version with no validation to get wrong",
  );
  rec(
    "and it is rate limited before anything is verified",
    sessionRoute.indexOf("takeLoginAttempt(") < sessionRoute.indexOf("signInPartner("),
    "a limiter that runs after the password check has not limited anything",
  );

  const agreementRoute = codeOnly("src/app/api/partner/agreement/route.ts");
  rec(
    "accepting an agreement takes the partner from the session, never the body",
    /currentPartner\(\)/.test(agreementRoute) && !/partnerId.*body/.test(agreementRoute),
    "acceptances are append only, so a false one is permanent and the firm would have to explain it",
  );

  const auth = codeOnly("src/lib/partner-auth.ts");
  rec(
    "a partner's password is hashed with scrypt and a per user salt",
    /scryptSync\(/.test(auth) && /randomBytes\(16\)/.test(auth),
  );
  rec(
    "a missing hash refuses before it compares anything",
    /if \(!hash \|\| !salt\) return false;/.test(auth),
    "comparing against an empty string is a short password away from matching",
  );
  rec(
    "an unknown address still costs a hash, so it does not answer faster",
    /absent-partner-timing-salt/.test(auth),
  );
  rec(
    "the session is re-read against the database on every request",
    /export async function currentPartner[\s\S]{0,900}loadPartnerPrincipal\(claims\.sub\)/.test(auth),
    "a suspension applied five minutes ago has to take effect now, not when a fourteen day cookie expires",
  );
  rec(
    "and the cookie's partner must still be the user's partner",
    /principal\.partnerId !== claims\.partner/.test(auth),
    "moving somebody between partner organisations would otherwise leave a cookie reading the old one's earnings",
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
