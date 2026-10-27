/**
 * A QUOTE IS REQUESTED, KEEPS ITS FILES, IS PRICED AND SENT, AND IS PAID ONCE.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-quote-is-requested-priced-and-paid-once.mjs
 *
 * Robert's addendum of 2026-10-25, 22:46 Central, item 3: "The office prices a
 * quote request and sends it; the customer accepts by a tokened link and pays;
 * it converts with convertibleToOrder. Quote list screen, quote email, expiry.
 * Fix requestQuote so design and the other quote lines can actually be
 * requested (today line-gate refuses every quote entry). Files attached to a
 * quote request are kept, not dropped."
 *
 * No database. The rules are pure functions and are asked directly; the doors
 * are read from the source for the order of what they ask. What only the
 * database can refuse (a kept file removed, a sent quote with no price, an
 * accepted price moved, a quote naming a second order) is proved inside
 * migration-audit's replayed database, 0098.
 *
 * The expected answers are literals here, never read back from the code under
 * test, so a rule that moves turns this red.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const read = (f) => readFileSync(f, "utf8");

const { CATALOG } = await import("../../data/catalog.ts");
const gate = await import("../../src/lib/line-gate.ts");
const rules = await import("../../src/lib/quote-rules.ts");
const orders = await import("../../src/lib/ops-orders.ts");
const intake = await import("../../src/lib/ops-intake.ts");
const { quoteSent } = await import("../../src/lib/email-templates.ts");

/* ------------------------------------------------ 1. every quote line can be asked */

const quoted = CATALOG.filter((e) => e.orderType === "quote");
check("the catalogue has quote lines to ask about", quoted.length >= 3, quoted.map((e) => `${e.serviceSlug}/${e.tier}`).join(", "));
for (const e of quoted) {
  check(`${e.serviceSlug}/${e.tier} can be requested once the firm is open`, gate.quoteRequestBlocked(e, "open") === null, String(gate.quoteRequestBlocked(e, "open")));
  check(`and is refused while the firm is not trading`, gate.quoteRequestBlocked(e, "prelaunch") !== null);
  const shown = await gate.deliverableBlockedForDisplay(e, "open");
  check(`and the start page offers it as a request`, shown === null, String(shown));
}
const priced = CATALOG.find((e) => e.serviceSlug === "roof-inspections");
check("a priced line is in the catalogue to compare", Boolean(priced) && priced.orderType !== "quote");
for (const mode of ["prelaunch", "trading", "open"]) {
  const viaPage = await gate.deliverableBlockedForDisplay(priced, mode);
  const viaMoneyCheck = await gate.orderBlockedForDisplay(priced, mode);
  check(`a priced line is still asked the order question on the start page (${mode})`, viaPage === viaMoneyCheck, `${viaPage} / ${viaMoneyCheck}`);
}
const flow = read("src/components/order/OrderFlow.tsx");
check(
  "and the order flow sends a priced line as an order, which goes to checkout, never to the quote form",
  flow.includes('intent: entry.orderType === "quote" ? "quote" : "order"'),
);
const intakeSrc = read("src/lib/ops-intake.ts");
check(
  "requestQuote refuses a priced deliverable with its own sentence",
  intakeSrc.includes("has a published price and is ordered rather than quoted."),
);

/* ------------------------------------------------ 2. the files are kept */

const ok = { key: "drawings", bucket: "eng-uploads", storageKey: "orders/draft-1/drawings/a.pdf" };
check("a file from the request's own draft folder is accepted", intake.quoteFileProblem("draft-1", ok) === null);
check("a file from another request's draft is refused", intake.quoteFileProblem("draft-2", ok) !== null);
check("a file from another bucket is refused", intake.quoteFileProblem("draft-1", { ...ok, bucket: "eng-seal-images" }) !== null);
check("a file slot that is not a plain name is refused", intake.quoteFileProblem("draft-1", { ...ok, key: "../x" }) !== null);
const requestBody = intakeSrc.slice(intakeSrc.indexOf("export async function requestQuote("), intakeSrc.indexOf("export async function issueCustomerLink("));
const recordCalls = requestBody.split("recordQuoteFiles(").length - 1;
check("requestQuote records the files on a new request and on a retried one", recordCalls === 2, `${recordCalls} call(s)`);
check(
  "and a request whose files could not be recorded is not reported as made",
  (requestBody.match(/if \(filesNotKept\) return \{ ok: false/g) ?? []).length === 2,
);
for (const route of ["src/app/api/order-flow/route.ts", "src/app/api/orders/route.ts"]) {
  const src = read(route);
  const quoteBranch = src.slice(src.indexOf('if (body.intent === "quote")'), src.indexOf("requestQuote({") + 900);
  check(`${route} hands the files to requestQuote`, src.indexOf("const files =") < src.indexOf('if (body.intent === "quote")') && /\n\s+files,\n/.test(quoteBranch));
}

/* ------------------------------------------------ 3. priced, listed, sent, lapsing */

check("2400 is $2,400.00", JSON.stringify(rules.parseQuotePrice("2,400")) === JSON.stringify({ ok: true, cents: 240000 }));
check("and $2400.50 is 240050 cents", JSON.stringify(rules.parseQuotePrice("$2400.50")) === JSON.stringify({ ok: true, cents: 240050 }));
check("a price of nothing is refused", !rules.parseQuotePrice("0").ok);
check("a price that is not a figure is refused", !rules.parseQuotePrice("about two grand").ok);
check("a quote that holds no days is refused", !rules.parseHoldDays(0).ok);
check("and one holding thirty days is taken", rules.parseHoldDays("30").ok);

const NOW = Date.parse("2026-10-27T15:00:00Z");
const base = {
  id: "a", createdAt: "2026-10-20T12:00:00Z", reference: "Q-AAA", site: "254engineering", serviceSlug: "residential-light-commercial-design",
  tier: "custom-package", status: "sent", customerName: "Alma Reyes", customerEmail: "alma@example.com", customerPhone: "(361) 555-0142",
  customerCompany: null, propertyAddress: "12 Ocean Dr", city: "Corpus Christi", county: "Nueces", brief: "Addition", neededBy: null,
  quotedCents: 240000, scope: "Scope", sentAt: "2026-10-20T12:00:00Z", expiresAt: "2026-11-19T12:00:00Z", decidedAt: null,
  declineReason: null, convertedOrderId: null, fileCount: 2,
};
const rows = [
  base,
  { ...base, id: "b", reference: "Q-BBB", customerName: "Ben Ortiz", customerEmail: "ben@example.com", customerPhone: null, status: "new", quotedCents: null, sentAt: null, expiresAt: null, createdAt: "2026-10-25T12:00:00Z" },
  { ...base, id: "c", reference: "Q-CCC", customerName: "Cara Lee", customerEmail: "cara@example.com", customerPhone: "(361) 555-0199", status: "declined", quotedCents: 90000, createdAt: "2026-10-22T12:00:00Z" },
];
check("the list finds a quote by the last digits of a phone number", rules.quoteListRows(rows, { q: "0142", status: "all" }).map((r) => r.id).join() === "a");
check("and by email", rules.quoteListRows(rows, { q: "ben@", status: "all" }).map((r) => r.id).join() === "b");
check("and by reference", rules.quoteListRows(rows, { q: "q-ccc", status: "all" }).map((r) => r.id).join() === "c");
check("the default view is what waits on the firm or the customer", rules.quoteListRows(rows, { status: "open" }).map((r) => r.id).join() === "b,a");
check(
  "a quote with no price sorts last by price in either direction, never as zero",
  rules.quoteListRows(rows, { status: "all", sort: "amount", dir: "asc" }).map((r) => r.id).join() === "c,a,b" &&
    rules.quoteListRows(rows, { status: "all", sort: "amount", dir: "desc" }).map((r) => r.id).join() === "a,c,b",
);
check("a sent quote before its date has not lapsed", !rules.hasLapsed(base, NOW));
check("and after it, it has, whatever its status still says", rules.hasLapsed(base, Date.parse("2026-11-19T12:00:00Z")));
check("a sent quote with no date is treated as lapsed rather than open for ever", rules.hasLapsed({ status: "sent", expiresAt: null }, NOW));
check("and the list says lapsed before anybody writes it", rules.shownStatus(base, Date.parse("2026-12-01T00:00:00Z"), orders.QUOTE_STATUS_LABEL).startsWith("Lapsed"));
check("a new request goes through scoping before it is sent, as the transition table says", !orders.canTransitionQuote("new", "sent") && orders.canTransitionQuote("scoping", "sent"));
const opsQuotes = read("src/lib/ops-quotes.ts");
check("and sendQuote moves it through scoping first", opsQuotes.indexOf('status: "scoping"') !== -1 && opsQuotes.indexOf('status: "scoping"') < opsQuotes.indexOf('status: "sent"'));

const email = quoteSent({
  customerName: "Alma Reyes", customerEmail: "alma@example.com", reference: "Q-AAA", deliverableName: "custom foundation and framing package",
  amount: "$2,400.00", scope: "Foundation and framing plans.", expiresOn: "November 19, 2026",
  quoteUrl: "https://254engineering.com/order/quote/Q-AAA?token=T",
});
check("the quote email states the price", email.text.includes("$2,400.00") && email.html.includes("$2,400.00"));
check("and the date it lapses", email.text.includes("November 19, 2026"));
check("and carries the absolute link that accepts it", email.html.includes("https://254engineering.com/order/quote/Q-AAA?token=T"));
check("and says nothing is charged until payment completes", email.text.includes("Nothing is charged until you complete it."));
check("and goes to the customer", email.to === "alma@example.com");

/* ------------------------------------------------ 4. accepted and paid, once */

check("only an accepted quote converts", orders.convertibleToOrder("accepted") && !orders.convertibleToOrder("sent"));
check("one quote is placed under one order key, every time", rules.quoteOrderRequestId("x") === "quote-x" && rules.quoteOrderRequestId("x") === rules.quoteOrderRequestId("x"));
const convert = opsQuotes.slice(opsQuotes.indexOf("async function convertAndCheckout("));
check("conversion asks convertibleToOrder of the stored status before it places anything", convert.indexOf("convertibleToOrder(") !== -1 && convert.indexOf("convertibleToOrder(") < convert.indexOf("placeOrder("));
check("and places the order under the quote's own key, so a retry finds the order it made", convert.includes("clientRequestId: quoteOrderRequestId(quote.id)"));
check("and names the order on the quote only where none is named yet", convert.includes('.is("converted_order_id", null)'));
check("and opens the platform's one checkout, never a second", convert.includes("startCheckout(placed.orderId)") && !/createCheckout\(/.test(opsQuotes));
const accept = opsQuotes.slice(opsQuotes.indexOf("export async function acceptQuote("), opsQuotes.indexOf("async function convertAndCheckout("));
check("a lapsed quote is refused before it is accepted", accept.indexOf("view.lapsed") !== -1 && accept.indexOf("view.lapsed") < accept.indexOf('status: "accepted"'));
check("and the acceptance is conditional on the quote still being sent", /\.eq\("status", "sent"\)\s*\.select\("id"\)/.test(accept));
const place = intakeSrc.slice(intakeSrc.indexOf("export async function placeOrder("), intakeSrc.indexOf("export function quoteFileProblem("));
check("placeOrder takes a converted quote at the accepted figure", place.includes("? fromQuote.quotedCents"));
/*
 * NAMED FOR THE NEW SHAPE, 2026-10-27. This asserted orderBlockedNow came before
 * `const fromQuote`; Robert's answer 1 moved fromQuote up, because a design quote's
 * door needs the quote id. What it still asserts: the signed record is read before
 * the refusal returns, by the protocol door for any line and by his addendum for a
 * design quote, and the design door reads the quote's STORED status (no fourth argument).
 */
const refusalAt = place.indexOf("if (!entry || blocked)");
check(
  "and reads the signed record for it like any order, before anything is decided",
  place.indexOf("orderBlockedNow(") !== -1 && place.indexOf("orderBlockedNow(") < refusalAt,
);
check(
  "and a design quote's door there reads the quote's stored status and his addendum",
  place.includes("? await designQuoteBlocked(entry, fromQuote.quoteId, launchMode())") &&
    place.indexOf("designQuoteBlocked(") < refusalAt &&
    place.includes("deskLines.includes(entry.serviceSlug) && fromQuote"),
);

/* ------------------------------------------------ 7. Robert's answers of 2026-10-27, 11:48 Central */

const DESIGN = "residential-light-commercial-design";
const conditions = await import("../../src/config/launch-conditions.ts");

/* Answer 3: a sent quote holds for 30 days. Pinned here as a literal (CLAUDE.md 6c). */
check("a sent quote holds for 30 days by default, as ruled", rules.QUOTE_HOLD_DAYS.default === 30, String(rules.QUOTE_HOLD_DAYS.default));

/* Answer 4: design's own refund sentence, word for word; the desk lines keep theirs. */
const DESIGN_REFUND =
  "The engineering fee is refundable in full until the engineer begins work. After work begins, fees for work completed are not refundable.";
const designEntries = CATALOG.filter((e) => e.serviceSlug === DESIGN);
check("the catalogue has design deliverables to ask about", designEntries.length >= 1, String(designEntries.length));
for (const e of designEntries) {
  check(`${e.tier}: a design quote shows exactly Robert's refund sentence before payment`, JSON.stringify(orders.refundDisclosure(e)) === JSON.stringify([DESIGN_REFUND]), orders.refundDisclosure(e).join(" | "));
}
/* "The desk lines keep their wording": every other deliverable in the catalogue, none of which carries design's sentence. */
const others = CATALOG.filter((e) => e.serviceSlug !== DESIGN);
const borrowed = others.filter((e) => orders.refundDisclosure(e).includes(DESIGN_REFUND) || orders.refundDisclosure(e).length < 2);
check(
  "and every other line keeps its own refund wording, not design's",
  others.length > 0 && borrowed.length === 0,
  borrowed.length === 0 ? `${others.length} other deliverables read` : borrowed.map((e) => `${e.serviceSlug}/${e.tier}`).join(", "),
);
const quotePage = read("src/app/(order)/order/quote/[reference]/page.tsx");
check("and the customer's quote page shows the refund terms before the accept button", quotePage.indexOf("refundTerms.map(") !== -1 && quotePage.indexOf("refundTerms.map(") < quotePage.indexOf("<AcceptQuote"));

/* Answer 1: design is offered, exempt by name, paid on an accepted quote and his signed addendum. */
check("design is in offeredServiceLines", conditions.offeredServiceLines.includes(DESIGN), conditions.offeredServiceLines.join(", "));
check("and the desk exemption names design and nothing else", JSON.stringify(conditions.deskLines) === JSON.stringify([DESIGN]), conditions.deskLines.join(", "));
const pay = rules.designPaymentRefusal;
check("accepted and signed: a design quote pays", pay({ offered: true, accepted: true, addendum: "signed" }) === null, String(pay({ offered: true, accepted: true, addendum: "signed" })));
const noAddendum = pay({ offered: true, accepted: true, addendum: "unsigned" });
check("accepted with no signed addendum: refused, naming the addendum only", Boolean(noAddendum) && /scope addendum/.test(noAddendum) && !/accepted/.test(noAddendum), String(noAddendum));
const notAccepted = pay({ offered: true, accepted: false, addendum: "signed" });
check("signed but not accepted: refused, naming the acceptance only", Boolean(notAccepted) && /not been accepted/.test(notAccepted) && !/scope addendum/.test(notAccepted), String(notAccepted));
const neither = pay({ offered: true, accepted: false, addendum: "unsigned" });
check("neither: refused, naming both", Boolean(neither) && /not been accepted/.test(neither) && /scope addendum/.test(neither), String(neither));
const unknown = pay({ offered: true, accepted: true, addendum: "unknown" });
check("a read that failed is never a yes", Boolean(unknown) && /could not confirm/.test(unknown), String(unknown));
check("and a line not offered is refused whatever else holds", pay({ offered: false, accepted: true, addendum: "signed" }) !== null);
const designEntry = designEntries[0];
check("the door answers the gate first: a design quote is refused while the firm is not open", (await gate.designQuoteBlocked(designEntry, "q", "prelaunch")) !== null);
const noDb = await gate.designQuoteBlocked(designEntry, "q", "open");
check("and with no database to read, it closes in plain words", Boolean(noDb) && /could not confirm/.test(noDb), String(noDb));
const viaOrderDoor = await gate.lineIsSellable(DESIGN);
check("every door other than the accepted quote refuses design, by name", viaOrderDoor.ok === false && /accepted quote/.test(viaOrderDoor.why), viaOrderDoor.ok ? "ok" : viaOrderDoor.why);
check("acceptQuote asks the design door before it records the acceptance", accept.includes("? await designQuoteBlocked(entry, quote.id, launchMode(), true)") && accept.indexOf("designQuoteBlocked(") < accept.indexOf('status: "accepted"'));

/* Every other line's gate is unchanged: the protocol and training conditions skip design by name only. */
const launch = await import("../../src/lib/launch.ts");
const protocolsBlocker = launch.launchReadiness().find((r) => r.condition.id === "protocols")?.blocker ?? null;
check("the protocols condition does not hold the gate shut over design", !String(protocolsBlocker ?? "").includes(DESIGN), String(protocolsBlocker));
check("and the training condition does not name design", !launch.linesWithNobodyTrained().includes(DESIGN), launch.linesWithNobodyTrained().join(", "));
const launchSrc = read("src/lib/launch.ts");
const protocolsCond = launchSrc.slice(launchSrc.indexOf('id: "protocols"'), launchSrc.indexOf('id: "phone"'));
check("and it skips desk lines by name, then asks every other offered line as before", protocolsCond.includes("offeredServiceLines.filter((slug) => !deskLines.includes(slug))") && protocolsCond.includes("needProtocol.filter((slug) => !lineHasProtocolInForce(slug))"));
/*
 * 254-DS-001 v1.1 is a signable transcription, so design HAS a protocol the gate
 * would count. Listing design therefore made serviceLineIsOffered answer true
 * until the desk clause: asserted at runtime, never by wording.
 */
check("design is never offered for ordering, so no card shows it as an order", launch.serviceLineIsOffered(DESIGN) === false);
check(
  "and every other offered line still answers as it did",
  conditions.offeredServiceLines.filter((s) => s !== DESIGN).every((s) => launch.serviceLineIsOffered(s) === launch.lineHasProtocolInForce(s)),
);

console.log(wrong === 0 ? "\nPASS: a quote is requested, keeps its files, is priced and sent, and is paid once." : `\nFAIL: ${wrong} check(s).`);
process.exit(wrong === 0 ? 0 : 1);
