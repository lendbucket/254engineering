/**
 * IS THE WEBHOOK REGISTERED WHERE THE KEY WILL SEND IT?
 *
 *   npx tsx scripts/stripe-webhook-audit.mjs                 (credential free)
 *   STRIPE_SECRET_KEY=sk_... npx tsx scripts/stripe-webhook-audit.mjs   (live)
 *
 * LAYER ONE OF THE ACCOUNT CONSISTENCY CHECK. Operator ruling, 2026-09-16, and
 * it is the layer that matters.
 *
 * THE FAILURE IT EXISTS FOR, AND WHY THE OTHER TWO LAYERS CANNOT SEE IT. The
 * secret key creates sessions in account A. Our URL is registered in account B.
 * Then **A never calls us**: no 400, no log line, no event at all. The customer
 * pays, Stripe shows the charge, and the order sits at awaiting_payment
 * forever. Layers two and three both run ON a webhook, so in the silent case
 * they are green for the reason that mattered.
 *
 * This one asks the question without waiting to be called, which is the only
 * way to catch silence.
 *
 * WHAT RUNS WITHOUT CREDENTIALS, AND IT IS NOT NOTHING. The handler's event
 * list is PARSED out of the adapter and compared against the declaration in
 * src/config/stripe-webhook.ts, and the declared path is checked against the
 * route that exists on disk. A fourth handled event that nobody registered
 * turns this red and names it, with no key and no network.
 *
 * UNREACHABLE IS NOT FAILED. With no key the live half reports COULD NOT TELL
 * and exits zero, saying loudly that it did not run. A red mark everybody
 * learns to ignore is where the next real failure hides.
 */
import { existsSync } from "node:fs";
import { readSource } from "./lib/read-source.mjs";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });
const tell = [];

console.log("");
console.log("============ THE STRIPE WEBHOOK REGISTRATION ============");
console.log("");

const { stripeWebhookEndpoint } = await import("../src/config/stripe-webhook.ts");

/* ---------------------------------------------- 1. the declaration, on disk */

/*
 * The events the HANDLER branches on, read out of its source rather than typed
 * here. An audit that lists them itself would compare a value to itself, and
 * the whole point is to catch a handler that grew a branch nobody registered.
 */
const adapter = readSource("src/lib/payments-stripe.ts");
const handled = [...adapter.matchAll(/event\.type === "([a-z0-9_.]+)"/g)].map((m) => m[1]);

rec(
  "the handler's event list was found in the adapter",
  handled.length > 0,
  `${handled.length} parsed: ${handled.join(", ") || "none, which means this check is reading nothing"}`,
);

const declared = [...stripeWebhookEndpoint.registeredEvents].sort();
const branches = [...new Set(handled)].sort();

rec(
  "every event the handler branches on is declared as registered",
  branches.every((e) => declared.includes(e)),
  branches.filter((e) => !declared.includes(e)).join(", ") || `${branches.length} handled, all declared`,
);
rec(
  "and nothing is declared as registered that the handler ignores",
  declared.every((e) => branches.includes(e)),
  declared.filter((e) => !branches.includes(e)).join(", ") || `${declared.length} declared, all handled`,
);

/*
 * The declared path is a real route. A URL declared against a path that does
 * not exist is the account-doors defect: a declaration nobody read against the
 * code.
 */
const routeFile = `src/app${stripeWebhookEndpoint.path}/route.ts`;
rec(
  "the declared path is a route that exists on disk",
  existsSync(routeFile),
  routeFile,
);
rec(
  "and the declared URL is that path on the production host",
  stripeWebhookEndpoint.url === `https://254engineering.com${stripeWebhookEndpoint.path}`,
  stripeWebhookEndpoint.url,
);
rec(
  "and somebody said who registered it and when",
  stripeWebhookEndpoint.verified.trim().length > 40,
  stripeWebhookEndpoint.verified.slice(0, 80),
);

/* ------------------------------------------------ 2. what Stripe says, live */

const key = process.env.STRIPE_SECRET_KEY;

if (!key) {
  tell.push(
    "The live half did NOT run: STRIPE_SECRET_KEY is not set, so nothing asked Stripe whether the " +
      "account behind the key has this endpoint registered. That is the half that catches a webhook " +
      "registered in the wrong account, which is the failure that sends no webhook at all. Run it " +
      "with the key before any merge that touches payments.",
  );
} else {
  const Stripe = (await import("stripe")).default;
  const client = new Stripe(key, { appInfo: { name: "254 stripe-webhook-audit" } });

  let account = null;
  let endpoints = null;
  let reachError = null;
  try {
    account = await client.accounts.retrieve();
    endpoints = await client.webhookEndpoints.list({ limit: 100 });
  } catch (err) {
    reachError = err instanceof Error ? err.message : "unknown error";
  }

  if (reachError) {
    /*
     * COULD NOT TELL, never failed. The same third verdict the rest of this
     * build uses: an outage is not a misconfiguration, and a red mark for a
     * network blip is how a real red gets ignored.
     */
    tell.push(`The live half could not reach Stripe and reports nothing: ${reachError}`);
  } else {
    const mine = endpoints.data.filter((e) => e.url === stripeWebhookEndpoint.url);
    const enabled = mine.filter((e) => e.status === "enabled");

    rec(
      "the account behind the secret key has this endpoint registered",
      mine.length > 0,
      mine.length
        ? `${mine.length} at ${stripeWebhookEndpoint.url} on ${account.id}`
        : `account ${account.id} has NO endpoint at ${stripeWebhookEndpoint.url}. It will never call this platform, and nothing else can see that.`,
    );
    rec(
      "and exactly one of them, enabled",
      enabled.length === 1,
      `${mine.length} registered, ${enabled.length} enabled`,
    );

    const live = enabled[0];
    const enabledEvents = live ? [...live.enabled_events].sort() : [];
    rec(
      "and it is subscribed to every event the handler branches on",
      Boolean(live) && branches.every((e) => enabledEvents.includes(e) || enabledEvents.includes("*")),
      live
        ? branches.filter((e) => !enabledEvents.includes(e) && !enabledEvents.includes("*")).join(", ") ||
            `${enabledEvents.length} enabled`
        : "no enabled endpoint to read",
    );
    rec(
      "and to nothing the handler ignores, so a retry backlog cannot build behind an event nobody handles",
      Boolean(live) && !enabledEvents.includes("*") && enabledEvents.every((e) => branches.includes(e)),
      live ? enabledEvents.filter((e) => !branches.includes(e)).join(", ") || "none extra" : "no enabled endpoint to read",
    );

    /*
     * The key's mode against the endpoint's. An endpoint lives in one mode, and
     * `accounts.retrieve` answers for the key's. A live key reading a test
     * endpoint list is a configuration that will never deliver.
     */
    const keyIsLive = key.startsWith("sk_live_") || key.startsWith("rk_live_");
    rec(
      `the key is a ${keyIsLive ? "live" : "test"} key and the endpoints listed are its own mode`,
      true,
      `account ${account.id}${account.settings?.dashboard?.display_name ? ` (${account.settings.dashboard.display_name})` : ""}, ${endpoints.data.length} endpoint(s) in ${keyIsLive ? "live" : "test"} mode`,
    );
  }
}

/* ----------------------------------------------------------------- verdict */

console.log("");
for (const r of out) console.log(`  ${r.ok ? "PASS" : "FAIL"}: ${r.name}${r.note ? ` (${r.note})` : ""}`);
for (const t of tell) console.log(`  COULD NOT TELL: ${t}`);
console.log("");

const failed = out.filter((r) => !r.ok);
if (failed.length === 0) {
  console.log(`PASS: ${out.length} checks.${tell.length ? " The live half did not run; see above." : ""}`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A webhook registered in the wrong account sends nothing at all, which is the one");
  console.log("failure no amount of logging on this side can see.");
  process.exitCode = 1;
}
