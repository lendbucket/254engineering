/**
 * The order engine: the catalog, the price a customer sees, and the refund rule.
 *
 *   npx tsx scripts/order-audit.mjs
 *
 * Pure. No server, no database, no network, no Stripe. Runs in phase zero.
 *
 * WHAT THIS FILE IS GUARDING
 * --------------------------
 * Three things, in order of how badly they go wrong.
 *
 * 1. THE REFUND RULE. Operator ruling, 2026-09-02: no refund rule may create
 *    financial pressure on the engineer toward a favourable conclusion. The rule
 *    that implements it is thirty lines and every one of them is a professional
 *    ethics decision. A refactor that quietly refunds the inspection on a
 *    decline would pay the firm more for certifying than for refusing, and
 *    nothing else in the system would notice.
 *
 * 2. NO PRICE IS EVER INVENTED. Every price in the catalog is null today,
 *    because a published price is the operator's decision and this repository
 *    cannot derive one. Null must never become a zero, a total, or a checkout.
 *
 * 3. NOTHING CAN BE ORDERED IN PRELAUNCH. The compliance gate is what makes the
 *    order engine lawful to operate. It is not a launch toggle.
 *
 * A FIXTURE PRICE IS NOT A PUBLISHED PRICE
 * ----------------------------------------
 * The refund and pricing checks below need numbers, so they build their own
 * entries with numbers in them. Those exist only inside this file, are never
 * read by anything that renders, and are deliberately absurd round figures so
 * nobody mistakes one for a decision.
 */
import fs from "node:fs";
import {
  CATALOG,
  catalogFor,
  catalogByType,
  deliverableKey,
  deliverablesFor,
  orderBlockedReason,
  orderable,
} from "../data/catalog.ts";
import { isKnown, money } from "../src/lib/ops-money.ts";
import { deploymentOrigin } from "../src/lib/site-url.ts";
import { blockersOn, emptyState, firstIncomplete, stepsFor } from "../src/lib/order-flow.ts";
import { judge } from "../src/lib/reconcile-rules.ts";
import { attentionFor, CHECKOUT_SESSION_HOURS, worstLevel } from "../src/lib/order-attention.ts";
import { creditDecision, outstandingOf } from "../src/lib/account-credit.ts";
import { batchShares, splitBatch, splitSummary } from "../src/lib/bulk-order.ts";
import {
  ORDER_STATUSES,
  QUOTE_STATUSES,
  CUSTOMER_STATUS,
  canTransitionOrder,
  canTransitionQuote,
  convertibleToOrder,
  isGating,
  landingStatusFor,
  qualify,
  quoteFor,
  refundDisclosure,
  refundFor,
  refundForFirmCancellation,
  FIRM_CANCELLATION_CASE,
} from "../src/lib/ops-orders.ts";
import { services } from "../src/content/services.ts";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

/** Fixture numbers. Never rendered, never published. */
const FIXTURE_PRICE = 100000;
const FIXTURE_COASTAL = 20000;
const FIXTURE_FEE = 30000;

const priced = (entry, over = {}) => ({
  ...entry,
  priceCents: FIXTURE_PRICE,
  coastalSurchargeCents: FIXTURE_COASTAL,
  inspectionFeeCents: FIXTURE_FEE,
  ...over,
});

const answerAll = (entry, pick = () => 0) =>
  entry.qualifiers.map((q) => ({ qualifierId: q.id, optionIndex: pick(q) }));

// ===========================================================================
// 1. CATALOG INTEGRITY
// ===========================================================================
{
  const slugs = CATALOG.map((e) => e.serviceSlug);
  rec("the catalog has deliverables", CATALOG.length > 0, `${CATALOG.length}`);

  /*
   * THE CATALOG IS A LIST OF DELIVERABLES, NOT OF SERVICES.
   *
   * It used to assert that no service appeared twice, which was true while a
   * service line was either wholly fixed price or wholly quoted. The operator's
   * 2026-09-03 ruling made residential design sell three things, so a repeated
   * serviceSlug is now correct and the identity that has to be unique is the
   * pair with the tier.
   */
  const keys = CATALOG.map((e) => deliverableKey(e));
  rec("no deliverable appears twice", new Set(keys).size === keys.length, keys.join(", "));
  rec(
    "every deliverable names a tier",
    CATALOG.every((e) => typeof e.tier === "string" && e.tier.length > 0),
  );
  rec(
    "and a name a customer could choose from",
    CATALOG.every((e) => typeof e.name === "string" && e.name.length > 3),
  );

  const serviceSlugs = new Set(services.map((s) => s.slug));
  const unknown = slugs.filter((s) => !serviceSlugs.has(s));
  rec("every deliverable belongs to a real service", unknown.length === 0, unknown.join(", "));

  const uncatalogued = services.map((s) => s.slug).filter((s) => !slugs.includes(s));
  rec(
    "every service the sites publish sells something",
    uncatalogued.length === 0,
    uncatalogued.length ? `missing: ${uncatalogued.join(", ")}` : "",
  );

  /*
   * The ruling this structure exists for, asserted as a fact rather than left
   * to the reader of a comment.
   */
  const design = deliverablesFor("residential-light-commercial-design");
  rec("residential design sells three deliverables", design.length === 3, `${design.length}`);
  rec(
    "two of them fixed price and one quoted",
    design.filter((d) => d.orderType === "desk").length === 2 &&
      design.filter((d) => d.orderType === "quote").length === 1,
    design.map((d) => `${d.tier}:${d.orderType}`).join(" "),
  );
  rec(
    "beam and header sizing is 750",
    design.find((d) => d.tier === "beam-header-sizing")?.priceCents === 75000,
    money(design.find((d) => d.tier === "beam-header-sizing")?.priceCents),
  );
  rec(
    "the carport and patio cover plan set is 1500",
    design.find((d) => d.tier === "carport-patio-plan-set")?.priceCents === 150000,
    money(design.find((d) => d.tier === "carport-patio-plan-set")?.priceCents),
  );
  rec(
    "and the custom package carries no price",
    design.find((d) => d.tier === "custom-package")?.priceCents === null,
  );

  /*
   * The lookup must refuse to guess. Charging somebody 1500 for a 750 job
   * because the catalog returned the first match is the failure this prevents.
   */
  rec(
    "asking for a multi deliverable line without a tier returns nothing",
    catalogFor("residential-light-commercial-design") === undefined,
    "it must not pick one",
  );
  rec(
    "and naming the tier resolves it",
    catalogFor("residential-light-commercial-design", "beam-header-sizing")?.priceCents === 75000,
  );
  rec(
    "a single deliverable line still resolves without a tier",
    catalogFor("roof-inspections")?.priceCents === 60000,
  );
  rec(
    "an unknown tier resolves to nothing rather than the wrong thing",
    catalogFor("residential-light-commercial-design", "no-such-tier") === undefined,
  );

  /*
   * The tier is the fee schedule's word, and that is the point of using it. If
   * these ever diverge, one tier would have a client price under one name and
   * an engineer production figure under another.
   */
  const migration = fs.readFileSync("supabase/migrations/0007_order_tiers.sql", "utf8");
  rec(
    "the migration explains that tier is the fee schedule's own unit",
    /eng_fee_schedule/.test(migration),
  );

  for (const entry of CATALOG) {
    const where = entry.serviceSlug;

    rec(
      `${where}: a field order names an evidence protocol`,
      entry.orderType !== "field" || Boolean(entry.protocolServiceSlug),
      "a technician with no protocol gathers whatever they think of",
    );
    rec(
      `${where}: a desk or quote order names no protocol`,
      entry.orderType === "field" || entry.protocolServiceSlug === null,
      "there is no site visit to run one against",
    );

    const qIds = entry.qualifiers.map((q) => q.id);
    rec(`${where}: qualifier ids are unique`, new Set(qIds).size === qIds.length);

    for (const q of entry.qualifiers) {
      rec(
        `${where}/${q.id}: every disqualifying index is a real option`,
        q.disqualifyOn.every((i) => Number.isInteger(i) && i >= 0 && i < q.options.length),
      );
      rec(
        `${where}/${q.id}: a disqualifying answer says where to go instead`,
        !isGating(q) || q.disqualifiedMessage.trim().length > 40,
        "ending a flow without an alternative is just a dead end",
      );
      rec(`${where}/${q.id}: at least two options`, q.options.length >= 2);
    }

    const iIds = entry.requiredInputs.map((i) => i.id);
    rec(`${where}: input ids are unique`, new Set(iIds).size === iIds.length);
    rec(
      `${where}: every input explains itself`,
      entry.requiredInputs.every((i) => i.help.trim().length > 10),
    );
    rec(
      `${where}: a quote order promises no charge until acceptance`,
      entry.orderType !== "quote" || entry.receives.some((r) => /no charge until/i.test(r)),
    );
  }
}

// ===========================================================================
// 2. NO PRICE IS INVENTED, AND NULL NEVER BECOMES A NUMBER
// ===========================================================================
{
  /*
   * THIS SECTION FLIPPED ON 2026-09-03, AND THE OLD VERSION IS WORTH KNOWING.
   *
   * It used to assert that NO price existed in the repository, because none did:
   * a price is the operator's commercial decision and inventing one would have
   * put a fabricated figure on three public sites and into a checkout. That
   * check carried its own instruction to update it once the operator ruled.
   *
   * They ruled. So the question changed from "is anything priced" to "is
   * everything that can be ordered priced correctly", and the checks below are
   * the ones the old note promised would arrive.
   *
   * The invariant that did not change: a null price still means unknown and
   * still refuses the order. The two quote services prove it is still live.
   */
  const orderableEntries = CATALOG.filter((e) => e.orderType !== "quote");
  const quoteEntries = catalogByType("quote");

  for (const entry of orderableEntries) {
    rec(
      `${entry.serviceSlug}: carries a published price`,
      isKnown(entry.priceCents),
      money(entry.priceCents),
    );
    rec(
      `${entry.serviceSlug}: and can therefore be ordered once the gate lifts`,
      orderable(entry, false),
      orderBlockedReason(entry, false) ?? "",
    );
    rec(
      `${entry.serviceSlug}: the price is a whole number of cents`,
      Number.isInteger(entry.priceCents),
    );
    /*
     * A price under a hundred dollars on sealed engineering work is far more
     * likely to be dollars typed where cents were meant than a real price. The
     * bound is deliberately loose: it catches a factor of a hundred, not a
     * pricing decision.
     */
    rec(
      `${entry.serviceSlug}: the price is in cents, not dollars`,
      (entry.priceCents ?? 0) >= 10000,
      money(entry.priceCents),
    );
  }

  for (const entry of quoteEntries) {
    rec(`${entry.serviceSlug}: a quote service carries no price`, entry.priceCents === null);
    rec(
      `${entry.serviceSlug}: and no inspection fee`,
      entry.inspectionFeeCents === null,
      "nothing is owed until a scope is accepted",
    );
  }

  /*
   * The operator set the fee on field services only. A desk review has no
   * visit, so a fee on one would be a deduction the middle row of the refund
   * rule can never justify: it would retain money for an inspection that did
   * not happen.
   */
  for (const entry of catalogByType("field")) {
    rec(
      `${entry.serviceSlug}: a field service discloses an inspection fee`,
      isKnown(entry.inspectionFeeCents),
      money(entry.inspectionFeeCents),
    );
    rec(
      `${entry.serviceSlug}: and the fee is less than the price`,
      (entry.inspectionFeeCents ?? 0) < (entry.priceCents ?? 0),
      `${money(entry.inspectionFeeCents)} of ${money(entry.priceCents)}`,
    );
  }

  for (const entry of catalogByType("desk")) {
    rec(
      `${entry.serviceSlug}: a desk service retains nothing on a decline`,
      entry.inspectionFeeCents === null,
      "there is no visit to retain a fee for",
    );
  }

  /*
   * One surcharge, everywhere it applies. Three different coastal figures would
   * be three prices for the same fact about a property, and the customer
   * comparing two services on the same address would find the coast costing
   * different amounts.
   */
  const surcharges = new Set(
    orderableEntries.map((e) => e.coastalSurchargeCents).filter((c) => c !== null),
  );
  rec(
    "the coastal surcharge is on desk deliverables as well as field ones",
    catalogByType("desk").every((e) => isKnown(e.coastalSurchargeCents)),
    "operator ruling: the engineer does more work whether or not anybody drives out",
  );
  rec(
    "the coastal surcharge is one figure across every orderable service",
    surcharges.size === 1,
    [...surcharges].map((c) => money(c)).join(", "),
  );
  rec(
    "and every orderable service has it set",
    orderableEntries.every((e) => isKnown(e.coastalSurchargeCents)),
    "a coastal property must never be quoted the inland price",
  );

  /*
   * The unpriced path still has to work, because the two quote services use it
   * and because a service added tomorrow will start there. Proven on a copy
   * with the price removed rather than by finding an unpriced entry, since
   * there are no longer any orderable ones.
   */
  const unpriced = { ...orderableEntries[0], priceCents: null };
  rec(
    "removing a price still refuses the order",
    !orderable(unpriced, false),
    orderBlockedReason(unpriced, false) ?? "",
  );
  rec(
    "and still says the price is not published",
    /price has not been published/.test(orderBlockedReason(unpriced, false) ?? ""),
  );

  for (const entry of catalogByType("field")) {
    const noFee = { ...entry, inspectionFeeCents: null };
    rec(
      `${entry.serviceSlug}: a field order with no inspection fee cannot be taken`,
      !orderable(noFee, false),
      "the refund rule cannot be disclosed without it",
    );
    rec(
      "and the reason names the refund rule",
      /refund rule/.test(orderBlockedReason(noFee, false) ?? ""),
    );
  }

  const field = catalogByType("field")[0];
  const q = quoteFor({ ...field, priceCents: null }, false);
  rec("an unpriced quote has no total", q.totalCents === null);
  rec("and says why rather than showing nothing", Boolean(q.unavailable));
  rec("and never renders a dollar zero", !/\$0\.00/.test(JSON.stringify(q)));

  const okQuote = quoteFor(priced(field), false);
  rec("a priced inland quote totals the base price", okQuote.totalCents === FIXTURE_PRICE);
  rec("and is available", okQuote.unavailable === null);
  rec("and is one line", okQuote.lines.length === 1);

  const coastal = quoteFor(priced(field), true, "Nueces");
  rec("a coastal quote adds a second line", coastal.lines.length === 2);
  rec(
    "the base line is unchanged by the coastal surcharge",
    coastal.lines[0].amountCents === FIXTURE_PRICE,
    "never a higher base with no explanation",
  );
  rec("the coastal line is named", /coastal/i.test(coastal.lines[1].label));
  rec("and explains itself", (coastal.lines[1].note ?? "").length > 40);
  rec("and names the county", /Nueces/.test(coastal.lines[1].note ?? ""));
  rec("the total is base plus surcharge", coastal.totalCents === FIXTURE_PRICE + FIXTURE_COASTAL);

  const coastalNoSurcharge = quoteFor(priced(field, { coastalSurchargeCents: null }), true, "Nueces");
  rec(
    "a coastal property with no published surcharge does not quote the inland price",
    coastalNoSurcharge.totalCents === null && Boolean(coastalNoSurcharge.unavailable),
    "quoting the base would be a price the firm cannot honour",
  );
  rec(
    "and says so in terms of the coast",
    /windstorm designated/i.test(coastalNoSurcharge.unavailable ?? ""),
  );
}

// ===========================================================================
// 3. THE COMPLIANCE GATE
// ===========================================================================
{
  for (const entry of CATALOG) {
    rec(
      `${entry.serviceSlug}: cannot be ordered in prelaunch`,
      !orderable(priced(entry), true),
      "including quote requests, which are still the firm taking work",
    );
  }
  const reason = orderBlockedReason(priced(CATALOG[0]), true);
  rec("the prelaunch refusal names the registration", /TBPELS|Texas Board of Professional/.test(reason ?? ""));
  rec("and says no payment can be taken", /no payment/i.test(reason ?? ""));

  rec(
    "an unknown service is refused rather than defaulted",
    !orderable(catalogFor("no-such-service"), false),
  );
  rec(
    "and the refusal says it is not in the catalog",
    /not in the order catalog/.test(orderBlockedReason(catalogFor("no-such-service"), false) ?? ""),
  );

  /*
   * A quote is the only thing orderable outside prelaunch today, because it
   * takes no money. If that ever stops being true, this check is where it
   * surfaces.
   */
  const quoteEntry = catalogByType("quote")[0];
  rec("a quote request is available once the gate lifts", orderable(quoteEntry, false));
  rec("and blocked while it has not", !orderable(quoteEntry, true));
}

// ===========================================================================
// 4. QUALIFICATION
// ===========================================================================
{
  const entry = CATALOG.find((e) => e.qualifiers.some((q) => isGating(q)));
  rec("some service has a disqualifying question", Boolean(entry));

  const good = qualify(entry, answerAll(entry));
  rec("answering everything acceptably qualifies", good.ok, JSON.stringify(good));

  rec("no answers at all is a refusal", !qualify(entry, []).ok);
  rec("and names the question still needed", /still needs an answer/.test(qualify(entry, []).message));

  const gating = entry.qualifiers.find((q) => isGating(q));
  const bad = qualify(
    entry,
    answerAll(entry, (q) => (q.id === gating.id ? gating.disqualifyOn[0] : 0)),
  );
  rec("a disqualifying answer is refused", !bad.ok);
  rec("and the refusal is the catalog's own words", bad.message === gating.disqualifiedMessage);
  rec("and names which question did it", bad.qualifierId === gating.id);

  /*
   * The one that matters. Skipping the question must never pass, because the
   * skipped question is "can the roof be reached safely" and the consequence is
   * a technician on a ladder the customer already knew about.
   */
  const skipped = qualify(
    entry,
    answerAll(entry).filter((a) => a.qualifierId !== gating.id),
  );
  rec("skipping a disqualifying question does not qualify", !skipped.ok);
  rec("and is reported as unanswered rather than as a disqualification", skipped.unanswered === true);

  const outOfRange = qualify(
    entry,
    answerAll(entry, (q) => (q.id === gating.id ? 99 : 0)),
  );
  rec("an answer outside the options is refused", !outOfRange.ok);
  rec("and is not silently treated as the first option", outOfRange.unanswered === true);
}

// ===========================================================================
// 5. THE REFUND RULE. Operator ruling, 2026-09-02.
// ===========================================================================
{
  const base = { paidCents: FIXTURE_PRICE, inspectionFeeCents: FIXTURE_FEE };

  const sealed = refundFor({ ...base, outcome: "seal", technicianVisited: true });
  rec("a seal refunds nothing", sealed.refundCents === 0);
  rec("and retains the whole price", sealed.retainedCents === FIXTURE_PRICE);

  const beforeVisit = refundFor({ ...base, outcome: "refuse", technicianVisited: false });
  rec("row 1: declined with no visit is a full refund", beforeVisit.refundCents === FIXTURE_PRICE);
  rec("and retains nothing", beforeVisit.retainedCents === 0);
  rec("and the customer still gets the findings", beforeVisit.receivesFindings === true);

  const afterVisit = refundFor({ ...base, outcome: "refuse", technicianVisited: true });
  rec(
    "row 2: declined after a visit retains exactly the disclosed inspection fee",
    afterVisit.retainedCents === FIXTURE_FEE,
    "never a proportion of the price",
  );
  rec("and refunds the rest", afterVisit.refundCents === FIXTURE_PRICE - FIXTURE_FEE);
  rec("and the customer receives the engineer's findings", afterVisit.receivesFindings === true);
  rec("and the explanation names the amount", /\$300\.00/.test(afterVisit.explanation));

  /*
   * Row 3 is row 1 in the code, deliberately. A desk review has no visit, so the
   * money is identical and two branches that must never diverge are one branch.
   */
  const afterDesk = refundFor({ ...base, outcome: "refuse", technicianVisited: false });
  rec("row 3: declined after desk review is a full refund", afterDesk.refundCents === FIXTURE_PRICE);
  rec("and is the same computation as row 1", afterDesk.caseName === beforeVisit.caseName);

  // ---- the invariants, across a matrix rather than at three points ----
  let noVisitAlwaysFull = true;
  let neverOverpaid = true;
  let retainedNeverExceedsFee = true;
  let alwaysFindingsWhenRetaining = true;
  let refusalNeverBeatsSeal = true;

  for (const paid of [1, 5000, 30000, 100000, 999999]) {
    for (const fee of [0, 1, 29999, 30000, 100000, 500000]) {
      const noVisit = refundFor({
        paidCents: paid,
        inspectionFeeCents: fee,
        outcome: "refuse",
        technicianVisited: false,
      });
      if (noVisit.refundCents !== paid || noVisit.retainedCents !== 0) noVisitAlwaysFull = false;

      const visited = refundFor({
        paidCents: paid,
        inspectionFeeCents: fee,
        outcome: "refuse",
        technicianVisited: true,
      });
      if (visited.refundCents + visited.retainedCents !== paid) neverOverpaid = false;
      if (visited.retainedCents > fee || visited.retainedCents > paid) retainedNeverExceedsFee = false;
      if (visited.retainedCents > 0 && !visited.receivesFindings) alwaysFindingsWhenRetaining = false;

      const sealedSame = refundFor({
        paidCents: paid,
        inspectionFeeCents: fee,
        outcome: "seal",
        technicianVisited: true,
      });
      if (visited.retainedCents > sealedSame.retainedCents) refusalNeverBeatsSeal = false;
    }
  }

  rec("INVARIANT: a refusal with no visit is always a full refund", noVisitAlwaysFull, "30 combinations");
  rec("INVARIANT: refund plus retained always equals what was paid", neverOverpaid);
  rec(
    "INVARIANT: what is retained never exceeds the fee or the payment",
    retainedNeverExceedsFee,
    "a fee above the price refunds nothing rather than charging more",
  );
  rec(
    "INVARIANT: the customer receives the findings whenever the firm retains money",
    alwaysFindingsWhenRetaining,
    "keeping money and handing over nothing is not a refund policy",
  );
  rec(
    "INVARIANT: refusing is never worth more to the firm than sealing",
    refusalNeverBeatsSeal,
    "the ruling forbids pressure toward a favourable conclusion",
  );

  const unknownFee = refundFor({
    paidCents: FIXTURE_PRICE,
    inspectionFeeCents: null,
    outcome: "refuse",
    technicianVisited: true,
  });
  rec("an unknown inspection fee refuses to compute", unknownFee.refundCents === null);
  rec("and does not refund zero", unknownFee.refundCents !== 0);
  rec("and says nobody should act on it", /should act on this until/.test(unknownFee.explanation));
}

// ===========================================================================
// 6. THE DISCLOSURE, WHICH IS THE PART THE CUSTOMER ACTUALLY READS
// ===========================================================================
{
  const fieldEntry = priced(catalogByType("field")[0]);
  const lines = refundDisclosure(fieldEntry);
  const text = lines.join(" ");

  rec("the disclosure states the engineer may decline", /decline/i.test(text));
  rec("and lists all four outcomes", /revisions/.test(text) && /another visit/.test(text));
  rec("and names the inspection fee amount", /\$300\.00/.test(text));
  rec(
    "and says paying does not buy a seal",
    /Paying does not buy a seal/.test(text),
    "the one sentence that keeps this lawful to sell",
  );
  rec("and promises no further charge on a decline", /never charged more/.test(text));

  const unset = refundDisclosure({ ...catalogByType("field")[0], inspectionFeeCents: null });
  rec(
    "with no fee set, the disclosure says so rather than naming a number",
    /not published yet/.test(unset.join(" ")) && !/\$/.test(unset.join(" ")),
  );

  const deskLines = refundDisclosure(priced(catalogByType("desk")[0])).join(" ");
  rec("a desk order discloses a full refund and no visit", /no site visit/.test(deskLines));
  rec("and never mentions an inspection fee", !/inspection/i.test(deskLines));
}

// ===========================================================================
// 7. THE TWO STATE MACHINES
// ===========================================================================
{
  rec("an order cannot skip payment", !canTransitionOrder("draft", "paid"));
  rec("an unpaid order cannot be worked", !canTransitionOrder("awaiting_payment", "in_fulfilment"));
  rec("a paid order can be refunded", canTransitionOrder("paid", "refunded"));
  rec("a completed order can still be refunded", canTransitionOrder("complete", "refunded"));

  for (const terminal of ["refunded", "cancelled"]) {
    const escapes = ORDER_STATUSES.filter((s) => canTransitionOrder(terminal, s));
    rec(`nothing leaves ${terminal}`, escapes.length === 0, escapes.join(", "));
  }

  rec(
    "every order status has customer facing words",
    ORDER_STATUSES.every((s) => (CUSTOMER_STATUS[s] ?? "").length > 10),
  );
  rec(
    "and none of them uses the platform's vocabulary",
    !Object.values(CUSTOMER_STATUS).some((s) => /fulfilment|dispatch|responsible charge/i.test(s)),
    "the portal exists to stop a phone call, not to make one",
  );

  rec("a new quote cannot be sent before it is scoped", !canTransitionQuote("new", "sent"));
  rec("a sent quote can expire", canTransitionQuote("sent", "expired"));
  rec("an expired quote can be picked back up", canTransitionQuote("expired", "scoping"));
  for (const terminal of ["accepted", "declined"]) {
    const escapes = QUOTE_STATUSES.filter((s) => canTransitionQuote(terminal, s));
    rec(`nothing leaves ${terminal}`, escapes.length === 0, escapes.join(", "));
  }

  rec("only an accepted quote becomes an order", convertibleToOrder("accepted"));
  rec(
    "a sent quote does not",
    QUOTE_STATUSES.filter((s) => convertibleToOrder(s)).length === 1,
    "converting one the customer never accepted is a billing dispute",
  );

  rec("a paid field order goes to dispatch", landingStatusFor("field") === "needs_dispatch");
  rec("a paid desk order goes straight to review", landingStatusFor("desk") === "evidence_submitted");
  rec("a quote lands nowhere until it is converted", landingStatusFor("quote") === null);
}

// ===========================================================================
// 8. THE CATALOG IS A SYNCHRONIZED FILE
// ===========================================================================
{
  const src = fs.readFileSync("data/catalog.ts", "utf8");
  /*
   * Flattened, because these assertions are about what the file SAYS and not
   * about where a comment happens to wrap. The first version matched a phrase
   * that spanned two lines and failed on the line break rather than on the
   * absence of the sentence.
   */
  const flat = src.replace(/\s*\n\s*\*?\s*/g, " ");
  rec("the catalog says it is synchronized across the three repos", /SYNCHRONIZED FILE/.test(src));
  /*
   * The header used to have to explain why every price was null. Now it has to
   * record whose prices these are, which is the same protection pointed the
   * other way: a figure with no attribution is one a later session cannot tell
   * from an invented one.
   */
  rec(
    "the catalog records that the prices are the operator's",
    /THE PRICES ARE THE OPERATOR'S/.test(src),
    "a price with no attribution cannot be told from an invented one",
  );
  rec(
    "and names the two products the ruling had nowhere to put",
    /beam and header sizing/.test(src) && /carport and patio cover/.test(src),
    "absent deliberately, not overlooked",
  );
  rec(
    "and still explains that a null price refuses the order",
    /nothing is owed on a quote request/.test(src),
  );

  /*
   * Recorded at the operator's instruction, 2026-09-03. Harris is the one county
   * where the surcharge question has no answer from a name, and the reasoning
   * has to live where somebody changing the surcharge will read it.
   */
  rec(
    "the catalog records why Harris County carries no surcharge",
    /State Highway 146/.test(flat),
    "the designated area is a line through the county, not the county",
  );
  rec(
    "and says what would have to change for it to",
    /place a property against that line/.test(flat),
  );
  rec(
    "and that the surcharge applies to desk work too",
    /whether or not anybody drives out/.test(flat),
  );
  rec(
    "the catalog imports the money type rather than using plain numbers",
    /type \{ Cents \}/.test(src),
    "a price that cannot be null is a price that will be zero",
  );
}

// ===========================================================================
// 9. WHERE A PAID CUSTOMER IS SENT BACK TO
// ===========================================================================
{
  /*
   * The first real Stripe payment redirected a customer paying on a preview to
   * production, which did not have their order and answered 404. A deployment
   * that sends people somewhere other than itself cannot be exercised end to
   * end, and the version that matters is a preview handing a real customer a
   * link into production.
   */
  const prod = deploymentOrigin({ VERCEL_ENV: "production", VERCEL_BRANCH_URL: "main-abc.vercel.app" });
  rec("production sends a customer to the canonical domain", prod === "https://254engineering.com", prod);
  rec(
    "and never to its own vercel.app hostname",
    !prod.includes("vercel.app"),
    "a receipt should not link to a host the firm does not publish",
  );

  const preview = deploymentOrigin({
    VERCEL_ENV: "preview",
    VERCEL_BRANCH_URL: "branch-alias.vercel.app",
    VERCEL_URL: "one-deployment.vercel.app",
  });
  rec("a preview sends a customer back to itself", preview === "https://branch-alias.vercel.app", preview);
  rec(
    "preferring the branch alias over the deployment url",
    !preview.includes("one-deployment"),
    "the alias is stable across deployments of the same branch",
  );

  const noAlias = deploymentOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "one-deployment.vercel.app" });
  rec("and falls back to the deployment url when there is no alias", noAlias === "https://one-deployment.vercel.app");

  const local = deploymentOrigin({});
  rec(
    "a local machine falls back to the real site rather than a guessed port",
    local === "https://254engineering.com",
    local,
  );
}

// ===========================================================================
// 10. THE CUSTOMER'S PATH THROUGH AN ORDER
// ===========================================================================
{
  const roof = catalogFor("roof-inspections");
  const design = deliverablesFor("residential-light-commercial-design");
  const custom = design.find((d) => d.tier === "custom-package");

  /*
   * The program describes six steps and a customer never sees six. Rendering
   * all of them and greying four out would make the flow look longer than it
   * is, and abandonment on a form tracks its apparent length.
   */
  const single = stepsFor(roof, 1).map((s) => s.id);
  rec(
    "a single deliverable line does not ask which deliverable",
    !single.includes("deliverable"),
    single.join(" > "),
  );
  rec("and ends at payment", single[single.length - 1] === "pay", single.join(" > "));

  const many = stepsFor(null, 3).map((s) => s.id);
  rec("a line selling three things asks which one first", many[0] === "deliverable", many.join(" > "));
  rec(
    "and asks nothing else until it is answered",
    many.length === 1,
    "the later steps depend on which deliverable it is",
  );

  const quoteSteps = stepsFor(custom, 3).map((s) => s.id);
  rec("a quote deliverable has no payment step", !quoteSteps.includes("pay"), quoteSteps.join(" > "));
  rec("and still shows terms before sending", quoteSteps.includes("review"));

  /*
   * The one that matters most. A customer must not be able to reach payment
   * without the refund rule having been on screen, because that disclosure is
   * the operator's ruling and a checkout reached around it is a charge under
   * terms nobody was shown.
   */
  const state = emptyState("standard");
  state.property = { propertyAddress: "1 Somewhere", city: "Corpus Christi", county: "", postalCode: "" };
  state.customer = { name: "A Person", email: "a@example.com", phone: "", company: "" };
  state.answers = roof.qualifiers.map((q) => ({ qualifierId: q.id, optionIndex: 0 }));
  state.inputs = { access_notes: "Gate code." };

  rec(
    "everything else complete, the review step still blocks",
    blockersOn("review", roof, state).length === 1,
    blockersOn("review", roof, state).join(" | "),
  );
  rec(
    "and says it is the decline terms that are unread",
    /declines/.test(blockersOn("review", roof, state)[0] ?? ""),
  );
  state.acceptedTerms = true;
  rec("accepting them clears it", blockersOn("review", roof, state).length === 0);

  // A skipped qualifier is named, not summarised.
  const half = emptyState("standard");
  half.answers = [{ qualifierId: roof.qualifiers[0].id, optionIndex: 0 }];
  const missing = blockersOn("qualify", roof, half);
  rec("an unanswered question is listed by its own words", missing.length === roof.qualifiers.length - 1);
  rec(
    "and never as a generic please complete all fields",
    !missing.some((m) => /all fields|required fields/i.test(m)),
    missing[0],
  );

  // Required files are demanded; optional ones are not.
  const solar = catalogFor("solar-structural-letters");
  const noDocs = emptyState("standard");
  const need = blockersOn("requirements", solar, noDocs);
  rec(
    "a desk deliverable demands its required documents",
    need.length === solar.requiredInputs.filter((i) => i.required).length,
    need.join(" | "),
  );
  rec(
    "and does not demand the optional ones",
    !need.some((n) => n === solar.requiredInputs.find((i) => !i.required)?.label),
  );

  const withDocs = emptyState("standard");
  withDocs.files = { layout: [{ name: "a.pdf", storageKey: "k", bucket: "b" }], mounting: [{ name: "b.pdf", storageKey: "k2", bucket: "b" }] };
  rec("supplying them clears it", blockersOn("requirements", solar, withDocs).length === 0);

  // firstIncomplete sends somebody back to the right place, not to the start.
  const partial = emptyState("standard");
  partial.answers = roof.qualifiers.map((q) => ({ qualifierId: q.id, optionIndex: 0 }));
  rec(
    "a half finished flow resumes at the first thing missing",
    firstIncomplete(stepsFor(roof, 1), roof, partial) === "property",
    String(firstIncomplete(stepsFor(roof, 1), roof, partial)),
  );

  /*
   * The browser never prices anything. A price computed in a browser is a price
   * a browser can change, and the server recomputes from the catalog anyway.
   */
  const flowSource = fs.readFileSync("src/components/order/OrderFlow.tsx", "utf8");
  rec(
    "the flow component never totals a price itself",
    !/priceCents\s*\+|\+\s*coastalSurchargeCents/.test(flowSource),
    "the server computes every total",
  );
  rec(
    "and says card details never reach this site",
    /never reach this site/.test(flowSource),
  );
}

// ===========================================================================
// 11. RECONCILING AGAINST THE PROVIDER
//
// The webhook is a message and messages are lost. These are the answers the
// platform gives when it asks the provider directly, and the ones that matter
// most are the refusals: a wrong reading here cancels an order somebody paid
// for, or records money that never moved.
// ===========================================================================
{
  const session = (over = {}) => ({
    known: true,
    status: {
      ref: "cs_test_x",
      state: "complete",
      paid: true,
      chargeRef: "pi_x",
      amountCents: 67500,
      orderId: "o1",
      ...over,
    },
  });
  const order = (totalCents) => ({ totalCents });

  // The reason the whole thing exists.
  const lost = judge(order(67500), session());
  rec("a paid session the platform never recorded is found", lost.verdict === "paid_unrecorded");
  rec("and is acted on", lost.intent === "record_payment", lost.detail);

  // Abandoned.
  const gone = judge(order(67500), session({ paid: false, state: "expired", chargeRef: null, amountCents: null }));
  rec("an expired unpaid session is an abandonment", gone.verdict === "abandoned");
  rec("and is cancelled rather than left waiting forever", gone.intent === "cancel", gone.detail);
  rec("and the customer is told nothing was charged", /nothing was charged/i.test(gone.detail));

  // Still payable. The one an impatient sweep would wrongly close.
  const live = judge(order(67500), session({ paid: false, state: "open", chargeRef: null, amountCents: null }));
  rec("a session the customer can still pay is left alone", live.verdict === "still_open");
  rec("and nothing is done to it", live.intent === "none", live.detail);

  // ---- the refusals ----

  const mismatch = judge(order(67500), session({ amountCents: 45000 }));
  rec("a payment for a different amount is not recorded", mismatch.intent === "none");
  rec("and is reported as a disagreement", mismatch.verdict === "amount_disagrees");
  rec("naming both figures", /675/.test(mismatch.detail) && /450/.test(mismatch.detail), mismatch.detail);

  const unpriced = judge(order(null), session());
  rec("a paid order that was never priced is not recorded either", unpriced.intent === "none");
  rec(
    "because there would be no price to reconstruct",
    unpriced.verdict === "amount_disagrees",
    unpriced.detail,
  );

  const noCharge = judge(order(67500), session({ chargeRef: null }));
  rec("paid with nothing to record it against is refused", noCharge.intent === "none", noCharge.detail);

  /*
   * The dangerous one. A session id the provider does not recognise is almost
   * always an id from the other mode, and reading it as unpaid would cancel an
   * order that had been paid for.
   */
  const foreign = judge(order(67500), { known: false, reason: "unknown_to_provider" });
  rec("a session the provider does not know is NOT treated as unpaid", foreign.intent !== "cancel");
  rec("and does nothing at all", foreign.intent === "none", foreign.detail);
  rec(
    "and says why that is not evidence of non payment",
    /not evidence/i.test(foreign.detail),
    foreign.detail,
  );

  const never = judge(order(67500), { known: false, reason: "no_session" });
  rec("an order that never reached checkout is not cancelled by the sweep", never.intent === "none");
  rec("and sends the operator to look by hand", /by hand/i.test(never.detail), never.detail);

  const down = judge(order(67500), { known: false, reason: "unreachable", message: "connect ETIMEDOUT" });
  rec("a provider that cannot be reached changes nothing", down.intent === "none");
  rec("and reports the reason rather than a verdict", /ETIMEDOUT/.test(down.detail), down.detail);

  /*
   * No answer may ever both refuse to record a payment and cancel the order.
   * That combination is the one that loses a customer their money, so it is
   * asserted across every case rather than argued about per case.
   */
  const every = [lost, gone, live, mismatch, unpriced, noCharge, foreign, never, down];
  rec(
    "no case cancels an order the provider says was paid",
    !every.some((j) => j.intent === "cancel" && j.verdict !== "abandoned"),
  );
  rec("and only one verdict ever cancels", every.filter((j) => j.intent === "cancel").length === 1);
  rec("and only one verdict ever records money", every.filter((j) => j.intent === "record_payment").length === 1);

  // The route that carries it must be admin only and read by default.
  const route = fs.readFileSync("src/app/api/portal/orders/reconcile/route.ts", "utf8");
  rec(
    "the reconcile route checks payments.reconcile",
    route.includes('can(actor, "payments.reconcile")'),
  );
  rec(
    "a GET on it can never apply",
    !/export async function GET[\s\S]{0,500}apply: true/.test(route),
    "a link followed in a browser must not move money",
  );
  rec("and applying is opt in rather than the default", route.includes("body?.apply === true"));

  // The webhook must record a dashboard refund rather than only logging it.
  const hook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  rec("a refund made outside the platform is written down", hook.includes("recordExternalRefund("));

  /*
   * The one that cost four real refunds. readEvent required
   * charge.refunds.data[0], which Stripe does not expand on the charge object
   * it sends, so every delivery returned null, answered 200 and wrote nothing.
   */
  const adapter = fs.readFileSync("src/lib/payments-stripe.ts", "utf8");
  const refundBranch = adapter.slice(adapter.indexOf('event.type === "charge.refunded"'));
  rec(
    "a refund event does not depend on a field Stripe does not send",
    !/if \(!intent \|\| !latest\)/.test(refundBranch),
    "charge.refunds is a paginated sub list and arrives unexpanded",
  );
  rec(
    "and takes the amount from amount_refunded, which is always present",
    /charge\.amount_refunded/.test(refundBranch),
  );
  rec(
    "and carries it under a name that says it is cumulative",
    /refundedToDateCents/.test(refundBranch),
    "a single refund amount and a running total must not share a field name",
  );

  const pay = fs.readFileSync("src/lib/ops-payments.ts", "utf8");
  const recorder = pay.slice(pay.indexOf("export async function recordExternalRefund"));
  rec(
    "the recorder writes the difference rather than the running total",
    /const delta = input\.refundedToDateCents - alreadyRefunded/.test(recorder),
    "writing the total whole would double the ledger on a second partial refund",
  );
  rec(
    "and writes nothing when the ledger already agrees",
    /if \(delta <= 0\)/.test(recorder),
  );
  rec(
    "and an expired checkout closes the order rather than only noting it",
    hook.includes("markAbandoned("),
  );
}

// ===========================================================================
// 12. NOTICING AN ORDER THAT HAS STOPPED
// ===========================================================================
{
  const H = 60 * 60 * 1000;
  const now = Date.parse("2026-09-03T18:00:00Z");
  const ago = (hours) => new Date(now - hours * H).toISOString();
  const order = (over = {}) => ({
    status: "awaiting_payment",
    placedAt: ago(48),
    hasPayment: false,
    hasCheckout: true,
    ...over,
  });

  // The case the whole module exists for.
  const stuck = attentionFor(order(), now);
  rec("an unpaid checkout older than a day is flagged", stuck.level === "act", stuck.label);
  rec(
    "and says a payment may have been taken rather than assuming nobody paid",
    /either an abandonment|payment nobody recorded/i.test(stuck.detail),
    stuck.detail,
  );

  /*
   * The false alarm that would make the whole screen worthless. A customer who
   * opened a checkout twenty minutes ago is not a fault, and an operator shown
   * four of those a day stops reading the fifth.
   */
  rec("a checkout opened minutes ago is not a fault", attentionFor(order({ placedAt: ago(0.3) }), now).level === "none");
  rec("nor one at 23 hours", attentionFor(order({ placedAt: ago(23) }), now).level === "none");
  rec(
    "and the boundary is the checkout session own life",
    attentionFor(order({ placedAt: ago(CHECKOUT_SESSION_HOURS + 0.1) }), now).level === "act",
    CHECKOUT_SESSION_HOURS + " hours",
  );

  // A paid order is never reported as stuck, whatever else is true of it.
  rec("a paid order is never stuck", attentionFor(order({ hasPayment: true }), now).level === "none");
  rec(
    "even one whose status never advanced",
    attentionFor(order({ hasPayment: true, placedAt: ago(500) }), now).level === "none",
    "that is a different fault and belongs on a different screen",
  );

  // Never reached checkout: nothing can have been charged.
  const never = attentionFor(order({ hasCheckout: false }), now);
  rec("an order that never reached checkout is only watched", never.level === "watch");
  rec(
    "and says plainly that nothing can have been charged",
    /nothing can have been charged/i.test(never.detail),
    never.detail,
  );

  // An unknown age is a fault rather than a pass.
  const undated = attentionFor(order({ placedAt: null }), now);
  rec("an unpaid order with no placed date is flagged, not waved through", undated.level === "act");

  // Nothing downstream of payment is judged here.
  for (const st of ["draft", "paid", "in_fulfilment", "complete", "refunded", "cancelled"]) {
    rec(st + " is not this screen business", attentionFor(order({ status: st }), now).level === "none");
  }

  rec("the worst level wins on a dashboard", worstLevel(["none", "watch", "act"]) === "act");
  rec("and a quiet set stays quiet", worstLevel(["none", "none"]) === "none");
}

// ===========================================================================
// 13. THE FOURTH REFUND CASE: THE FIRM CANCELS
// ===========================================================================
{
  /*
   * Kept apart from the engineer three cases on purpose. The invariant that
   * matters is that cancelling is always the MOST expensive option for the
   * firm, so it can never be the cheap way out of an awkward decision to seal.
   */
  const cancelled = refundForFirmCancellation({ paidCents: 67500 });
  rec("a firm cancellation refunds everything", cancelled.refundCents === 67500);
  rec("and retains nothing", cancelled.retainedCents === 0);
  rec("and is named as the firm doing", /cancelled by the firm/i.test(cancelled.caseName));
  rec(
    "and tells the customer the decision was not theirs",
    /and not yours|decision to stop was the firm/i.test(cancelled.explanation),
    cancelled.explanation,
  );

  /*
   * The comparison that carries the ethics rule. A technician attended, so the
   * engineer rule retains the inspection fee; the firm cancellation does not,
   * because the customer received nothing they asked for.
   */
  const engineerDeclined = refundFor({
    paidCents: 67500,
    inspectionFeeCents: 17500,
    outcome: "refuse",
    technicianVisited: true,
  });
  rec("an engineer declining after a visit still retains the disclosed fee", engineerDeclined.retainedCents === 17500);
  rec(
    "and the firm cancelling the same order retains nothing",
    refundForFirmCancellation({ paidCents: 67500 }).retainedCents === 0,
  );
  /*
   * STRICTLY more, not "at least as much". An earlier version of this check
   * used >=, and an injected version that retained exactly the inspection fee
   * on a firm cancellation slipped past it: the two came out equal. Equal is
   * not good enough. Once a technician has attended, cancelling must cost the
   * firm MORE than declining, or the two are interchangeable at the moment the
   * engineer is deciding.
   */
  rec(
    "so cancelling costs the firm strictly more than declining, once anybody has attended",
    refundForFirmCancellation({ paidCents: 67500 }).refundCents > engineerDeclined.refundCents,
    "if they were equal, cancelling would be an interchangeable way out of an engineering decision",
  );

  // An unknown amount refuses rather than guessing, exactly as refundFor does.
  const unknown = refundForFirmCancellation({ paidCents: null });
  rec("an unknown paid amount refuses to compute", !isKnown(unknown.refundCents));
  rec("and retains nothing rather than zero", !isKnown(unknown.retainedCents));

  rec("the stored case name has one spelling", FIRM_CANCELLATION_CASE === "cancelled_by_the_firm");

  // The writer, and the route that carries it.
  const pay = fs.readFileSync("src/lib/ops-payments.ts", "utf8");
  const fn = pay.slice(pay.indexOf("export async function cancelAndRefund"));
  rec("cancelling requires a written reason", /reason\.length < 10/.test(fn));
  rec(
    "and refuses an order that cannot be refunded rather than forcing it",
    /canTransitionOrder\(order\.status/.test(fn),
  );
  rec(
    "and records the refund row before moving the order to refunded",
    fn.indexOf("eng_order_payments") < fn.indexOf('status: "refunded"'),
    "settleDecision once told a customer they were refunded whether or not the ledger agreed",
  );
  rec("and writes the audit row against the operator", /action: "order\.cancelled_by_firm"/.test(fn));

  const route = fs.readFileSync("src/app/api/portal/orders/refund/route.ts", "utf8");
  rec("the refund route checks payments.refund", route.includes('can(actor, "payments.refund")'));
  rec(
    "and has no GET at all",
    !/export async function GET/.test(route),
    "a link must never be able to move a customer money",
  );

  // The dashboard has to be able to see it, or nobody is told.
  const dash = fs.readFileSync("src/lib/ops-dashboard.ts", "utf8");
  rec("the dashboard counts stuck orders", /ordersNeedingAttention\(\)/.test(dash));
  rec("and gives them a tile", /Orders stuck on payment/.test(dash));
  rec("and puts them in the attention list", /stuck on payment/.test(dash));
}

// ===========================================================================
// 14. CREDIT: WHETHER THE FIRM TAKES WORK IT MAY NOT BE PAID FOR
// ===========================================================================
{
  const acct = (over = {}) => ({
    billingMode: "invoice",
    status: "active",
    creditLimitCents: 500000,
    outstandingCents: 0,
    oldestUnpaidDays: null,
    netDays: 30,
    ...over,
  });

  /*
   * The inversion that matters most. The operator ruled credit terms default
   * to NONE. Written the other way round, every account created before
   * somebody set a limit would have an infinite one, and the first anybody
   * would know is a large unpaid balance.
   */
  const noTerms = creditDecision(acct({ creditLimitCents: null }), 67500);
  rec("a null credit limit means NO credit, never unlimited", !noTerms.ok);
  rec("and says the firm sets one rather than blaming the customer",
    noTerms.reason === "no_credit_terms" && /the firm sets one/i.test(noTerms.message),
    noTerms.message);

  // A card account is not on credit at all.
  const card = creditDecision(acct({ billingMode: "card", creditLimitCents: null }), 67500);
  rec("a card account is never refused for credit reasons", card.ok, card.reason);

  // Suspended and closed refuse before anything about money is considered.
  rec("a suspended account cannot order", !creditDecision(acct({ status: "suspended" }), 100).ok);
  rec("nor a closed one", !creditDecision(acct({ status: "closed" }), 100).ok);
  rec("and the two say different things",
    creditDecision(acct({ status: "suspended" }), 100).reason !==
      creditDecision(acct({ status: "closed" }), 100).reason);

  /*
   * Overdue is checked BEFORE the limit. An account within its limit that has
   * not paid a ninety day old statement is the worse case, and telling them
   * they are over their limit would be both wrong and confusing.
   */
  const late = creditDecision(acct({ oldestUnpaidDays: 90, outstandingCents: 100 }), 100);
  rec("an overdue account is refused even when well within its limit", !late.ok);
  rec("and is told it is overdue, not over limit", late.reason === "overdue", late.message);
  rec("and the terms are named in days", /30 day/.test(late.message), late.message);

  // Exactly at the terms is not yet overdue.
  rec("an account exactly at its terms is not yet overdue",
    creditDecision(acct({ oldestUnpaidDays: 30 }), 100).ok);
  rec("and one day past is", !creditDecision(acct({ oldestUnpaidDays: 31 }), 100).ok);

  /*
   * An unknown balance refuses rather than assuming zero. Assuming zero is
   * assuming the flattering direction, which is the mistake Phase 6 exists to
   * prevent: an absent figure is not a zero.
   */
  const unknown = creditDecision(acct({ outstandingCents: null }), 67500);
  rec("an unknown balance refuses rather than assuming zero", !unknown.ok);
  rec("and says so plainly", unknown.reason === "outstanding_unknown", unknown.message);

  // The limit itself.
  rec("an order inside the limit is allowed",
    creditDecision(acct({ outstandingCents: 400000 }), 67500).ok);
  const over = creditDecision(acct({ outstandingCents: 450000 }), 67500);
  rec("an order that would cross the limit is refused", !over.ok);
  rec("and names both figures rather than just saying no",
    /5,175|5175/.test(over.message.replace(/[$.]/g, "")) && /5,000|5000/.test(over.message.replace(/[$.]/g, "")),
    over.message);

  // The projection includes the order being placed, not just what is owed.
  rec("the limit is tested against the balance PLUS this order",
    !creditDecision(acct({ outstandingCents: 499000 }), 67500).ok,
    "499 dollars owed plus a 675 dollar order crosses a 5000 dollar limit");

  // outstandingOf refuses to add an unknown to a known.
  rec("an outstanding total with an unknown part is unknown",
    outstandingOf({ issuedUnpaidCents: 1000, unbilledCents: null }) === null);
  rec("and a known one adds up",
    outstandingOf({ issuedUnpaidCents: 1000, unbilledCents: 500 }) === 1500);
}

// ===========================================================================
// 15. BULK: PARTIAL FAILURE IS EXPLICIT
// ===========================================================================
{
  const roof = catalogFor("roof-inspections");
  const TWIA = new Set(["Nueces"]);
  const good = (ref, county = "Bexar") => ({
    ref,
    propertyAddress: ref + " Somewhere St",
    county,
    answers: roof.qualifiers.map((q) => ({ qualifierId: q.id, optionIndex: 0 })),
  });
  // Answering the first qualifier with an option the catalog disqualifies on.
  // The shape is options: string[] with disqualifyOn: number[], so the bad
  // answer is an INDEX the catalog names rather than a flag on the option.
  const badQ = roof.qualifiers.findIndex((q) => q.disqualifyOn.length > 0);
  const badIndex = roof.qualifiers[badQ].disqualifyOn[0];
  const bad = (ref) => ({
    ...good(ref),
    answers: roof.qualifiers.map((q, i) => ({
      qualifierId: q.id,
      optionIndex: i === badQ ? badIndex : 0,
    })),
  });

  /*
   * The operator rule, word for word: three of ten rejected, the customer is
   * told which and why before paying, and pays for seven.
   */
  const ten = [];
  for (let i = 1; i <= 7; i++) ten.push(good("P" + i));
  for (let i = 8; i <= 10; i++) ten.push(bad("P" + i));
  const split = splitBatch(roof, ten, TWIA);

  rec("ten submitted, seven accepted", split.accepted.length === 7, String(split.accepted.length));
  rec("and three rejected", split.rejected.length === 3, String(split.rejected.length));
  rec("the rejected are NAMED, not counted",
    split.rejected.map((r) => r.ref).join(",") === "P8,P9,P10",
    split.rejected.map((r) => r.ref).join(","));
  rec("each carries its own reason from the catalog",
    split.rejected.every((r) => r.reason && r.reason.length > 20),
    split.rejected[0] && split.rejected[0].reason);
  rec("and none of them says something generic",
    !split.rejected.some((r) => /rejected|invalid|error/i.test(r.reason)),
    "a reason a customer cannot act on is not a reason");
  rec("the total is for the seven only",
    split.totalCents === 7 * 60000,
    String(split.totalCents));

  // The summary names the split rather than summarising it away.
  const summary = splitSummary(split);
  rec("the summary says how many and that the rest are not charged for",
    /7 of 10/.test(summary) && /not charged/.test(summary), summary);

  // A duplicate reference is rejected rather than silently collapsed.
  const dupes = splitBatch(roof, [good("A"), good("A"), good("B")], TWIA);
  rec("a duplicate reference is rejected, not silently collapsed",
    dupes.accepted.length === 2 && dupes.rejected.length === 1,
    dupes.accepted.length + " accepted, " + dupes.rejected.length + " rejected");
  rec("and says why it matters",
    /matched back/i.test(dupes.rejected[0].reason), dupes.rejected[0].reason);

  // Missing fields are rejections with their own words, not crashes.
  const blanks = splitBatch(roof, [
    { ...good("X"), propertyAddress: "" },
    { ...good("Y"), county: "" },
  ], TWIA);
  rec("a property with no address is rejected", blanks.rejected.length === 2);
  rec("and the county rejection explains what county decides",
    /protocol and the price/i.test(blanks.rejected[1].reason), blanks.rejected[1].reason);

  /*
   * Nothing acceptable means no checkout. A checkout for zero properties is a
   * charge for nothing.
   */
  const none = splitBatch(roof, [bad("Z1"), bad("Z2")], TWIA);
  rec("a batch with nothing acceptable is flagged empty", none.empty);
  rec("and its total is zero rather than null", none.totalCents === 0);
  rec("and the summary says nothing will be charged",
    /Nothing will be charged/.test(splitSummary(none)), splitSummary(none));

  // The coastal surcharge applies per property, not per batch.
  const mixed = splitBatch(roof, [good("I1", "Bexar"), good("C1", "Nueces")], TWIA);
  rec("a coastal property in a batch carries the surcharge",
    mixed.accepted.find((a) => a.ref === "C1").priceCents === 67500,
    String(mixed.accepted.find((a) => a.ref === "C1").priceCents));
  rec("and an inland one in the same batch does not",
    mixed.accepted.find((a) => a.ref === "I1").priceCents === 60000,
    String(mixed.accepted.find((a) => a.ref === "I1").priceCents));
  rec("and the batch total is the sum of the two",
    mixed.totalCents === 127500, String(mixed.totalCents));

  /*
   * The shares are what a refund of one property out of a batch works from,
   * because the charge row belongs to the batch. They must sum to the total
   * exactly rather than being recomputed from a percentage later.
   */
  const shares = batchShares(mixed);
  rec("every accepted property has a share", shares.length === mixed.accepted.length);
  rec("and the shares sum to the batch total exactly",
    shares.reduce((n, s) => n + s.shareCents, 0) === mixed.totalCents,
    shares.map((s) => s.shareCents).join(" + "));
}

// ===========================================================================
// 16. THE MONEY PATH FOR A BATCH
//
// A batch payment is one payment covering many orders. Everything below is a
// way of getting that wrong, and each has a shape that would look like a
// working site.
// ===========================================================================
{
  const pay = fs.readFileSync("src/lib/ops-payments.ts", "utf8");
  const batchPaid = pay.slice(pay.indexOf("export async function markBatchPaid"));
  const batchCheckout = pay.slice(
    pay.indexOf("export async function startBatchCheckout"),
    pay.indexOf("export async function markBatchPaid"),
  );

  /*
   * ONE charge row for one payment. Ten charge rows for a ten property batch
   * would be ten times the money in the ledger, and every margin figure and
   * every refund computed from it would be wrong.
   */
  rec(
    "a batch payment writes its charge against the BATCH",
    /batch_id: input\.batchId,\s*\n\s*kind: "charge"/.test(batchPaid),
    "one payment, one row",
  );
  rec(
    "and never a charge row per order",
    !/order_id: o\.id[\s\S]{0,120}kind: "charge"/.test(batchPaid),
    "ten rows for one payment would be ten times the money",
  );
  rec(
    "and it is idempotent on the charge ref",
    /23505/.test(batchPaid),
    "Stripe delivers more than once",
  );
  rec(
    "and each order is released through the shared path",
    /releaseForFulfilment\(/.test(batchPaid),
    "so a batch order and a single order reach fulfilment the same way",
  );
  rec(
    "and an order that cannot transition is skipped rather than forced",
    /canTransitionOrder/.test(batchPaid),
  );

  /*
   * The line items must add up to what is charged. If they do not, something
   * upstream disagreed with itself and the customer would be charged a figure
   * no receipt explains.
   */
  rec(
    "a batch checkout refuses when its lines do not sum to its total",
    /lineTotal !== Number\(batch\.total_cents\)/.test(batchCheckout),
  );
  rec(
    "and the lines are per property rather than one opaque total",
    /o\.property_address/.test(batchCheckout),
    "a receipt somebody can check against what they submitted",
  );
  rec(
    "and the session says it is a batch",
    /subjectKind: "batch"/.test(batchCheckout),
    "an order id in the wrong key would send the payment to markPaid",
  );

  // An invoiced order is released without inventing a payment.
  const invoice = pay.slice(pay.indexOf("export async function acceptOnInvoice"));
  rec(
    "an invoiced order creates no charge row",
    !/eng_order_payments/.test(invoice.slice(0, invoice.indexOf("export async function", 10))),
    "nothing has been paid, and a zero amount row would be a lie in the ledger",
  );
  rec(
    "and is released through the same shared path as a paid one",
    /releaseForFulfilment\(/.test(invoice.slice(0, invoice.indexOf("export async function", 10))),
  );
  rec(
    "and tells the customer it will be on a statement rather than charged now",
    /statement rather than being charged now/.test(invoice),
  );

  // An abandoned batch closes its orders too.
  const abandon = pay.slice(pay.indexOf("export async function abandonBatch"));
  rec(
    "an abandoned batch closes every order under it",
    /markAbandoned\(o\.id/.test(abandon),
    "otherwise one abandonment puts ten rows on the stuck order screen",
  );
  rec(
    "and refuses to abandon a batch that was already paid",
    /status !== "awaiting_payment" && batch\.status !== "draft"/.test(abandon),
    "Stripe does not guarantee a completion arrives before an expiry",
  );

  // The webhook routes a batch before it routes an order.
  const hook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  const completed = hook.indexOf('parsed.kind === "checkout.completed"');
  const batchBranch = hook.indexOf("parsed.batchId", completed);
  const orderBranch = hook.indexOf("!parsed.orderId", completed);
  /*
   * The first version of this used indexOf("parsed.batchId") and passed against
   * an injected `if (parsed.batchId && false)`, because the string was still
   * there. Position is not reachability. It now asserts the condition itself.
   */
  rec(
    "the webhook checks for a batch before it checks for an order",
    batchBranch !== -1 && orderBranch !== -1 && batchBranch < orderBranch,
    "otherwise a batch payment looks for an order with a batch id and answers 500",
  );
  const completedBranch = hook.slice(completed, hook.indexOf('parsed.kind === "checkout.expired"'));
  rec(
    "and the COMPLETED branch's batch check is reachable rather than merely present",
    /if \(parsed\.batchId\) \{/.test(completedBranch),
    "scoped to that branch: the identical line in the expired branch satisfied an unscoped check",
  );
  rec(
    "and an expired batch is closed as well as an expired order",
    /abandonBatch\(/.test(hook),
  );

  // The batch wrapper does not reimplement placing an order.
  const bulk = fs.readFileSync("src/lib/ops-bulk.ts", "utf8");
  rec(
    "a batch places each property through placeOrder",
    /placeOrder\(\{/.test(bulk),
    "a second implementation would be a second answer to what the firm may take",
  );
  rec(
    "and derives a per order idempotency key from the batch one",
    /clientRequestId: `\$\{input\.clientRequestId\}:\$\{item\.ref\}`/.test(bulk),
    "so a retry finds each order rather than creating ten more",
  );
  rec(
    "and checks the compliance gate before any order exists",
    bulk.indexOf("previewBatch(") < bulk.indexOf("placeOrder({"),
  );
  rec(
    "and refuses a batch for an account belonging to another brand",
    /account\.site !== input\.site/.test(bulk),
  );
  rec(
    "and runs the credit decision before accepting invoiced work",
    /creditDecision\(/.test(bulk),
  );
  rec(
    "and stamps each order with its share of the batch",
    /batch_share_cents: item\.priceCents/.test(bulk),
    "the charge belongs to the batch, so without this one property cannot be refunded",
  );
  rec(
    "and never charges for a batch with nothing acceptable",
    /split\.empty/.test(bulk),
  );
  rec(
    "and an unbilled invoiced order counts against the credit limit",
    /is\("statement_id", null\)/.test(bulk),
    "otherwise a limit means nothing until the first of the month",
  );
  rec(
    "and a failed balance read is unknown rather than zero",
    /if \(sErr \|\| uErr\)/.test(bulk),
  );
}

// ===========================================================================
// 17. INVOICING: WHERE A BUG BILLS THE WRONG AMOUNT
// ===========================================================================
{
  const st = fs.readFileSync("src/lib/ops-statements.ts", "utf8");
  /*
   * The slice boundaries moved in Phase 8 Section 2, when issuing went on the
   * job queue. The three refusals that used to live inside issueStatement were
   * lifted into issuableStatement so the route that QUEUES the issue and the
   * job that PERFORMS it ask the same question in the same words; without that,
   * an operator would press a button, get a 200, and find out in a dead letter
   * that the statement was already issued.
   *
   * This audit caught the move, correctly: the checks were scoped to
   * issueStatement and the guards were no longer there. They are scoped to the
   * function that owns the rule now, and there is a new check below that
   * issueStatement still calls it, because a guard that exists in a function
   * nobody calls is not a guard.
   */
  const close = st.slice(st.indexOf("export async function closePeriod"), st.indexOf("export async function issuableStatement"));
  const eligible = st.slice(st.indexOf("export async function issuableStatement"), st.indexOf("export async function issueStatement"));
  const issue = st.slice(st.indexOf("export async function issueStatement"), st.indexOf("export async function startStatementCheckout"));
  const checkout = st.slice(st.indexOf("export async function startStatementCheckout"), st.indexOf("export async function markStatementPaid"));
  const paid = st.slice(st.indexOf("export async function markStatementPaid"), st.indexOf("export async function statementsFor"));

  /*
   * An order with no total is skipped and said out loud, never billed as zero.
   * A zero line on a statement is a claim that the work was free, and it is the
   * Phase 6 rule applied to invoicing.
   */
  rec(
    "an order with no total is left off the statement rather than billed as nothing",
    /o\.total_cents === null/.test(close) && /statement\.skipped/.test(close),
  );

  /*
   * Claiming the order by setting statement_id is the lock. Without it two
   * closes running at once each gather the same orders.
   */
  rec(
    "an order is claimed by its statement so a second close cannot re-bill it",
    /statement_id: statementId/.test(close) && /is\("statement_id", null\)/.test(close),
  );
  rec(
    "and only work that has actually been agreed is billable",
    /in\("status", \["paid", "in_fulfilment", "complete"\]\)/.test(close),
    "a draft or an unpaid order is not a bill",
  );

  /*
   * The header total is recomputed from the lines rather than accumulated, so
   * a close that ran twice or skipped an order cannot leave a total that
   * disagrees with what is printed beneath it.
   */
  rec(
    "the statement total is recomputed from its lines, not accumulated",
    /const headerTotal = \(allLines \?\? \[\]\)\.reduce/.test(close),
  );

  // An issued statement is a document that has been sent.
  rec(
    "an issued statement is never reopened to add a late order",
    /existing\.status !== "open"/.test(close),
    "a late order belongs on the next period, not on a bill already sent",
  );
  rec("and cannot be issued twice", /statement\.status !== "open"/.test(eligible));
  rec(
    "and an empty statement cannot be issued at all",
    /Number\(statement\.total_cents\) <= 0/.test(eligible),
  );
  rec(
    "and a statement that does not exist is refused",
    /That statement does not exist/.test(eligible),
  );
  rec(
    "and issuing actually runs those refusals rather than trusting the caller",
    /const eligible = await issuableStatement\(statementId\);/.test(issue) &&
      /if \(!eligible\.ok\) return eligible;/.test(issue),
    "the queue can enqueue a statement that changed state between the button and the worker",
  );

  /*
   * The due date is stored at issue rather than computed later from net_days.
   * If the terms change next month, a statement already sent must not silently
   * acquire a different due date.
   */
  rec(
    "the due date is stored when the statement is issued",
    /due_at: dueAt/.test(issue),
    "so changing the terms later cannot move a due date already given",
  );

  // The same refusal the batch checkout has, for the same reason.
  rec(
    "a statement checkout refuses when its lines do not sum to its total",
    /lineTotal !== Number\(statement\.total_cents\)/.test(checkout),
  );
  rec(
    "and it charges only an issued statement",
    /statement\.status !== "issued"/.test(checkout),
    "an open statement is a working total, not a bill",
  );
  rec("and the session says it is a statement", /subjectKind: "statement"/.test(checkout));

  // One charge row for one payment, idempotent, and the work is untouched.
  rec("a paid statement writes one charge row against the statement", /statement_id: input\.statementId/.test(paid));
  rec("and is idempotent on the charge ref", /23505/.test(paid));
  rec(
    "and does not touch the orders beneath it",
    !/eng_service_orders/.test(paid),
    "paying the bill does not change the work",
  );

  // The webhook routes a statement before an order, same reason as a batch.
  const hook = fs.readFileSync("src/app/api/stripe/webhook/route.ts", "utf8");
  const completedPart = hook.slice(
    hook.indexOf('parsed.kind === "checkout.completed"'),
    hook.indexOf('parsed.kind === "checkout.expired"'),
  );
  rec(
    "the webhook routes a statement payment before an order",
    completedPart.indexOf("parsed.statementId") < completedPart.indexOf("!parsed.orderId"),
  );
  rec(
    "and that branch is reachable rather than merely present",
    /if \(parsed\.statementId\) \{/.test(completedPart),
  );

  // No dunning. The operator ruled it, and absence is asserted rather than assumed.
  /*
   * Read with comments stripped. The first version matched the very paragraph
   * explaining that there IS no dunning, which is a check reading prose rather
   * than code, and it is the fifth time that has happened today.
   */
  const stCode = st.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  rec(
    "nothing chases an overdue statement",
    !/dunning|reminder|late_fee|lateFee|escalat/i.test(stCode),
    "the operator ruled the state is made visible and nothing chases it",
  );

  // The operator side.
  const admin = fs.readFileSync("src/lib/ops-accounts-admin.ts", "utf8");
  rec(
    "the accounts screen computes can-they-order from the same rule the customer hits",
    /creditDecision\(/.test(admin),
    "so the screen and the refusal cannot disagree",
  );
  rec(
    "converting a client keeps its history rather than moving it",
    /references that row rather than replacing/.test(admin) || /client_id: clientId/.test(admin),
  );
  rec(
    "and accounts are for organisations only",
    /client\.kind !== "organization"/.test(admin),
  );

  const route = fs.readFileSync("src/app/api/portal/accounts/route.ts", "utf8");
  rec("the operator account route checks accounts.manage", route.includes('can(actor, "accounts.manage")'));
  rec(
    "and a credit limit is cleared explicitly rather than by omission",
    /"creditLimitCents" in body/.test(route),
    "an absent field must not silently remove credit, nor grant it",
  );
  rec(
    "and a negative credit limit is refused rather than stored",
    /raw >= 0/.test(route),
  );
}

console.log("============ THE ORDER ENGINE ============");
console.log("the refund rule, the prices nobody invented, and the gate\n");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
const failed = out.filter((r) => !r.ok);
console.log("");
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks. Nothing can be ordered, priced, or refunded wrongly.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  process.exitCode = 1;
}
