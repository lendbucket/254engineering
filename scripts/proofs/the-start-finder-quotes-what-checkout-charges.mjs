/**
 * THE /start FINDER QUOTES WHAT CHECKOUT CHARGES, AND THE AD CLICK IS KEPT AS
 * RULED. Robert's add-on of 2026-11-15, items 2, 6, 9, 14 and 15.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/the-start-finder-quotes-what-checkout-charges.mjs
 *
 * Every expectation here is a PINNED LITERAL, never read from the price book or
 * the catalogue the finder reads: a check that imports its expectation from the
 * thing it checks cannot disagree with it (CLAUDE.md, section 6).
 *
 * What must hold:
 *   A. The eight letter keys an ad URL may carry map to the eight service lines.
 *   B. Each fixed price, inland and coastal, and "not sure", is the published
 *      figure: $709 for five letters, $795 for the WPI-8E, $1,195 for a repair
 *      specification, $75 more in a first tier coastal county. Design is $225
 *      an hour with a $2,000 minimum.
 *   C. A callback asked for between 8 AM and 8 PM Central is due at once;
 *      after 8 PM it is due at 8 AM the next day; before 8 AM, at 8 AM that day;
 *      and the 8 AM lands right across both daylight time changes.
 *   D. The price emails go on days 0, 2 and 5.
 *   E. The ad click cookie lasts 90 days, keeps a real click, refuses a forged
 *      one, and a URL with none of the parameters writes nothing.
 */
let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const F = await import("../../src/lib/start-finder.ts");
const C = await import("../../src/lib/ad-click.ts");

/* ------------------------------------------------------------------ A */
const SLUGS = {
  roof: "roof-inspections",
  foundation: "foundation-inspections",
  wpi8: "windstorm-wpi-8",
  solar: "solar-structural-letters",
  permit: "structural-letters",
  mh: "manufactured-home-foundation-certifications",
  repair: "repair-specifications",
  design: "residential-light-commercial-design",
};
check("A: exactly the eight letter keys Robert listed", JSON.stringify([...F.LETTER_KEYS].sort()) === JSON.stringify(Object.keys(SLUGS).sort()));
for (const [key, slug] of Object.entries(SLUGS)) check(`A: letter=${key} is ${slug}`, F.letterOf(key)?.slug === slug);
check("A: an unknown letter is no letter", F.letterOf("pool") === null && F.letterOf("") === null && F.letterOf(null) === null);
check("A: every letter has its own headline, none repeated", new Set(F.LETTER_KEYS.map((k) => F.LETTERS[k].headline)).size === 8);
check("A: every reason points at a real letter", F.REASONS.every((r) => F.letterOf(r.to)));

/* ------------------------------------------------------------------ B */
const PRICES = { roof: 70900, foundation: 70900, solar: 70900, permit: 70900, mh: 70900, wpi8: 79500, repair: 119500 };
const COASTAL = 7500;
for (const [key, cents] of Object.entries(PRICES)) {
  const inland = F.quoteFor(F.letterOf(key), "no");
  const coastal = F.quoteFor(F.letterOf(key), "yes");
  const unsure = F.quoteFor(F.letterOf(key), "unsure");
  check(`B: ${key} inland is ${cents / 100}`, inland.kind === "fixed" && inland.totalCents === cents, JSON.stringify(inland));
  check(`B: ${key} in a coastal county is ${(cents + COASTAL) / 100}`, coastal.kind === "fixed" && coastal.totalCents === cents + COASTAL);
  check(`B: ${key} not sure quotes inland and names the coastal figure`, unsure.kind === "fixed" && unsure.totalCents === cents && unsure.unsureCents === cents + COASTAL);
}
const design = F.quoteFor(F.letterOf("design"), null);
check("B: design is $225 an hour with a $2,000 minimum", design.kind === "hourly" && design.rateCents === 22500 && design.minimumCents === 200000, JSON.stringify(design));

/* ------------------------------------------------------------------ C */
const iso = (d) => d.toISOString();
/* 2026-11-15 is CST, UTC-6. */
check("C: 2:00 PM Central is open, due at once", iso(F.callbackDueAt(new Date("2026-11-15T20:00:00Z"))) === "2026-11-15T20:00:00.000Z");
check("C: 7:59 PM Central is still open", F.officeIsOpen(new Date("2026-11-16T01:59:00Z")));
check("C: 8:00 PM Central is closed", !F.officeIsOpen(new Date("2026-11-16T02:00:00Z")));
check("C: 9:30 PM Central waits for 8 AM the next day", iso(F.callbackDueAt(new Date("2026-11-16T03:30:00Z"))) === "2026-11-16T14:00:00.000Z");
check("C: 6:10 AM Central waits for 8 AM that day", iso(F.callbackDueAt(new Date("2026-11-16T12:10:00Z"))) === "2026-11-16T14:00:00.000Z");
/* Daylight time ends 2026-11-01 at 2 AM: an 11 PM CDT request on Oct 31 is due at 8 AM CST on Nov 1, 14:00 UTC. */
check("C: across the fall change, 8 AM CST", iso(F.callbackDueAt(new Date("2026-11-01T04:00:00Z"))) === "2026-11-01T14:00:00.000Z");
/* Daylight time starts 2027-03-14 at 2 AM: an 11 PM CST request on Mar 13 is due at 8 AM CDT on Mar 14, 13:00 UTC. */
check("C: across the spring change, 8 AM CDT", iso(F.callbackDueAt(new Date("2027-03-14T05:00:00Z"))) === "2027-03-14T13:00:00.000Z");
check("C: the hours are 8 to 20", F.OFFICE_OPENS_HOUR === 8 && F.OFFICE_CLOSES_HOUR === 20);

/* ------------------------------------------------------------------ D */
check("D: the price emails go on days 0, 2 and 5", JSON.stringify([...F.PRICE_EMAIL_DAYS]) === "[0,2,5]");
const asked = new Date("2026-11-15T20:00:00Z");
check("D: the second is due two days after the request", iso(F.priceEmailDueAt(asked, 2)) === "2026-11-17T20:00:00.000Z");
check("D: the third is due five days after the request", iso(F.priceEmailDueAt(asked, 3)) === "2026-11-20T20:00:00.000Z");

/* ------------------------------------------------------------------ E */
check("E: the click cookie lasts 90 days", C.AD_CLICK_DAYS === 90 && C.AD_CLICK_MAX_AGE_SECONDS === 7776000);
const at = new Date("2026-11-15T20:00:00Z");
const real = C.adClickFromParams(new URLSearchParams("gclid=Cj0KCQiA_abc-123XYZ&utm_source=google&utm_campaign=roof"), at, "/start");
check("E: a real click is kept with its utm values", real?.gclid === "Cj0KCQiA_abc-123XYZ" && real.utmSource === "google" && real.utmCampaign === "roof" && real.landingPath === "/start");
check("E: and survives the cookie round trip", JSON.stringify(C.decodeAdClick(C.encodeAdClick(real))) === JSON.stringify(real));
const forged = C.adClickFromParams(new URLSearchParams("gclid=<script>&wbraid=a b"), at, "/start");
check("E: a forged click ID is refused, and a URL left with nothing writes nothing", forged === null);
check("E: a URL with none of the parameters writes nothing", C.adClickFromParams(new URLSearchParams("letter=roof"), at, "/start") === null);
check("E: a tampered cookie reads as no click", C.decodeAdClick("%7Bnot-json") === null && C.decodeAdClick(encodeURIComponent(JSON.stringify({ gclid: "Cj0KCQiA_abc-123XYZ" }))) === null);
check("E: isAdClick is true only for a Google click ID", C.isAdClick(real) && !C.isAdClick(C.adClickFromParams(new URLSearchParams("utm_source=newsletter"), at, "/")));
const req = C.utmColumns(real, { utmSource: "facebook" });
check("E: a utm value the request carries wins over the cookie's", req.utm_source === "facebook" && req.utm_campaign === "roof");

console.log("");
if (wrong === 0) {
  console.log("PASS: the finder quotes what checkout charges, and the ad click is kept as ruled.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
