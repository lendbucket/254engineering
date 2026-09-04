/**
 * TAKING A JOB OVER THE TELEPHONE.
 *
 *   npx tsx scripts/intake-audit.mjs
 *
 * WHAT THIS AUDIT IS FOR
 * ----------------------
 * docs/phase-10-gate-0.md recorded, by walking the portal, that an
 * administrator could open an UNPRICED file and nothing else. There was no path
 * from a telephone call to a priced, dispatchable job, and a telephone call is
 * the firm's primary intake.
 *
 * The failure this exists to prevent is not the path being absent. It is the
 * path being PRESENT and quietly producing a different file from the one the
 * website produces for the same job, because then the firm has two definitions
 * of a job and only finds out when an engineer cannot seal one of them.
 *
 * Pure. No server, no database, no network, so it runs in phase zero.
 */

import { readFileSync } from "node:fs";
import {
  blockers,
  decidePrice,
  landsAt,
  paymentOptions,
  INTAKE_CHANNELS,
  PAYMENT_INTENTS,
  MIN_OVERRIDE_REASON,
} from "../src/lib/job-intake-rules.ts";

function codeOnly(path) {
  const withoutBlocks = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

/**
 * The text of one call, from its opening to the matching close.
 *
 * Two checks below were written as bare greps over the whole module and both
 * walked past an injection, because the string they wanted also appeared in a
 * DIFFERENT call. "deliverable: input.tier" is in the createFile arguments and
 * again in the audit diff; "channel: input.channel" is in the audit diff and
 * again in the blockers call. Deleting either one left the other, and the check
 * kept passing while the thing it was about was gone.
 *
 * Same defect as partner-audit's resolver check and observability-audit's
 * functionBody. Scoping is the fix, every time.
 */
function callBlock(source, opening) {
  const at = source.indexOf(opening);
  if (at === -1) return "";
  let depth = 0;
  for (let i = at; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(at, i + 1);
    }
  }
  return source.slice(at);
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("OPERATOR JOB INTAKE");
console.log("");

// ==================================================== where a job lands

/*
 * The landing state is the single most consequential thing this path decides.
 * Field work needs a technician before an engineer has anything to look at;
 * desk work arrives complete. Getting it backwards puts a job in a queue where
 * nobody can act on it, and it sits there looking fine.
 */
{
  rec("field work lands at needs dispatch", landsAt("field") === "needs_dispatch");
  rec("desk work lands at evidence submitted", landsAt("desk") === "evidence_submitted");
  rec(
    "a quote stays at intake",
    landsAt("quote") === "intake",
    "there is nothing to dispatch and nothing to review until somebody accepts a number",
  );

  /*
   * AND IT AGREES WITH THE CUSTOMER PATH, which is the acceptance test.
   * Compared against landingStatusFor rather than restated, so the two cannot
   * drift into describing different things.
   */
  const orders = codeOnly("src/lib/ops-orders.ts");
  const fn = orders.slice(orders.indexOf("export function landingStatusFor"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  rec(
    "and it agrees with the customer path for field",
    /"field"[\s\S]*?return "needs_dispatch"/.test(body),
    "a telephoned job and a web job must produce the same file",
  );
  rec(
    "and for desk",
    /"desk"[\s\S]*?return "evidence_submitted"/.test(body),
  );
}

// ==================================================== the compliance gate

/*
 * THE GATE APPLIES TO THE MONEY AND NOT TO THE RECORD.
 *
 * orderBlockedReason refuses every order while registration is pending. That is
 * about what the firm may SELL. It must not become an inability to write down
 * that somebody telephoned, which would be a records failure dressed as
 * compliance.
 */
{
  const gated = paymentOptions({ prelaunch: true, accountCanInvoice: true, priced: true });

  const link = gated.find((o) => o.intent === "link_sent");
  const invoice = gated.find((o) => o.intent === "invoiced");
  const unpaid = gated.find((o) => o.intent === "released_unpaid");

  rec("under the gate, no payment link may be sent", link?.available === false);
  rec("and no account may be invoiced", invoice?.available === false);
  rec(
    "and both say why, naming the board",
    /Texas Board of Professional Engineers/.test(link?.because ?? "") &&
      /Texas Board of Professional Engineers/.test(invoice?.because ?? ""),
    "the intake says why rather than failing silently",
  );
  rec(
    "but the job can still be opened unpaid",
    unpaid?.available === true,
    "an intake with every option refused is an intake that cannot be completed",
  );

  /*
   * And the gate lifting actually changes something, so the check above cannot
   * be passing because everything is always refused.
   */
  const live = paymentOptions({ prelaunch: false, accountCanInvoice: true, priced: true });
  rec(
    "with the gate lifted a payment link becomes available",
    live.find((o) => o.intent === "link_sent")?.available === true,
  );
  rec(
    "and an account with terms can be invoiced",
    live.find((o) => o.intent === "invoiced")?.available === true,
  );

  /*
   * Money routes that cannot work are refused for their own reasons, not the
   * gate's, so an operator after launch is told the real problem.
   */
  const unpriced = paymentOptions({ prelaunch: false, accountCanInvoice: false, priced: false });
  rec(
    "an unpriced deliverable cannot be charged, and says so without blaming the gate",
    unpriced.find((o) => o.intent === "link_sent")?.available === false &&
      /no published price/.test(unpriced.find((o) => o.intent === "link_sent")?.because ?? ""),
  );
  rec(
    "a client with no account cannot be invoiced, and says so",
    /no account with invoicing terms/.test(
      unpriced.find((o) => o.intent === "invoiced")?.because ?? "",
    ),
  );
  rec(
    "and opening it unpaid is available in every combination",
    [
      paymentOptions({ prelaunch: true, accountCanInvoice: false, priced: false }),
      paymentOptions({ prelaunch: false, accountCanInvoice: false, priced: false }),
      live,
    ].every((set) => set.find((o) => o.intent === "released_unpaid")?.available === true),
  );
}

// ==================================================== the price

/*
 * A PRICE THAT CHANGED WITH NO RECORD OF WHO CHANGED IT OR WHY IS A DISPUTE THE
 * FIRM LOSES. The catalog price stays on the file either way.
 */
{
  const same = decidePrice({ catalogCents: 45000, enteredCents: 45000, reason: null });
  rec("a price equal to the catalog is not an override", same.overridden === false);

  const untouched = decidePrice({ catalogCents: 45000, enteredCents: null, reason: null });
  rec("and neither is not touching the field", untouched.overridden === false);
  rec("which takes the catalog price", untouched.cents === 45000);

  const noReason = decidePrice({ catalogCents: 45000, enteredCents: 40000, reason: null });
  rec(
    "a different price with no reason is refused",
    "error" in noReason,
    "the cheapest moment to insist on the reason is while the operator is still looking at it",
  );

  const thin = decidePrice({ catalogCents: 45000, enteredCents: 40000, reason: "ok" });
  rec(
    "and a reason too short to be a sentence is refused",
    "error" in thin,
    `under ${MIN_OVERRIDE_REASON} characters is a keystroke, not a reason`,
  );

  const good = decidePrice({
    catalogCents: 45000,
    enteredCents: 40000,
    reason: "Agreed with the installer on the call, volume commitment.",
  });
  rec("a different price with a real reason is accepted", good.overridden === true);
  rec("and carries the reason", good.overridden === true && good.reason.length > 10);
  rec("and the entered figure", good.overridden === true && good.cents === 40000);

  rec(
    "a negative price is refused whatever the reason",
    "error" in decidePrice({
      catalogCents: 45000,
      enteredCents: -1,
      reason: "A perfectly good sentence that explains nothing.",
    }),
  );

  /*
   * An unpriced deliverable is not an override. The catalog says null, the
   * operator types a number, and that is the firm setting a price for the first
   * time rather than departing from one. It still needs a reason, because the
   * number came from somewhere and that somewhere is worth recording.
   */
  const fromNull = decidePrice({
    catalogCents: null,
    enteredCents: 60000,
    reason: "Quoted on the call against the published hourly rate.",
  });
  rec("pricing a deliverable the catalog does not price is recorded as an override", fromNull.overridden === true);
}

// ==================================================== what is still missing

{
  const empty = blockers({
    clientId: null,
    serviceSlug: null,
    tier: null,
    propertyAddress: "",
    city: "",
    county: "",
    channel: null,
  });
  /*
   * WHICH fields, not how many. The first version of this asserted a count, got
   * it wrong by one, and would have kept passing if a field had been dropped
   * and another added.
   */
  for (const [what, pattern] of [
    ["the client", /client/i],
    ["the service line", /service line/i],
    ["the deliverable", /deliverable/i],
    ["the property address", /property address/i],
    ["the city or county", /city.*county/i],
    ["how it arrived", /how this job arrived/i],
  ]) {
    rec(`an empty intake asks for ${what}`, empty.some((m) => pattern.test(m)));
  }
  rec(
    "and every one is a sentence rather than a field name",
    empty.every((m) => /^[A-Z].*\.$/.test(m)),
    "a form that will not say which box is wrong is a form people abandon",
  );

  const complete = blockers({
    clientId: "c1",
    serviceSlug: "windstorm-wpi-8",
    tier: "certificate",
    propertyAddress: "1 Any Street",
    city: "Corpus Christi",
    county: "",
    channel: "phone",
  });
  rec("a city alone satisfies the location requirement", complete.length === 0);

  const countyOnly = blockers({
    clientId: "c1",
    serviceSlug: "windstorm-wpi-8",
    tier: "certificate",
    propertyAddress: "1 Any Street",
    city: "",
    county: "Nueces",
    channel: "phone",
  });
  rec("and so does a county alone", countyOnly.length === 0, "asking for both when either will do loses the call");

  const noChannel = blockers({
    clientId: "c1",
    serviceSlug: "windstorm-wpi-8",
    tier: "certificate",
    propertyAddress: "1 Any Street",
    city: "Corpus Christi",
    county: "",
    channel: null,
  });
  rec("how the job arrived is required", noChannel.length === 1);
}

// ==================================================== the wiring

{
  const intake = codeOnly("src/lib/ops-job-intake.ts");

  const createCall = callBlock(intake, "await createFile(");
  rec("the intake calls createFile", createCall.length > 0);
  rec(
    "the intake sets the deliverable on the file",
    /deliverable: input\.tier/.test(createCall),
    "eng_files.deliverable sat unwritten from Phase 6 to Phase 10 and a file could not say what it was for",
  );
  rec(
    "and records how the job arrived",
    /intakeChannel: input\.channel/.test(createCall),
  );
  rec(
    "and keeps the catalog price beside the price that applies",
    /catalogPriceCents: catalogCents/.test(createCall),
    "the original stays visible so an override can be argued with",
  );
  rec(
    "and keeps the coastal surcharge as its own figure",
    /coastalSurchargeCents:/.test(intake),
    "folding it into the total would make the file unable to explain itself",
  );

  /*
   * The landing move goes through transitionFile. files-audit enforces this
   * globally; it is asserted here too because this is the newest caller and the
   * one most likely to be written the other way by somebody in a hurry.
   */
  rec(
    "the landing move goes through transitionFile",
    /await transitionFile\(/.test(intake) && !/from\("eng_files"\)[\s\S]{0,120}\.update\(/.test(intake),
    "a raw status write skips the grammar, which is how ops-payments drifted for three phases",
  );

  const auditCall = callBlock(intake, "await writeAudit(");
  rec("the intake writes an audit row", /action: "job\.taken"/.test(auditCall));
  rec(
    "every intake writes the audit trail naming the channel",
    /channel: input\.channel/.test(auditCall),
    "who took this call is the question asked when a customer says they were quoted something else",
  );

  /*
   * The gate is re-checked on the server. The screen decides which buttons to
   * draw; this decides what may be recorded, and a hand crafted body must reach
   * the same refusal the screen shows.
   */
  rec(
    "the server re-checks the payment gate rather than trusting the screen",
    /paymentOptions\(\{/.test(intake) && /isPrelaunch\(\)/.test(intake),
  );

  const route = codeOnly("src/app/api/portal/files/route.ts");
  rec("the route exposes take_job", /action === "take_job"/.test(route));
  rec(
    "and it requires the same permission as opening a file",
    /take_job[\s\S]{0,220}can\(actor, "files\.create"\)/.test(route),
    "taking a job IS opening a file; the difference is how much is known, not who may",
  );
  rec(
    "client search is behind a permission too",
    /search_clients[\s\S]{0,220}can\(actor, "clients\.list"\)/.test(route),
  );
}

// ==================================================== the vocabularies agree

{
  const sql = readFileSync("supabase/migrations/0015_operator_intake.sql", "utf8");
  for (const channel of INTAKE_CHANNELS) {
    rec(`the database accepts the channel ${channel}`, sql.includes(`'${channel}'`));
  }
  for (const intent of PAYMENT_INTENTS) {
    rec(`the database accepts the payment intent ${intent}`, sql.includes(`'${intent}'`));
  }
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A telephoned job and a job ordered on the website must produce the same");
  console.log("file. Two definitions of a job is a firm that cannot seal one of them.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. A telephone call becomes a real job.`);
