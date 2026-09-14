// @runtime react-server
//
// Declared because this audit reaches a module carrying `server-only`, so it
// cannot run under plain node or under tsx without the react-server condition.
// scripts/lib/audit-runtime.mjs works the requirement out from the imports and
// the board refuses to start when package.json disagrees, so this line and the
// invocation cannot drift apart.
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

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readSource } from "./lib/read-source.mjs";
import { createHmac } from "node:crypto";
import { issueOpsSession, readOpsSession, OPS_COOKIE } from "../src/lib/ops-session.ts";
import {
  issueCustomerSession,
  readCustomerSession,
  CUSTOMER_COOKIE,
} from "../src/lib/customer-session.ts";
import {
  issuePartnerSession,
  readPartnerSession,
  partnerSessionConfigured,
  PARTNER_COOKIE,
} from "../src/lib/partner-session.ts";
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
  const withoutBlocks = readSource(path).replace(/\/\*[\s\S]*?\*\//g, "");
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

// =========================================================================
// 1b. AND NEITHER OF THEM CAN BE MISTAKEN FOR A PARTNER
// =========================================================================
//
// Phase 9 added a third principal. Two cookies needed two checks; three cookies
// need six, because every pair is a boundary and a pair nobody checked is the
// one that will fail. They are enumerated rather than spot checked.

const PARTNER_SECRET = "a-partner-secret-long-enough-ok!";

rec(
  "all three cookies have different names",
  new Set([OPS_COOKIE, CUSTOMER_COOKIE, PARTNER_COOKIE]).size === 3,
  `${OPS_COOKIE}, ${CUSTOMER_COOKIE}, ${PARTNER_COOKIE}`,
);

withEnv(
  {
    OPS_SESSION_SECRET: OPS_SECRET,
    CUSTOMER_SESSION_SECRET: CUS_SECRET,
    PARTNER_SESSION_SECRET: PARTNER_SECRET,
  },
  () => {
    const ops = issueOpsSession(UUID_A, "admin");
    const cus = issueCustomerSession(UUID_A, UUID_B);
    const par = issuePartnerSession(UUID_A, UUID_B);

    rec("a partner session is issued", par !== null);

    /*
     * Six directions. Every one of them failing would be a privilege boundary
     * that does not exist, and the partner ones are the newest and therefore
     * the least exercised by anything else.
     */
    rec("a PARTNER cookie is not readable as an ops session", readOpsSession(par.value) === null);
    rec("a PARTNER cookie is not readable as a customer session", readCustomerSession(par.value) === null);
    rec("an OPS cookie is not readable as a partner session", readPartnerSession(ops.value) === null);
    rec("a CUSTOMER cookie is not readable as a partner session", readPartnerSession(cus.value) === null);
    rec("and a partner cookie still reads as itself", readPartnerSession(par.value)?.partner === UUID_B);

    /*
     * The marker field, which is the belt to the signing key's braces.
     *
     * A partner payload is sub.partner.p.exp: five fields with a literal marker
     * where the other two carry a role or an account. Stripping it must not
     * leave something another reader accepts, and the reader must refuse its
     * own cookie without it.
     */
    /*
     * THE MARKER, ISOLATED FROM THE LENGTH CHECK.
     *
     * The first version of this deleted the marker field and asserted the
     * result was refused. It was, by the length check: four fields where five
     * were expected. Removing the marker VALIDATION entirely still passed,
     * because the test never exercised it.
     *
     * So the forged cookie keeps five fields and carries the wrong marker, and
     * it is signed correctly for that payload. Only the marker check can refuse
     * it, which is what makes this a test of the marker.
     */
    const forgeWithMarker = (marker) => {
      const key = createHmac("sha256", PARTNER_SECRET).update("eng-partner-session-v1").digest();
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payload = `${UUID_A}.${UUID_B}.${marker}.${exp}`;
      return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
    };

    rec(
      "a correctly signed partner cookie with the wrong marker is refused",
      readPartnerSession(forgeWithMarker("x")) === null,
      "the signature is valid, so only the marker check can refuse it",
    );
    rec(
      "and the same forgery with the right marker is accepted",
      readPartnerSession(forgeWithMarker("p"))?.partner === UUID_B,
      "otherwise the check above would pass for the wrong reason",
    );

    const withoutMarker = par.value.split(".").filter((_, i) => i !== 2).join(".");
    rec("a partner cookie with a field removed is refused", readPartnerSession(withoutMarker) === null);
    rec("and is not accepted by either other reader", readOpsSession(withoutMarker) === null && readCustomerSession(withoutMarker) === null);

    /*
     * THE KEY DERIVATION, ISOLATED FROM THE PAYLOAD SHAPE.
     *
     * A partner shaped payload signed with the CUSTOMER key. The shape is
     * right, the marker is right, the length is right; only the derived key is
     * wrong. If the two labels were ever made identical this is the check that
     * notices, and nothing else would.
     */
    const wrongKey = createHmac("sha256", CUS_SECRET).update("eng-customer-session-v1").digest();
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const payload = `${UUID_A}.${UUID_B}.p.${exp}`;
    const crossSigned = `${payload}.${createHmac("sha256", wrongKey).update(payload).digest("base64url")}`;
    rec(
      "a partner shaped payload signed with the customer key is refused",
      readPartnerSession(crossSigned) === null,
      "shape, marker and length are all correct here, so only the derived key can refuse it",
    );
  },
);

/*
 * THE SAME MISTAKE, NOW WITH THREE SECRETS.
 *
 * Somebody copies one line in a deployment config and all three secrets are the
 * same string. If any boundary depended only on the secret differing, that
 * mistake would silently make each cookie readable as the others.
 */
withEnv(
  {
    OPS_SESSION_SECRET: "identical-secret-for-all-three-x",
    CUSTOMER_SESSION_SECRET: "identical-secret-for-all-three-x",
    PARTNER_SESSION_SECRET: "identical-secret-for-all-three-x",
  },
  () => {
    const ops = issueOpsSession(UUID_A, "admin");
    const cus = issueCustomerSession(UUID_A, UUID_B);
    const par = issuePartnerSession(UUID_A, UUID_B);

    rec(
      "with all three secrets identical, a partner cookie is still not an ops session",
      readOpsSession(par.value) === null,
    );
    rec(
      "and still not a customer session",
      readCustomerSession(par.value) === null,
    );
    rec(
      "and neither of theirs is a partner session",
      readPartnerSession(ops.value) === null && readPartnerSession(cus.value) === null,
    );
  },
);

/*
 * A partner has no role, for the same reason a customer has none: roles are
 * what ops-authz grants capabilities from, and a partner must never appear in
 * that system at all.
 */
/*
 * THE THREE HMAC LABELS, CHECKED DIRECTLY, AND WHAT THIS CHECK IS HONESTLY FOR.
 *
 * An injection making the partner label identical to the customer's changed
 * nothing detectable: the payload SHAPES still differ, so neither reader would
 * accept the other's cookie whatever the keys were. The label is redundant
 * today.
 *
 * It is not redundant tomorrow. It exists so that a future change converging
 * the shapes, which is exactly the sort of tidying somebody does when three
 * session modules look alike, does not silently remove the boundary. Testing it
 * behaviourally is impossible while the shapes differ, so it is tested
 * directly: three distinct labels, read from the three modules.
 */
{
  const labels = ["ops-session", "customer-session", "partner-session"].map((f) => {
    const src = readSource(`src/lib/${f}.ts`);
    const m = src.match(/\.update\("([a-z0-9-]+)"\)/);
    return m ? m[1] : null;
  });
  rec("each session module derives its key with its own label", labels.every(Boolean), labels.join(", "));
  rec(
    "and the three labels are distinct",
    new Set(labels).size === 3,
    labels.join(", "),
  );
}

/*
 * The three checks below were greps and are now behaviour, because all three
 * passed against an injected break. A grep for `if (typeof secret !== "string"`
 * matched a line that had been changed to return a fallback key from that very
 * condition; a grep for the word "role" survived deleting the role guard
 * entirely. Right string, wrong meaning, three times in one block.
 */
withEnv(
  {
    OPS_SESSION_SECRET: OPS_SECRET,
    CUSTOMER_SESSION_SECRET: CUS_SECRET,
    PARTNER_SESSION_SECRET: PARTNER_SECRET,
  },
  () => {
    /*
     * A partner id that is a staff role word must not survive a round trip.
     * Nothing can currently produce one, because it is a uuid, and that is
     * exactly why the guard is cheap insurance against a future payload change.
     */
    for (const word of ["admin", "engineer", "field_tech"]) {
      const forged = issuePartnerSession(UUID_A, word);
      rec(
        `a partner session carrying the role word "${word}" does not read back`,
        forged === null || readPartnerSession(forged.value) === null,
        "roles are what ops-authz grants from, and a partner is not in that system",
      );
    }
  },
);

withEnv({ PARTNER_SESSION_SECRET: undefined }, () => {
  rec("with no partner secret, the session is not configured", partnerSessionConfigured() === false);
  rec("and no partner session can be issued", issuePartnerSession(UUID_A, UUID_B) === null);
  rec(
    "and an unset partner secret is a closed door",
    readPartnerSession("anything.at.p.all.here") === null,
    "the failure mode of a missing secret is a closed door, never an open one",
  );
});

withEnv({ PARTNER_SESSION_SECRET: "short" }, () => {
  rec(
    "and a partner secret below the minimum length is rejected as too weak",
    partnerSessionConfigured() === false,
  );
});

/*
 * The partner secret does not fall back to another principal's.
 *
 * Behavioural: with only the OPS secret set, no partner session may be issued.
 * A source grep for the variable name passed while the code read
 * `PARTNER_SESSION_SECRET ?? OPS_SESSION_SECRET`.
 */
withEnv(
  { PARTNER_SESSION_SECRET: undefined, OPS_SESSION_SECRET: OPS_SECRET, CUSTOMER_SESSION_SECRET: CUS_SECRET },
  () => {
    rec(
      "the partner secret does not fall back to another principal's",
      issuePartnerSession(UUID_A, UUID_B) === null,
      "rotating one session secret must not sign out, or sign in, the other two",
    );
  },
);

/*
 * THE PROXY ORDER, WHICH IS WHERE A FALLBACK WOULD LIVE.
 *
 * Every branch returns, so a partner path can never reach the customer branch
 * and a partner cookie is never offered to the staff reader. The check asserts
 * the partner branch comes first and that no branch reads another principal's
 * cookie.
 */
{
  const proxy = codeOnly("src/proxy.ts");
  /*
   * The CONDITION, not a substring of it.
   *
   * The first version searched for `pathname.startsWith("/partner")` anywhere,
   * and an injection wrapping the branch in `false && (...)` passed: the
   * substring was still there, inside a condition that could never be true.
   */
  const PARTNER_BRANCH = 'if (pathname.startsWith("/partner") || pathname.startsWith("/api/partner")) {';
  const CUSTOMER_BRANCH = 'if (pathname.startsWith("/account") || pathname.startsWith("/api/account")) {';

  const partnerAt = proxy.indexOf(PARTNER_BRANCH);
  const customerAt = proxy.indexOf(CUSTOMER_BRANCH);

  rec("the proxy has a partner branch, written exactly", partnerAt !== -1);
  rec(
    "and it returns before the customer and staff branches",
    partnerAt !== -1 && customerAt !== -1 && partnerAt < customerAt,
    "a branch that falls through is a branch that offers the wrong cookie to the wrong reader",
  );
  rec(
    "and its condition is not disabled",
    !/(false|0)\s*&&\s*\(?\s*pathname\.startsWith\("\/partner"/.test(proxy),
  );

  const partnerBranch = proxy.slice(partnerAt, customerAt);
  rec(
    "the partner branch reads only the partner cookie",
    /readPartnerSession\(request\.cookies\.get\(PARTNER_COOKIE\)/.test(partnerBranch) &&
      !/CUSTOMER_COOKIE|OPS_COOKIE/.test(partnerBranch),
    "no principal's cookie is a fallback for another",
  );
  rec(
    "and its open path list is short",
    /PARTNER_OPEN_PATHS/.test(proxy),
    "a partner dashboard behind an accidentally open path shows one partner's earnings to anybody",
  );
}

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
  /*
   * NAMES THE PRINCIPAL, NOT THE SUBSTRING.
   *
   * This was !/customer/i over the whole module, and Phase 10 Section 2 added a
   * STAFF role called customer_service, which is a person who answers the
   * telephone about the firm's own work. The check failed on a role name while
   * the boundary it guards was untouched.
   *
   * Loosening it to allow "customer_service" specifically would have been the
   * wrong repair: the next role with customer in its name breaks it again. What
   * the rule actually forbids is ops-authz knowing about the CUSTOMER
   * PRINCIPAL, so those are what it looks for.
   */
  const CUSTOMER_PRINCIPAL = [
    "customer-session",
    "customer_session",
    "CustomerClaims",
    "readCustomerSession",
    "eng_customer_users",
    "eng_customer_accounts",
    "CUSTOMER_COOKIE",
  ];
  const leaked = CUSTOMER_PRINCIPAL.filter((needle) => authz.includes(needle));
  rec(
    "ops-authz has no notion of the customer principal",
    leaked.length === 0,
    leaked.length
      ? leaked.join(", ")
      : "the module that grants staff capabilities must not know the type exists",
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
  /*
   * THE SHAPE MOVED AND THIS CHECK NAMES THE NEW ONE EXACTLY.
   *
   * It pinned `archived_at: new Date().toISOString()` and went red when the
   * timestamp sweep landed, which is the harness asking whether that was meant.
   * It was: no recorded moment comes from a process clock any more.
   *
   * Loosening the pattern to pass on both spellings would convert this into a
   * check on nothing, so it names DB_NOW, and it GAINS the check the old one
   * could not make. The old pattern could see that a timestamp was written and
   * could not see WHOSE clock wrote it, which is the whole subject of the rule
   * that broke it.
   */
  rec(
    "and a property is archived rather than deleted",
    /archived_at: DB_NOW/.test(account) && !/\.delete\(\)/.test(account),
    "orders already placed against it must keep their record",
  );
  rec(
    "and the archive stamp is the database's clock, not this process's",
    /archived_at: DB_NOW/.test(account) && !/archived_at: new Date/.test(account),
    "when a customer's property left the account is a record, and a record with two possible answers depending on which host wrote it is not one",
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
  const settingsUi = readSource("src/app/account/settings/SettingsClient.tsx");
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
  const docs = readSource("docs/ordering-api.md");
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
// A SUPERSEDED ACCOUNT IS NOT A CUSTOMER, AND EVERY READ SAYS SO
// =========================================================================
//
// Operator ruling, 2026-09-14: an account is superseded, never removed, and
// every read excludes superseded accounts by default with an explicit opt-in,
// the is_demo shape.
//
// The failure this guards is the one src/lib/reporting-scope.ts already records
// for demonstration records, and it is worth restating because it is identical:
// forgetting is INVISIBLE. A superseded duplicate reappears in a list, a count
// or a total and looks entirely ordinary. Nothing crashes and no figure is
// obviously wrong; there is simply one customer too many.

{
  const accountReaders = [];
  const walkSrc = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walkSrc(p);
      else if (/\.tsx?$/.test(entry.name)) {
        const text = codeOnly(p);
        /*
         * A READ, not a write. An update or an insert names the row it is
         * changing and has no business filtering on supersession; only a
         * SELECT can quietly return one too many.
         */
        const reads = text.match(/from\(\s*["']eng_customer_accounts["']\s*\)[\s\S]{0,400}?\.select\(/g) ?? [];
        if (reads.length > 0) {
          accountReaders.push({ path: p.split("\\").join("/"), text });
        }
      }
    }
  };
  walkSrc("src");

  rec(
    `there are account reads to check (${accountReaders.length})`,
    accountReaders.length >= 4,
    "a sweep over an empty list passes every run",
  );

  /*
   * THE DECLARED EXCEPTIONS, each with a reason, like role-cast-audit's
   * allowlist. A second entry has to argue for itself.
   */
  const MAY_SEE_SUPERSEDED = {
    "src/lib/account-scope.ts":
      "it IS the scope helper, and supersedeAccount reads the row it is about to mark, which is the one read that must see an unsuperseded row and then a superseded one.",
    "src/lib/account-creation.ts":
      "it inserts the account and selects the id back. There is no superseded row to exclude because the row is one statement old.",
    "src/lib/ops-statements.ts":
      "IT RESOLVES A MONEY RECORD RATHER THAN A CUSTOMER, and that is the whole distinction the operator ruling turns on. Closing a period and issuing a statement are about work already done and money already owed. An account superseded after that work was billed must still resolve, or superseding a duplicate would orphan the statements the supersession exists to keep intact. Every read that asks whether somebody may ACT excludes superseded rows; this one asks what an account was charged.",
  };

  const unscoped = accountReaders
    .filter((r) => !MAY_SEE_SUPERSEDED[r.path])
    .filter((r) => !/superseded_at/.test(r.text))
    .map((r) => r.path);

  rec(
    "every read of an account excludes superseded rows",
    unscoped.length === 0,
    unscoped.length
      ? `READS ACCOUNTS AND NEVER MENTIONS superseded_at: ${unscoped.join(", ")}`
      : `${accountReaders.length - Object.keys(MAY_SEE_SUPERSEDED).length} scoped, ${Object.keys(MAY_SEE_SUPERSEDED).length} declared exceptions`,
  );

  /*
   * AND SUPERSEDED IS NOT CLOSED. Asserted on the source because the two are
   * one careless edit from being collapsed, and collapsing them loses the
   * answer to "did this customer leave, or did we open them twice", which is
   * exactly the question somebody asks when two accounts share a name.
   */
  const scopeSource = codeOnly("src/lib/account-scope.ts");
  rec(
    "the scope helper never filters on status",
    !/status/.test(scopeSource.replace(/superseded/g, "")),
    "a closed account is a real customer who stopped trading and still appears in every list",
  );

  /*
   * AND A REASON IS REQUIRED IN THE APPLICATION AS WELL AS THE DATABASE.
   *
   * 0048's check constraint requires ten characters. The application refuses
   * earlier so the operator reads a sentence rather than a constraint
   * violation, which is the same division retention and the floors already use.
   */
  rec(
    "superseding refuses without a reason, before the database does",
    /reason\.length < 10/.test(scopeSource),
    "a soft delete with no reason is a row nobody can interpret",
  );
  rec(
    "and refuses to overwrite a reason that was already given",
    /already superseded/i.test(readSource("src/lib/account-scope.ts")),
    "writing a second reason over the first loses the answer the column exists for",
  );
}

// =========================================================================
// THE THREE DOORS, AND THAT ONLY ONE FUNCTION OPENS ANY OF THEM
// =========================================================================
//
// Phase 13 Section 1. The registry in src/lib/account-doors.ts declares which
// doors exist, and a registry nothing reads is a list that stops being true
// without telling anybody, which is the reason surfaces.mjs and applied.mjs
// both exist.
//
// These are PURE, so this audit stays in phase zero. What they cannot do is
// walk a door, and that is deliberate rather than an omission: the walk needs a
// server, a database and the launch condition patched, and lives in
// scripts/doors-audit.mjs. These assert the properties a walk could not see
// anyway, because a walk exercises the door it was pointed at and says nothing
// about a fourth one somebody adds next week.

/**
 * The directory whose page.tsx renders a given URL path, or null.
 *
 * Walks src/app and strips route groups, which is the one thing a naive join
 * cannot do. Returns the DIRECTORY rather than the file, because the fetch that
 * opens a door lives in a client component beside the page every time.
 */
function screenDirFor(urlPath) {
  let found = null;
  const walk = (dir, url) => {
    if (found) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (found) return;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        /* A segment in parentheses organises files and appears in no URL. */
        const next = /^\(.*\)$/.test(entry.name) ? url : `${url}/${entry.name}`;
        walk(p, next);
      } else if (entry.name === "page.tsx" && url === urlPath) {
        found = dir.split("\\").join("/");
      }
    }
  };
  walk("src/app", "");
  return found;
}

{
  const doorsSource = codeOnly("src/lib/account-doors.ts");
  const creationSource = codeOnly("src/lib/account-creation.ts");

  /*
   * EVERY DECLARED DOOR HAS A ROUTE THAT EXISTS.
   *
   * The registry names one route per door so that "which code can create an
   * account" has an answer a person can read rather than grep for. A named
   * route that is not on disk makes that answer a lie, and it is the exact
   * shape surface-audit catches for pages.
   */
  const declaredRoutes = [...doorsSource.matchAll(/route:\s*"([^"]+)"/g)].map((m) => m[1]);
  rec(
    `the door registry names routes (${declaredRoutes.length})`,
    declaredRoutes.length >= 2,
    "a sweep over an empty list passes every run",
  );

  const missing = declaredRoutes.filter((r) => {
    const path = `src/app${r}/route.ts`;
    return !existsSync(path);
  });
  rec(
    "every declared door names a route that exists on disk",
    missing.length === 0,
    missing.length ? `DECLARED AND ABSENT: ${missing.join(", ")}` : declaredRoutes.join(", "),
  );

  /*
   * AND A PERSON CAN REACH THE DOOR THAT WAS BUILT FOR THEM.
   *
   * ==================================================================
   * THE CHECK THAT WOULD HAVE CAUGHT A ROUTE WITH NO SCREEN.
   * ==================================================================
   *
   * The operator door shipped permission gated, audited and walked end to end,
   * and the only way to reach it was a POST. Every check above was green,
   * because each was asking whether the ROUTE existed. None was asking whether
   * the person the door was built for could open it.
   *
   * So the registry declares a screen per door, null where nobody clicks it,
   * and this asserts two things about each non-null one: the file is on disk,
   * and something in that screen's own directory actually posts to the door's
   * route. The second half is the one that matters. A screen that exists and
   * calls nothing is exactly the state this is written after.
   */
  const withScreens = [...doorsSource.matchAll(/route:\s*"([^"]+)"[\s\S]{0,400}?screen:\s*("([^"]+)"|null)/g)].map(
    (m) => ({ route: m[1], screen: m[3] ?? null }),
  );
  rec(
    `every door declares whether a person can reach it (${withScreens.length})`,
    withScreens.length === declaredRoutes.length,
    `${withScreens.length} declared against ${declaredRoutes.length} routes`,
  );

  const screenFaults = [];
  for (const door of withScreens) {
    if (!door.screen) continue;

    /*
     * A URL PATH IS NOT A DIRECTORY PATH, AND THE FIRST VERSION ASSUMED IT WAS.
     *
     * /portal/accounts lives at src/app/portal/(app)/accounts, because a
     * segment in parentheses is a Next route GROUP: it organises files and
     * appears in no URL. The naive join reported the operator's screen as
     * missing while looking straight at it, which is this repository's own
     * recurring defect wearing a path resolver.
     *
     * So the mapping is DERIVED by walking for page files and stripping the
     * groups, rather than stated. Same reason routesOf walks directories
     * instead of carrying a list: a list is the memory problem one level down.
     */
    const dir = screenDirFor(door.screen);
    if (!dir) {
      screenFaults.push(`${door.screen} is declared and no page renders it`);
      continue;
    }

    /*
     * SOMETHING IN THAT DIRECTORY POSTS TO THE ROUTE. Read across the whole
     * directory rather than the page alone, because the fetch lives in a client
     * component beside it every time, and a check that only read page.tsx would
     * have gone red on a screen that works.
     */
    let reaches = false;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue;
      if (codeOnly(join(dir, entry.name)).includes(`"${door.route}"`)) {
        reaches = true;
        break;
      }
    }
    if (!reaches) {
      screenFaults.push(`${door.screen} exists and nothing on it posts to ${door.route}`);
    }
  }

  rec(
    "and every door with a screen has a control on it that opens the door",
    screenFaults.length === 0,
    screenFaults.length
      ? screenFaults.join(" | ")
      : withScreens.filter((d) => d.screen).map((d) => d.screen).join(", "),
  );

  /*
   * AND THE ONE WITH NO SCREEN HAS NO SCREEN, asserted rather than left to fall
   * out of the loop above. A button that opened an account for somebody who had
   * not paid would be a different door wearing the checkout door's name, and it
   * would pass every check here by simply gaining a screen.
   */
  const checkoutDoor = withScreens.find((d) => d.route === "/api/stripe/webhook");
  rec(
    "and the door a payment opens has no screen, because nobody clicks it",
    checkoutDoor?.screen === null,
    checkoutDoor ? `screen: ${checkoutDoor.screen}` : "the checkout door was not found",
  );

  /*
   * AND ONLY ONE FUNCTION INSERTS AN ACCOUNT HOLDER.
   *
   * This is the property the whole registry rests on. Three doors producing one
   * record with an origin recorded is a claim about convergence, and it is true
   * only while there is one insert. A second one would not fail any check
   * above: it would simply write rows with no origin, or with an origin nobody
   * declared, and the registry would go on describing a platform that had
   * changed underneath it.
   *
   * Scanned across src/ rather than asserted about the file that is supposed to
   * hold it, because the failure is a NEW insert somewhere else and a check
   * that only reads account-creation.ts cannot see one.
   */
  const inserters = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) {
        const text = codeOnly(p);
        if (/from\(\s*["']eng_customer_users["']\s*\)[\s\S]{0,80}?\.insert\(/.test(text)) {
          inserters.push(p.split("\\").join("/"));
        }
      }
    }
  };
  walk("src");

  rec(
    "exactly one function in src inserts an account holder",
    inserters.length === 1 && inserters[0] === "src/lib/account-creation.ts",
    inserters.length === 0
      ? "NONE found, so this check is measuring nothing and the pattern has drifted"
      : inserters.join(", "),
  );

  /*
   * AND IT REFUSES AN ORIGIN NOBODY DECLARED.
   *
   * doorFor throws rather than returning undefined, which is what makes the
   * union and the registry unable to drift apart silently. Asserted on the
   * source because the behaviour is a throw and a test that triggered it would
   * be testing that throw rather than that the call site reaches it.
   */
  rec(
    "the creation function asks the registry which door it is using",
    /doorFor\(/.test(creationSource),
    "without it an origin could be written that no door declares",
  );
  rec(
    "and the registry throws on an origin it does not know",
    /throw new Error\(/.test(doorsSource),
    "returning undefined would let a row be written under a door nobody declared",
  );

  /*
   * THE DATABASE AGREES WITH THE REGISTRY ABOUT WHICH ORIGINS EXIST.
   *
   * 0043 carries a check constraint listing the three. Two lists of one fact,
   * which is normally the defect; here it is the mechanism, because the
   * constraint is what holds when somebody writes a row outside this codebase,
   * and the audit is what notices the two have parted. Adding a door therefore
   * costs a migration AND a registry entry, made on purpose.
   */
  const migration = readSource("supabase/migrations/0043_an_account_says_which_door_it_came_through.sql");
  const declaredOrigins = [...doorsSource.matchAll(/origin:\s*"([a-z_]+)"/g)].map((m) => m[1]);
  const unique = [...new Set(declaredOrigins)].sort();
  const notInMigration = unique.filter((o) => !migration.includes(`'${o}'`));
  rec(
    `every declared origin is one the database allows (${unique.length})`,
    unique.length >= 2 && notInMigration.length === 0,
    notInMigration.length
      ? `DECLARED AND REFUSED BY 0043: ${notInMigration.join(", ")}`
      : unique.join(", "),
  );

  /*
   * THE TWO RULINGS, PINNED AS LITERALS.
   *
   * Written out here rather than imported, per the standing rule: an audit that
   * reads its expected value from the module under test compares a value to
   * itself. The duplication IS the mechanism, and if you are here because this
   * just went red, the audit is asking whether you meant it.
   */
  rec(
    "the sign up ceiling is still five attempts an hour",
    /SIGN_UP_ATTEMPTS_PER_HOUR = 5;/.test(doorsSource),
    "it is what stops an address list being walked to learn who holds an account here",
  );
  rec(
    "a verification link still lasts 72 hours",
    /VERIFICATION_TTL_HOURS = 72;/.test(doorsSource),
  );
  rec(
    "and the words beside it still say three days",
    /VERIFICATION_TTL_WORDS = "3 days";/.test(doorsSource),
    "the number and the sentence are one constant apart, and the email renders the sentence",
  );
  rec(
    "and the token issuer derives its life from that one constant",
    /VERIFICATION_TTL_HOURS/.test(codeOnly("src/lib/customer-auth.ts")),
    "a second number here is how an email starts stating a rule the code does not implement",
  );

  /*
   * THE LAUNCH CONDITION IS ENFORCED BY THE ROUTE, NOT ONLY BY THE SCREEN.
   *
   * The eighth launch condition says self service sign up does not reach
   * production until the operator lifts it. A screen that hides a form is a
   * screen. This asserts the ROUTE reads the same answer, because that is what
   * somebody who reads HTML and posts directly has to get past.
   */
  const signUpRoute = codeOnly("src/app/api/account/sign-up/route.ts");
  rec(
    "the sign up route refuses while the launch condition is unmet",
    /selfServiceSignUpOpen\(\)/.test(signUpRoute),
    "a launch condition nothing consults is a note",
  );
  rec(
    "and the screen reads the same answer rather than its own",
    /selfServiceSignUpOpen\(\)/.test(codeOnly("src/app/account/sign-up/page.tsx")),
    "two answers to one question are two answers that will disagree",
  );

  /*
   * AND THE SELF SERVICE DOOR NEVER TAKES A PASSWORD.
   *
   * A password typed at sign up would have to be held somewhere between the
   * form and the address being proven, and both honest places to hold it mean
   * this platform stores a credential for an address nobody has shown they can
   * open. The link is where a password is chosen.
   */
  rec(
    "the sign up route reads no password from the request",
    !/body\?\.password/.test(signUpRoute),
    "a password accepted before the address is proven is a credential for an address nobody owns",
  );
  rec(
    "and the form has no password field",
    !/type="password"/.test(codeOnly("src/app/account/sign-up/SignUpForm.tsx")),
  );

  /*
   * THE OPERATOR DOOR NEVER PUTS THE TOKEN ON A STAFF SCREEN.
   *
   * It would be convenient and it makes every future screenshot, support ticket
   * and shoulder a way into a customer's account. The mail is the channel
   * because it goes to the address being claimed, which is the mechanism rather
   * than a preference.
   */
  const operatorRoute = codeOnly("src/app/api/portal/accounts/create/route.ts");
  rec(
    "the operator door does not return the set password token",
    !/token:\s*created\.link\.token/.test(operatorRoute) && !/link\.token\s*\}/.test(operatorRoute.split("NextResponse.json({\n    ok: true")[1] ?? ""),
    "a credential on a staff screen is a credential in every screenshot of it",
  );
  rec(
    "and it is permission gated rather than merely signed in",
    /can\(actor, "accounts\.manage"\)/.test(operatorRoute),
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
