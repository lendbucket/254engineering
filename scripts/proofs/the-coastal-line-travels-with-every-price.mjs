/**
 * THE COASTAL LINE TRAVELS WITH EVERY PRICE, AND THE PRICE STORY IS ONE STORY.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-coastal-line-travels-with-every-price.mjs
 *
 * Operator ruling, 2026-10-10 (gap 8 of the product audit): one price story
 * across /process and /order, and the coastal line wherever a price appears.
 *
 * coastalLine() is the one home of the phrase. It must name the surcharge for
 * every line whose catalogue carries one, read from the catalogue rather than
 * typed, and nothing for a line that does not; and every page that prints a
 * line's price must ask it. The surcharge figure is a literal here, from the
 * catalogue's ruling, so a moved figure is a deliberate second edit.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { coastalLine } = await import("../../src/lib/ordering.ts");

/* Every fixed price line carries the surcharge in the catalogue; design, hourly, carries none. */
const WITH = [
  "roof-inspections", "windstorm-wpi-8", "foundation-inspections", "manufactured-home-foundation-certifications",
  "solar-structural-letters", "structural-letters", "repair-specifications",
];
for (const slug of WITH) {
  const line = coastalLine(slug);
  check(`${slug}: the coastal line names the $75 surcharge`, line === "plus $75 in first tier coastal counties", String(line));
}
check(
  "design, which the catalogue gives no surcharge, has no coastal line",
  coastalLine("residential-light-commercial-design") === null,
  String(coastalLine("residential-light-commercial-design")),
);

const PRICE_PAGES = ["src/app/(site)/process/page.tsx", "src/app/(site)/structural-engineer/cost/page.tsx"];
for (const page of PRICE_PAGES) {
  const src = readFileSync(page, "utf8");
  check(`${page}: prints each line's price and asks coastalLine beside it`, src.includes("priceSentence(") && src.includes("coastalLine("));
}
const ordering = readFileSync("src/lib/ordering.ts", "utf8");
check(
  "the order offers read the same function, and nothing else types the phrase",
  ordering.includes("coastal: orderable ? coastalLine(slug) : null") &&
    (ordering.match(/`plus \$\{money\(/g) ?? []).length === 1,
);
const order = readFileSync("src/app/(site)/order/page.tsx", "utf8");
check(
  "/order no longer promises to send a price for a line whose price is published",
  !/we will send you a price/i.test(order) && order.includes("that is the price you are quoted"),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the coastal line travels with every price, and the price story is one story.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
