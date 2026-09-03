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
