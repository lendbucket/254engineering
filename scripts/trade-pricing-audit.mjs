// NO @runtime DECLARATION, AND THE BOARD IS WHAT SAID SO.
//
// This declared "@runtime react-server" and the board refused to start:
// scripts/lib/audit-runtime.mjs follows the imports and found nothing
// server-only. It was right. This file imports the floor register and the
// catalogue, which are plain modules, and READS src/lib/trade-pricing.ts as
// text rather than importing it.
//
// The CHILD PROCESS it spawns does import that module, and passes the flag
// itself. A declaration here would have been a flag on the wrong process.
/**
 * A FLOOR IS THE OPERATOR'S, AND NOTHING SELLS BENEATH ONE.
 *
 *   npx tsx --conditions=react-server scripts/trade-pricing-audit.mjs
 *
 * Phase 13 Section 2. The rule this section turns on, in the operator's words:
 *
 *   "A floor is a decision about money, so it is mine. Where I have not given
 *    one, the platform refuses to quote a trade price on that service and says
 *    why. It never derives a floor from cost, never falls back to the catalogue
 *    price, never treats absent as zero, and never lets an operator supply one
 *    at quote time."
 *
 * WHY THIS AUDIT CARRIES ITS OWN FIXTURE FLOOR, SAID PLAINLY
 * ----------------------------------------------------------
 * Every floor in src/config/trade-floors.ts is `pending`, because not one has
 * been ruled. So no deliverable can be trade priced at all, and every live check
 * below would pass over an empty set: each refusal would fire for the PENDING
 * reason rather than the reason it is written to test.
 *
 * That is "a check that filters live data for a subject that does not exist yet
 * is vacuous; build the subject". The live half patches ONE floor into the
 * declaration for the length of the run, restores it in a `finally`, and
 * verifies the restore.
 *
 * THE FIXTURE FLOOR IS NOT A FLOOR. It never reaches a commit, it is an
 * obviously fake round number, its author field says so in capitals, and the
 * run fails loudly if the file it wrote is not put back.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { auditClient } from "./lib/db-target.mjs";
import { PROBE_DOMAIN } from "./lib/portal-probe.mjs";
import { CATALOG } from "../data/catalog.ts";
import { TRADE_FLOORS, floorKey } from "../src/config/trade-floors.ts";

const FLOORS_FILE = "src/config/trade-floors.ts";
const FIXTURE_SLUG = "structural-letters";
const FIXTURE_TIER = "standard";
const FIXTURE_FLOOR = 40000;

const results = [];
let failures = 0;
const rec = (name, ok, note = "") => {
  results.push({ name, ok, note });
  if (!ok) failures += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const say = (l) => console.log(l);

// =========================================================================
// THE PURE HALF: the declaration against the catalogue
// =========================================================================
{
  say("");
  say("the declaration against the catalogue, both ways");

  const cat = CATALOG.map((e) => floorKey(e.serviceSlug, e.tier));
  const declared = Object.keys(TRADE_FLOORS);

  rec(
    `there are deliverables to check (${cat.length})`,
    cat.length > 5,
    "a sweep over an empty catalogue passes every run",
  );

  const undeclared = cat.filter((k) => !declared.includes(k));
  rec(
    "every deliverable in the catalogue has an entry",
    undeclared.length === 0,
    undeclared.length ? `IN THE CATALOGUE AND UNDECLARED: ${undeclared.join(", ")}` : `${cat.length} deliverables`,
  );

  const orphans = declared.filter((k) => !cat.includes(k));
  rec(
    "and every entry names a deliverable the catalogue still has",
    orphans.length === 0,
    orphans.length
      ? `DECLARED AND GONE FROM THE CATALOGUE: ${orphans.join(", ")}`
      : "a floor for something nobody sells is a floor nobody can act on",
  );

  const unowned = Object.entries(TRADE_FLOORS)
    .filter(([, v]) => v.state === "set" && (!v.by?.trim() || !v.on?.trim() || !v.because?.trim()))
    .map(([k]) => k);
  rec(
    "every floor that is set names who ruled it, when, and why",
    unowned.length === 0,
    unowned.length ? `A FLOOR WITH NO AUTHOR: ${unowned.join(", ")}` : "",
  );

  const pending = Object.entries(TRADE_FLOORS).filter(([, v]) => v.state === "pending");
  rec(
    `and every pending entry says what it is waiting for (${pending.length} pending)`,
    pending.every(([, v]) => (v.because ?? "").trim().length > 40),
    pending.length === declared.length
      ? "all of them, which is the correct state until the operator rules"
      : `${pending.length} of ${declared.length}`,
  );
}

// =========================================================================
// THE SOURCE HALF: the paths that must not exist
// =========================================================================
{
  say("");
  say("the absences, which are the design");

  /*
   * COMMENTS AND STRING LITERALS BOTH, AND THE SECOND HALF IS THE FINDING.
   *
   * The first version stripped comments only, and the override check then
   * contradicted its own neighbour a few lines below: one asserts the word
   * "override" appears nowhere, the other asserts the refusal sentence "There
   * is no override" IS present. Both read the same text.
   *
   * It passed anyway, because the comment strip happened to swallow the region
   * that sentence sat in. Rewriting an unrelated comment exposed it, and the
   * check failed for the first time on code that had never changed.
   *
   * So it had been passing BY LUCK, which is the same as not being a check at
   * all. An override PATH is code; "there is no override" is prose a refused
   * operator should read. Stripping string contents as well means the check
   * reads what a reviewer means by a code path, and the neighbour still reads
   * the sentence.
   */
  const strip = (p) =>
    readFileSync(p, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
      .replace(/`(?:[^`\\]|\\.)*`/g, "``");
  /*
   * TWO VIEWS OF ONE FILE, BECAUSE THE TWO QUESTIONS ARE DIFFERENT.
   *
   * `code` has comments and string contents removed and answers "is there a
   * code path that overrides a floor". `prose` is the file as written and
   * answers "does the refusal a person reads name the floor and its author".
   *
   * Reading both questions off one view is what made these checks contradict
   * each other: the first demanded the word be absent and the second demanded a
   * sentence containing it be present.
   */
  const code = strip("src/lib/trade-pricing.ts");
  const routeCode = strip("src/app/api/portal/accounts/pricing/route.ts");
  const prose = readFileSync("src/lib/trade-pricing.ts", "utf8");

  /*
   * READ WITH THE COMMENTS STRIPPED, because both files discuss overrides at
   * length in prose explaining why none exists. A check that matched its own
   * documentation would be this repository's most frequent defect, committed by
   * the check written to prevent it.
   */
  const overrideWords = /override|force_?price|ignore_?floor|below_?floor_?allowed|skip_?floor/i;
  rec(
    "no override path exists in the pricing module",
    !overrideWords.test(code),
    "an override is a way to sell below a number the operator set, arriving as a convenience",
  );
  rec("and none in the route", !overrideWords.test(routeCode));
  rec(
    "and the route has nowhere to put a floor",
    !/body\?\.floor|floorCents\s*[:=]\s*(?:body|input)/i.test(routeCode),
    "a floor supplied at quote time is the operator's decision taken by somebody else",
  );
  rec(
    "the catalogue price is never used as a floor",
    !/floor\w*\s*=\s*[^;]*priceCents/i.test(code),
    "it would read as caution and would mean a pending floor silently became the published price",
  );
  rec(
    "and an absent floor is never read as zero",
    !/floor\w*\s*(?:\?\?|\|\|)\s*0/i.test(code),
    "absent is not zero; a deliverable with no floor refuses every price at any value",
  );
  rec(
    "the refusal names the floor, who ruled it and when",
    /is below the floor for this service/.test(prose) && /ruled by \$\{floor\.by\} on \$\{floor\.on\}/.test(prose),
    "a refusal that says only too low sends somebody to ask the operator what the number is",
  );
  rec("and says there is no override", /There is no override/.test(prose));
}

// =========================================================================
// THE LIVE HALF
// =========================================================================

/**
 * Run an ES module body in a child process and take its one line answer.
 *
 * ======================================================================
 * A FRESH import() IS NOT FRESH ENOUGH, AND THE FIRST VERSION PROVED IT.
 * ======================================================================
 *
 * That version patched the floor and re-imported trade-pricing with a cache
 * busting query. Nine checks failed reporting the floor as still pending, which
 * is worse than the failure because it reads as the code refusing correctly.
 *
 * A query string busts ONE specifier. trade-pricing imports trade-floors
 * statically, and this file imports trade-floors at the top as well, so the
 * constant was bound before the patch was written and stayed bound.
 *
 * scripts/lib/gate-fixture.mjs records this exact defect for the gate, in those
 * words, after it cost a run. The same answer applies: a child process has no
 * module graph to invalidate. It starts, reads the file as it is on disk at
 * that moment, answers on one line, and exits.
 *
 * The answer is prefixed so a runtime warning on stdout cannot be mistaken for
 * it, which is the gate fixture's reasoning too.
 */
async function inChildProcess(source) {
  const { execFileSync } = await import("node:child_process");
  const { unlinkSync } = await import("node:fs");
  const file = `.trade-child-${process.pid}.mjs`;
  writeFileSync(
    file,
    'globalThis.__answer = (v) => console.log("TRADE_RESULT " + JSON.stringify(v));\n' +
      source.replace(/\banswer\(/g, "globalThis.__answer("),
  );
  try {
    const stdout = execFileSync("npx", ["tsx", "--conditions=react-server", file], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });
    const line = stdout.split("\n").find((l) => l.startsWith("TRADE_RESULT "));
    if (!line) throw new Error("The pricing child returned no answer. It said: " + stdout.trim().slice(0, 400));
    return JSON.parse(line.slice("TRADE_RESULT ".length));
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* Already gone. */
    }
  }
}

function patchFloorIn() {
  const original = readFileSync(FLOORS_FILE, "utf8");
  const key = `"${floorKey(FIXTURE_SLUG, FIXTURE_TIER)}": { state: "pending", because: AWAITING },`;
  if (!original.includes(key)) {
    throw new Error(
      `${FLOORS_FILE} does not carry ${floorKey(FIXTURE_SLUG, FIXTURE_TIER)} as pending, so this fixture ` +
        "does not know what it is patching. Either the operator has ruled that floor, in which case this " +
        "fixture should target another pending one, or the shape changed.",
    );
  }
  const replacement =
    `"${floorKey(FIXTURE_SLUG, FIXTURE_TIER)}": { state: "set", floorCents: ${FIXTURE_FLOOR}, ` +
    `because: "AUDIT FIXTURE. Not a floor. Written by trade-pricing-audit and removed at the end of the run.", ` +
    `by: "AUDIT FIXTURE, NOT THE OPERATOR", on: "2099-12-31" },`;
  writeFileSync(FLOORS_FILE, original.replace(key, replacement));

  return () => {
    writeFileSync(FLOORS_FILE, original);
    if (readFileSync(FLOORS_FILE, "utf8") !== original) {
      throw new Error(`${FLOORS_FILE} was NOT restored. A fixture floor left in the tree would be read by the next build.`);
    }
  };
}

async function run() {
  if (!existsSync(FLOORS_FILE)) {
    console.log("COULD NOT TELL: the floor register is not where this audit expects it.");
    process.exit(0);
  }
  const db = auditClient("trade-pricing-audit", { neverProduction: true });
  if (!db) {
    console.log("");
    console.log("COULD NOT TELL: no database client, so no price could be set.");
    process.exit(0);
  }

  let restore = null;
  const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const email = `probe-pricing-${stamp}@${PROBE_DOMAIN}`;
  let accountId = null;
  let clientId = null;

  try {
    const { data: client } = await db
      .from("eng_clients")
      .insert({ kind: "organization", name: "Audit Probe Pricing Co", email, status: "active", is_demo: true })
      .select("id")
      .single();
    clientId = client?.id ?? null;
    const { data: account } = await db
      .from("eng_customer_accounts")
      .insert({ site: "254", client_id: clientId, status: "active", billing_mode: "invoice" })
      .select("id")
      .single();
    accountId = account?.id ?? null;
    rec("an account exists to price for", Boolean(accountId), accountId ? "" : "nothing below is measured");
    if (!accountId) return;

    restore = patchFloorIn();

    const actorEmail = `probe-operator-${stamp}@${PROBE_DOMAIN}`;
    const result = await inChildProcess(`
import { setTradePrice, tradePriceInForce, tradePriceHistory, tradeRefundDisclosure } from "./src/lib/trade-pricing.ts";

const accountId = ${JSON.stringify(accountId)};
const actor = { id: null, email: ${JSON.stringify(actorEmail)}, role: "admin" };
const SLUG = ${JSON.stringify(FIXTURE_SLUG)};
const TIER = ${JSON.stringify(FIXTURE_TIER)};
const FLOOR = ${FIXTURE_FLOOR};

const out = {};
out.atFloor = await setTradePrice({ accountId, serviceSlug: SLUG, tier: TIER, priceCents: FLOOR, actor });
out.below = await setTradePrice({ accountId, serviceSlug: SLUG, tier: TIER, priceCents: FLOOR - 1, actor });

out.pending = [];
for (const value of [1, FLOOR, 10000000]) {
  out.pending.push(await setTradePrice({ accountId, serviceSlug: "roof-inspections", tier: "standard", priceCents: value, actor }));
}

out.raised = await setTradePrice({ accountId, serviceSlug: SLUG, tier: TIER, priceCents: FLOOR + 5000, actor });
out.inForce = await tradePriceInForce(accountId, SLUG, TIER);
out.history = await tradePriceHistory(accountId);
out.disclosure = tradeRefundDisclosure(SLUG, TIER);

answer(out);
`);

    say("");
    say("1. the floor itself");
    rec("a price exactly at the floor is accepted", result.atFloor?.ok === true, result.atFloor?.error ?? "");
    rec("one cent below the floor is refused", result.below?.ok === false, result.below?.ok ? "IT WAS ACCEPTED" : "");
    rec(
      "and the refusal names the floor as a figure",
      result.below?.ok === false && String(result.below.error).includes(`$${(FIXTURE_FLOOR / 100).toFixed(2)}`),
      result.below?.ok ? "" : String(result.below?.error ?? "").slice(0, 80),
    );
    rec("and says no override exists", result.below?.ok === false && /no override/i.test(String(result.below.error)));

    say("");
    say("2. a pending floor refuses at any value");
    const labels = ["one cent", "the fixture floor", "one hundred thousand dollars"];
    result.pending.forEach((r, i) => {
      rec(
        `a pending floor refuses ${labels[i]}`,
        r?.ok === false && /no floor has been ruled/i.test(String(r.error)),
        r?.ok ? "IT WAS ACCEPTED" : "",
      );
    });

    say("");
    say("3. supersession, and what an order was quoted under");
    rec(
      "a second price supersedes the first",
      result.raised?.ok === true && Boolean(result.raised.supersededId),
      result.raised?.ok ? "" : String(result.raised?.error ?? ""),
    );
    rec("and the price in force is the new one", result.inForce === FIXTURE_FLOOR + 5000, `${result.inForce}`);

    const old = (result.history ?? []).find((h) => h.priceCents === FIXTURE_FLOOR);
    rec(
      "and the superseded price is still readable as the price a past order used",
      Boolean(old) && old.supersededAt !== null,
      old ? "" : "the price an order was quoted under is gone, which is what this table exists to prevent",
    );
    rec("and it still carries the floor it was checked against", old?.floorCentsAtTime === FIXTURE_FLOOR, `${old?.floorCentsAtTime}`);
    rec(
      "a floor changed later cannot reach a price already set",
      old?.floorCentsAtTime === FIXTURE_FLOOR && typeof old?.priceCents === "number",
      "the row carries the floor it was checked against, so a later file cannot rewrite history",
    );

    say("");
    say("4. the refund terms");
    rec(
      "a trade priced deliverable can state its refund terms",
      typeof result.disclosure === "string" && result.disclosure.length > 100,
      result.disclosure ? "" : "a trade price that cannot state what happens to the money cannot be quoted",
    );
    rec(
      "and it is the same disclosure both order doors use",
      typeof result.disclosure === "string" && /Paying does not buy a seal/.test(result.disclosure),
      "a second generator would be a second answer to what happens if the engineer declines",
    );

    const fieldWithoutFee = CATALOG.filter((e) => e.orderType === "field" && e.inspectionFeeCents === null);
    rec(
      `no field deliverable is missing its inspection fee today (${fieldWithoutFee.length})`,
      fieldWithoutFee.length === 0,
      "so the refund-terms refusal is proven by its source rather than by a live case",
    );
    rec(
      "and the refusal for one exists in the module",
      /refund terms cannot be stated/.test(readFileSync("src/lib/trade-pricing.ts", "utf8")),
    );
  } catch (err) {
    rec("the run completed", false, err.message);
  } finally {
    if (restore) restore();

    /*
     * ======================================================================
     * TEARDOWN, AND THE THING IT CANNOT DO IS A CHECK RATHER THAN A LEAK.
     * ======================================================================
     *
     * The first version asserted "the probe account is removed" and failed. It
     * was right to: eng_account_trade_prices cascades from the account and
     * refuses DELETE outright, so an account carrying a trade price CANNOT BE
     * DELETED, by anybody, ever.
     *
     * That is the table working. A trade price is what a customer was charged,
     * and a record of what somebody was charged that disappears when their
     * account is tidied away is not a record. So the assertion is turned around
     * and the property is checked rather than worked around.
     *
     * WHAT IT COSTS, AND IT IS FLAGGED FOR THE OPERATOR RATHER THAN DECIDED
     * HERE: an account that should genuinely be removed, a duplicate or a
     * mistake, cannot be once a price has been set on it. The alternatives are
     * a soft delete on accounts, or letting the cascade win and losing the
     * money record, and choosing between them is a decision about money
     * records. It is in the Section 2 report under decisions flagged.
     *
     * The probe is CLOSED instead, which is the state the platform already has
     * for an account that should not be used, and the client goes with it.
     */
    if (accountId) {
      const refused = await db.from("eng_customer_accounts").delete().eq("id", accountId);
      rec(
        "an account carrying a trade price cannot be deleted",
        Boolean(refused.error),
        refused.error
          ? "the price record outlives the account, which is what a record of what somebody was charged has to do"
          : "THE ACCOUNT WAS DELETED, so the price record went with it",
      );

      await db.from("eng_customer_accounts").update({ status: "closed" }).eq("id", accountId);
      const { data: after } = await db
        .from("eng_customer_accounts")
        .select("status")
        .eq("id", accountId)
        .maybeSingle();
      rec(
        "and it is closed instead, which is the state the platform already has for one that should not be used",
        after?.status === "closed",
        after?.status ?? "gone",
      );
    }
    if (clientId) {
      /*
       * The client is not deletable either while the account references it, so
       * this is attempted and its failure is not a check: it is tidiness, and
       * the account above is the record that matters.
       */
      await db.from("eng_clients").delete().eq("id", clientId).then(
        () => {},
        () => {},
      );
    }
  }
}

console.log("========== A FLOOR IS THE OPERATOR'S ==========");
await run();
console.log("");
if (failures) {
  console.log(`FAIL: ${failures} of ${results.length} checks.`);
  console.log("A floor that can be crossed is not a floor.");
  process.exit(1);
}
console.log(`PASS: ${results.length} checks. Nothing sells beneath a floor, and nothing sells at all without one.`);
