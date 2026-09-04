/**
 * The boundary between a customer and a member of staff.
 *
 *   npx tsx scripts/accounts-audit.mjs
 *
 * WHAT THIS AUDIT IS FOR
 * ----------------------
 * Phase 8 added a second kind of person. Every other audit in this suite asks
 * whether the platform does the right thing; this one asks whether two systems
 * that look alike can be confused for each other.
 *
 * The failure it exists to prevent is not subtle and would not be noticed: a
 * customer cookie accepted as a staff session, or a customer reaching a portal
 * route, would look like a working site right up until a solar installer opened
 * the review queue.
 *
 * It is pure. No server, no database, no network, so it runs in phase zero.
 */

import { existsSync, readFileSync } from "node:fs";
import { issueOpsSession, readOpsSession, OPS_COOKIE } from "../src/lib/ops-session.ts";
import {
  issueCustomerSession,
  readCustomerSession,
  CUSTOMER_COOKIE,
} from "../src/lib/customer-session.ts";
import {
  newPasswordRecord,
  passwordMatches,
  MIN_CUSTOMER_PASSWORD_LENGTH,
} from "../src/lib/customer-auth.ts";
import { ROLES } from "../src/lib/ops-authz.ts";

/**
 * Source with comments removed.
 *
 * The first version of the checks below grepped whole files, and three of them
 * failed against the very comments that explain why the code does NOT do the
 * thing being checked for. A check that reads prose is a check looking at the
 * wrong thing, which is the defect class this repository exists to hunt, and it
 * appeared here in an audit written to hunt it.
 */
function codeOnly(path) {
  const withoutBlocks = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const OPS_SECRET = "an-ops-secret-long-enough-to-pass";
const CUS_SECRET = "a-customer-secret-long-enough-ok";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// =========================================================================
// 1. THE TWO COOKIES CANNOT BE MISTAKEN FOR EACH OTHER
// =========================================================================

rec("the two cookies have different names", OPS_COOKIE !== CUSTOMER_COOKIE, `${OPS_COOKIE} vs ${CUSTOMER_COOKIE}`);

withEnv({ OPS_SESSION_SECRET: OPS_SECRET, CUSTOMER_SESSION_SECRET: CUS_SECRET }, () => {
  const ops = issueOpsSession(UUID_A, "admin");
  const cus = issueCustomerSession(UUID_A, UUID_B);

  rec("an ops session is issued", ops !== null);
  rec("a customer session is issued", cus !== null);

  /*
   * The two directions that matter. Either one failing is a privilege boundary
   * that does not exist.
   */
  rec("a CUSTOMER cookie is not readable as an ops session", readOpsSession(cus.value) === null);
  rec("an OPS cookie is not readable as a customer session", readCustomerSession(ops.value) === null);

  rec("an ops cookie still reads as itself", readOpsSession(ops.value)?.role === "admin");
  rec("and a customer cookie as itself", readCustomerSession(cus.value)?.account === UUID_B);
});

/*
 * THE CASE SOMEBODY WILL EVENTUALLY CREATE.
 *
 * Two secrets set to the same string, because whoever configured the deployment
 * copied one line. If the boundary depended only on the secret differing, that
 * mistake would silently make each cookie readable as the other.
 *
 * It does not, because the HMAC label differs, so the derived keys differ even
 * when the secrets are identical.
 */
withEnv({ OPS_SESSION_SECRET: OPS_SECRET, CUSTOMER_SESSION_SECRET: OPS_SECRET }, () => {
  const ops = issueOpsSession(UUID_A, "admin");
  const cus = issueCustomerSession(UUID_A, UUID_B);
  rec(
    "with BOTH secrets set to the same string, a customer cookie still is not an ops session",
    readOpsSession(cus.value) === null,
    "the HMAC label differs, so the derived keys differ",
  );
  rec(
    "and an ops cookie still is not a customer session",
    readCustomerSession(ops.value) === null,
  );
});

/*
 * A payload hand built to look like the other one. This is the shape check
 * rather than the signature check: even correctly signed, an ops payload whose
 * third field is a uuid is not a role, and a customer payload whose second field
 * is a role word is refused outright.
 */
withEnv({ CUSTOMER_SESSION_SECRET: CUS_SECRET }, () => {
  for (const role of ROLES) {
    const forged = issueCustomerSession(UUID_A, role);
    rec(
      `a customer session carrying the literal role "${role}" is refused`,
      readCustomerSession(forged.value) === null,
      "the account id must never be a staff role word",
    );
  }
});

// An unset secret closes the door rather than opening it.
withEnv({ CUSTOMER_SESSION_SECRET: undefined }, () => {
  rec("no customer secret means no session can be issued", issueCustomerSession(UUID_A, UUID_B) === null);
  rec("and none can be read", readCustomerSession("anything.at.all.here") === null);
});

withEnv({ CUSTOMER_SESSION_SECRET: "short" }, () => {
  rec("a too short customer secret is rejected as weak", issueCustomerSession(UUID_A, UUID_B) === null);
});

// Expiry.
withEnv({ CUSTOMER_SESSION_SECRET: CUS_SECRET }, () => {
  const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
  const stale = issueCustomerSession(UUID_A, UUID_B, past);
  rec("an expired customer session is refused", readCustomerSession(stale.value) === null);

  const good = issueCustomerSession(UUID_A, UUID_B);
  const tampered = good.value.slice(0, -1) + (good.value.slice(-1) === "A" ? "B" : "A");
  rec("a tampered signature is refused", readCustomerSession(tampered) === null);
});

// =========================================================================
// 2. PASSWORDS
// =========================================================================

{
  const { hash, salt } = newPasswordRecord("a-long-enough-password");
  rec("a password verifies against its own record", passwordMatches("a-long-enough-password", hash, salt));
  rec("and a wrong one does not", !passwordMatches("a-long-enough-passworE", hash, salt));

  /*
   * The invited-but-never-set case. A null hash must refuse before it compares
   * anything: the naive version compares against an empty string and, with a
   * short enough password, could match.
   */
  rec("an account with no password set cannot be signed into", !passwordMatches("", null, null));
  rec("and neither with a null hash and a real salt", !passwordMatches("anything", null, salt));
  rec("nor a real hash and a null salt", !passwordMatches("anything", hash, null));

  const second = newPasswordRecord("a-long-enough-password");
  rec(
    "the same password hashes differently for two users",
    second.hash !== hash,
    "a per user salt, so one leaked hash does not identify shared passwords",
  );

  rec("the minimum length is at least twelve", MIN_CUSTOMER_PASSWORD_LENGTH >= 12, String(MIN_CUSTOMER_PASSWORD_LENGTH));
}

// =========================================================================
// 3. THE SOURCE BOUNDARY
// =========================================================================

{
  const authz = codeOnly("src/lib/ops-authz.ts");
  rec(
    "ops-authz has no notion of a customer",
    !/customer/i.test(authz),
    "the module that grants capabilities must not know the type exists",
  );

  const custAuth = codeOnly("src/lib/customer-auth.ts");
  rec(
    "customer-auth never imports the staff authorization module",
    !/from ["']\.\/ops-authz["']/.test(custAuth),
    "there must be no path from a customer to an Actor",
  );
  rec(
    "and never touches auth.users or eng_profiles",
    !/eng_profiles|auth\.users/.test(custAuth),
    "a customer has no row in either, which is what makes the boundary structural",
  );
  rec(
    "a customer principal is scoped to one brand",
    /account\.site !== SITE_KEY/.test(custAuth),
    "the eng_ tables are shared, so without this a sister brand customer could sign in here",
  );
  rec(
    "the account status is checked as well as the user status",
    /principal\.account\.status !== "active"/.test(custAuth),
    "suspending an account must close the door for all of its users",
  );

  const proxy = codeOnly("src/proxy.ts");
  rec(
    "the proxy gates /account with the customer cookie",
    /pathname\.startsWith\("\/account"\)/.test(proxy) && /readCustomerSession/.test(proxy),
  );
  rec(
    "and /account is in the matcher, so the gate actually runs",
    /"\/account\/:path\*"/.test(proxy) && /"\/api\/account\/:path\*"/.test(proxy),
  );
  /*
   * The account branch returns before the ops branch is reached, so a staff
   * cookie is never consulted for a customer route and vice versa. If the
   * account branch ever stopped returning, a staff session would start opening
   * customer pages.
   */
  const accountBranch = proxy.indexOf('pathname.startsWith("/account")');
  const opsRead = proxy.indexOf("readOpsSession(request.cookies");
  rec(
    "the customer branch is decided before the staff session is read",
    accountBranch !== -1 && opsRead !== -1 && accountBranch < opsRead,
  );

  /*
   * THE ONE THIS AUDIT ORIGINALLY MISSED.
   *
   * Ordering the branches is not enough. A staff cookie read INSIDE the account
   * branch, as a convenience so an operator can look at a customer screen, would
   * pass every check above: the branch is still first, the customer cookie is
   * still read, the matcher is still right. Injection verification found that
   * hole, in an audit written to prevent exactly this class of thing.
   *
   * So the account branch is read on its own and must not mention the staff
   * session at all.
   */
  const branchStart = accountBranch;
  const branchEnd = proxy.indexOf("\n  }", branchStart);
  const accountBody = branchStart === -1 ? "" : proxy.slice(branchStart, branchEnd === -1 ? undefined : branchEnd);
  rec(
    "the account branch never reads the staff cookie as a fallback",
    branchStart !== -1 && !/readOpsSession|OPS_COOKIE/.test(accountBody),
    "an operator who wants to see a customer screen signs in as that customer, which the trail records",
  );

  /*
   * And the reverse: the staff branch must not accept a customer cookie. This
   * one is currently true by construction, because the staff branch reads only
   * readOpsSession, but it is asserted rather than assumed for the same reason.
   */
  const staffBody = opsRead === -1 ? "" : proxy.slice(opsRead);
  rec(
    "the staff branch never reads the customer cookie as a fallback",
    opsRead !== -1 && !/readCustomerSession|CUSTOMER_COOKIE/.test(staffBody),
  );

  rec(
    "both account prefixes are in the matcher",
    /"\/account\/:path\*",/.test(proxy) && /"\/api\/account\/:path\*",/.test(proxy),
  );

  const layout = codeOnly("src/app/account/layout.tsx");
  rec(
    "the account surface is never indexed",
    /index: false/.test(layout),
    "a login page in a search result invites credential stuffing",
  );
  rec(
    "and shares no layout with the portal",
    !/currentActor|ops-authz|PortalChrome/.test(layout),
  );
}

// =========================================================================
// 4. WHAT AN ACCOUNT OWNER MAY DO THAT A MEMBER MAY NOT
// =========================================================================

{
  const account = codeOnly("src/lib/ops-account.ts");

  /*
   * account_role has two values and this is the only place it matters. Each of
   * the three mutating functions checks it, and the check lives in the module
   * rather than the route so a second caller cannot skip it.
   */
  for (const fn of ["updateDefaults", "addProperty", "archiveProperty"]) {
    const start = account.indexOf(`export async function ${fn}`);
    const body = start === -1 ? "" : account.slice(start, account.indexOf("export async function", start + 10));
    rec(
      `${fn} refuses a member`,
      start !== -1 && /me\.accountRole !== "owner"/.test(body),
      "the check is in the module, not the route",
    );
  }

  const route = codeOnly("src/app/api/account/settings/route.ts");
  rec(
    "and the settings route does not decide who may do it",
    !/accountRole/.test(route),
    "one place decides, so a second action cannot forget",
  );

  /*
   * A property id from another organisation must match nothing rather than be
   * loaded and then refused. Filtering after the fact has already fetched the
   * row it is about to hide.
   */
  rec(
    "archiving a property is scoped to the account in the query",
    /\.eq\("account_id", me\.accountId\)/.test(account),
  );
  rec(
    "and a property is archived rather than deleted",
    /archived_at: new Date\(\)\.toISOString\(\)/.test(account) && !/\.delete\(\)/.test(account),
    "orders already placed against it must keep their record",
  );

  /*
   * A stored default that nothing reads is a settings screen that lies. The
   * standing access instructions have to reach the order, and they have to be
   * applied on the SERVER: a default the browser filled in is a default the
   * customer can change without changing the setting.
   */
  const bulk = codeOnly("src/app/api/account/bulk/route.ts");
  rec(
    "the standing access instructions are applied to a bulk submission",
    /inputs\.access_notes = defaults\.accessInstructions/.test(bulk),
  );
  rec(
    "and they are read on the server rather than sent by the browser",
    /accountDefaults\(me\.accountId\)/.test(bulk),
  );

  /*
   * The one default that is NOT wired to behaviour, and says so. The catalog
   * does not price urgency, so setting a file to expedited from a saved
   * preference would commit the firm to faster work at the standard price.
   */
  const settingsUi = readFileSync("src/app/account/settings/SettingsClient.tsx", "utf8");
  rec(
    "the turnaround preference does not claim to be a commitment",
    /not a commitment/.test(settingsUi) && /does not change\s*\n?\s*the price/.test(settingsUi.replace(/\s+/g, " ")),
    settingsUi.includes("not a commitment") ? "" : "a promise the firm has not priced",
  );
}

// =========================================================================
// 5. THE ORDERING API
//
// A public surface that creates orders and moves money. Everything below is
// a way of getting that wrong that would still look like a working API.
// =========================================================================

{
  const keys = codeOnly("src/lib/account-api-keys.ts");
  const route = codeOnly("src/app/api/v1/orders/route.ts");

  /*
   * The whole security model. A key belongs to one organisation and the route
   * reads the organisation off the key, so there is no field in which a caller
   * could ask to order for somebody else.
   */
  rec(
    "the API takes its account from the key",
    /accountId: key\.accountId/.test(route),
  );
  rec(
    "and never from the request body",
    !/body\?\.accountId|body\.accountId/.test(route),
    "there must be no field in which to ask",
  );

  rec(
    "a key is stored hashed, never in plaintext",
    /key_hash: hashKey\(key\)/.test(keys) && !/key_plain|plaintext:/.test(keys),
  );
  rec(
    "and is looked up by hash rather than compared in the application",
    /\.eq\("key_hash", hashKey\(presented\)\)/.test(keys),
  );
  /*
   * Scoped to verifyApiKey. An unscoped check passed against an injected
   * version that removed this filter, because revokeApiKey contains the same
   * clause and satisfied it. The right string in the wrong function is not the
   * check anybody meant to write.
   */
  const verify = keys.slice(
    keys.indexOf("export async function verifyApiKey"),
    keys.indexOf("export async function withinRateLimit"),
  );
  rec(
    "a revoked key is refused by the same query that finds it",
    /\.is\("revoked_at", null\)/.test(verify),
    "not by a separate check somebody could forget",
  );
  rec(
    "and a suspended account closes every key on it",
    /account\.status !== "active"/.test(keys),
    "otherwise a suspension would only apply to the website",
  );

  /*
   * One refusal for an absent key, a malformed key, a wrong key, a revoked key
   * and a suspended account. Distinguishing them tells somebody holding a
   * revoked key that it was once real.
   */
  /*
   * The 401 branch must return ONE constant. Counting occurrences of the word
   * passed against an injected version that added a second, different message
   * beside it, because the original string was still there once.
   */
  const authBranch = route.slice(route.indexOf("if (!key)"), route.indexOf("const limit ="));
  rec(
    "every authentication failure gives one message",
    /error: "Unauthorised\." \}/.test(authBranch) && !/presented \?/.test(authBranch),
    "a branch here tells somebody a revoked key was once real",
  );

  // The compliance gate applies to the API exactly as to the website.
  rec(
    "the API is closed by the compliance gate",
    /if \(isPrelaunch\(\)\) \{/.test(route),
    "the condition itself, because a disabled branch still contains the call",
  );
  rec(
    "and the gate is checked before anything is created",
    route.indexOf("isPrelaunch()") < route.indexOf("placeBatch("),
  );

  // Rate limiting, and where it lives.
  rec("the API is rate limited", /withinRateLimit\(key\)/.test(route));
  rec(
    "the limit is counted in the database, not in process memory",
    /from\("eng_account_api_requests"\)/.test(keys) && !/new Map\(\)/.test(keys),
    "a limiter in memory is enforced per function instance, so the real ceiling is the limit times however many are warm",
  );
  rec(
    "a refused request counts against the limit too",
    /recordApiRequest\(\{ key, route: ROUTE, status: 429 \}\)/.test(route),
    "otherwise bad bodies are free",
  );
  rec(
    "and a key with no limit set takes the platform default rather than none",
    /rate_limit_per_minute === null \? DEFAULT_RATE_LIMIT/.test(keys),
    "an unset limit must not be the permissive case",
  );

  /*
   * The API must not be a second order engine. It calls placeBatch, which
   * calls placeOrder, which is what order-audit points at.
   */
  rec("the API places work through placeBatch", /placeBatch\(\{/.test(route));
  rec(
    "and does not compute a price of its own",
    !/priceCents\s*[*+]|totalCents\s*=/.test(route),
  );
  rec("and requires an idempotency key", /clientRequestId is required/.test(route));

  rec(
    "only an owner can create or revoke a key",
    (keys.match(/accountRole !== "owner"/g) ?? []).length >= 2,
  );
  rec(
    "and revoking is scoped to the account in the query",
    /\.eq\("account_id", me\.accountId\)/.test(keys),
  );

  /*
   * The request log holds no request body. It exists to count requests, and a
   * second copy of a property address and a customer email is a second place
   * that data has to be protected.
   */
  rec(
    "the request log stores no request body",
    !/body: |payload: |properties:/.test(codeOnly("src/lib/account-api-keys.ts").slice(keys.indexOf("recordApiRequest"))),
  );

  // Documented in the repo, not on the public site.
  rec("the API is documented", existsSync("docs/ordering-api.md"));
  const docs = readFileSync("docs/ordering-api.md", "utf8");
  rec(
    "and the documentation says it is not published publicly",
    /not on the public site/.test(docs),
  );
  rec(
    "and says an unset credit limit means no credit",
    /no credit limit set has no credit/.test(docs.replace(/\*/g, "")),
    "markdown emphasis sits inside that phrase, so the check reads it unstarred",
  );
  rec(
    "and tells a caller not to resubmit after a 503",
    /Do not resubmit/.test(docs),
    "a resubmission after a saved batch would place everything twice",
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("A customer and a member of staff must not be confusable. Nothing else in this");
  console.log("phase is safe to ship while one of these is red.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. A customer cannot become a member of staff.`);
