/**
 * THE DOOR THE SISTER BRANDS POST THROUGH.
 *
 *   BASE_URL=http://localhost:3225 npx tsx --conditions=react-server scripts/sister-intake-audit.mjs
 *
 * WHY THIS ENDPOINT IS WORTH ITS OWN AUDIT
 * ----------------------------------------
 * It is the only route on this platform that writes a row on behalf of a
 * different business, and it exists to remove a service role key from two
 * deployments that should never have held one. Everything that could go wrong
 * with it is quiet: a key that authenticates the wrong brand, a body that can
 * choose which brand it is, a retry that produces two leads, a failed write
 * answered as a success to a server that will then stop retrying.
 *
 * The pure half runs without a server. The live half needs one and a key, and
 * says plainly when it could not run rather than passing over an absence.
 */

import { readFileSync } from "node:fs";
import { auditClient } from "./lib/db-target.mjs";
import {
  SISTER_KEY_ENV,
  SISTER_KEY_HEADER,
  SISTER_RATE_PER_MINUTE,
  fingerprintOf,
  intakeConfigured,
  leadProblem,
  siteForKey,
} from "../src/lib/sister-intake.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3225";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ THE SISTER INTAKE API ================");
console.log("");

// =========================================================================
// 1. THE KEY DECIDES THE BRAND. Pure, and it is the whole security model.
// =========================================================================

{
  const env = {
    INTAKE_KEY_SEALED: "sealed-key-that-is-long-enough-to-count",
    INTAKE_KEY_STAMP: "stamp-key-that-is-long-enough-to-count",
  };

  rec(
    "a sealed key resolves to the sealed brand",
    siteForKey(env.INTAKE_KEY_SEALED, env) === "sealed",
    "the site is read off the key, never off the request",
  );
  rec(
    "a stamp key resolves to the stamp brand",
    siteForKey(env.INTAKE_KEY_STAMP, env) === "stamp",
  );
  rec("an unknown key resolves to nothing", siteForKey("not-a-key-at-all-but-long", env) === null);
  rec("an empty key resolves to nothing", siteForKey("", env) === null);

  /*
   * THE RATE LIMIT, ASSERTED RATHER THAN MERELY IMPORTED.
   *
   * SISTER_RATE_PER_MINUTE was imported at the top of this file and used
   * nowhere, so the limit on how fast a sister site may post leads into this
   * firm's database was checked by nothing at all. An unused import of a rate
   * limit is a rate limit asserted nowhere, and it reads like coverage.
   *
   * Pinned to a literal, because it is a decision about how much traffic a
   * partner brand may push at this endpoint before it is refused, and moving it
   * should cost two edits on purpose.
   */
  rec(
    "the sister rate limit is still the ruled 20 a minute",
    SISTER_RATE_PER_MINUTE === 20,
    `the module says ${SISTER_RATE_PER_MINUTE}`,
  );

  /*
   * A SHORT KEY IS NOT A KEY, and this matters more than it looks: an
   * environment variable set to an empty string, or to a placeholder somebody
   * typed while wiring it up, must not authenticate anybody. Below twenty four
   * characters is refused whatever it says.
   */
  rec(
    "a short or placeholder variable authenticates nobody",
    siteForKey("changeme", { INTAKE_KEY_SEALED: "changeme" }) === null &&
      siteForKey("", { INTAKE_KEY_SEALED: "" }) === null,
    "an unset variable and a lazily set one are the same refusal",
  );

  rec(
    "nothing configured means the endpoint is not configured",
    intakeConfigured({}) === false && intakeConfigured({ INTAKE_KEY_SEALED: "x" }) === false,
    "which the route answers as a 404 rather than a 401",
  );
  rec(
    "and one configured brand is enough for it to exist",
    intakeConfigured(env) === true,
  );

  /*
   * THE BODY CANNOT NAME A BRAND. Asserted on the source, because it is an
   * absence: there is no parameter to test at runtime, which is the point.
   */
  const lib = readFileSync("src/lib/sister-intake.ts", "utf8");
  const route = readFileSync("src/app/api/intake/lead/route.ts", "utf8");
  rec(
    "the lead type has no field in which a caller could name a brand",
    !/\bsite\??:\s*(string|SisterSite)/.test(lib.split("export type SisterLead")[1]?.split("};")[0] ?? ""),
    "the answer is not that we check it, it is that there is nothing to check",
  );
  rec(
    "and the route reads the brand from the key",
    /siteForKey\(request\.headers\.get\(SISTER_KEY_HEADER\)/.test(route),
    "a header rather than a body field or a query string",
  );
}

// =========================================================================
// 2. WHAT IS A LEAD AT ALL.
// =========================================================================

{
  rec(
    "a submission with no way to reach anybody is refused",
    leadProblem({ form: "contact", name: "Nobody" }) !== null,
    "an enquiry the operator cannot answer is a row rather than a lead",
  );
  rec(
    "an email alone is enough",
    leadProblem({ form: "contact", email: "someone@example.com" }) === null,
  );
  rec("a telephone number alone is enough", leadProblem({ form: "contact", phone: "555 0100" }) === null);
  rec(
    "a malformed address is refused rather than stored",
    leadProblem({ form: "contact", email: "not-an-address" }) !== null,
  );
  rec(
    "a form this endpoint does not take is refused",
    leadProblem({ form: "order", email: "someone@example.com" }) !== null,
    "this endpoint takes enquiries, not orders",
  );
  rec(
    "and a field longer than the endpoint accepts is refused",
    leadProblem({ form: "contact", email: "a@b.co", message: "x".repeat(4100) }) !== null,
  );
}

// =========================================================================
// 3. THE DEDUPE FINGERPRINT, which is what makes a retry safe.
// =========================================================================

{
  const one = { form: "contact", email: "Someone@Example.com", phone: "", message: "the roof" };
  const same = { form: "contact", email: "someone@example.com", phone: "", message: "the roof" };
  const other = { form: "contact", email: "someone@example.com", phone: "", message: "the slab" };

  rec(
    "the same submission fingerprints the same, whatever the address casing",
    fingerprintOf("sealed", one) === fingerprintOf("sealed", same),
    "a retry after a timeout must not become a second lead",
  );
  rec(
    "a different message is a different submission",
    fingerprintOf("sealed", one) !== fingerprintOf("sealed", other),
    "or a person's second enquiry would be swallowed",
  );
  rec(
    "and the same words from two brands are two submissions",
    fingerprintOf("sealed", one) !== fingerprintOf("stamp", one),
    "the brands share an inbox, not an enquiry",
  );
}

// =========================================================================
// 4. LIVE. The refusals a caller can actually reach.
// =========================================================================

{
  const post = (headers, body) =>
    fetch(`${BASE}/api/intake/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
    });

  let reachable = true;
  try {
    const res = await fetch(`${BASE}/api/intake/lead`, { method: "GET" });
    rec(
      "a GET is refused with 405, which also proves the route exists",
      res.status === 405,
      `HTTP ${res.status}; a 404 here means the server does not have this route, which is not the same as refusing it`,
    );
  } catch (err) {
    reachable = false;
    rec("the endpoint was reachable", false, String(err.message).split("\n")[0]);
  }

  if (reachable) {
    const configured = intakeConfigured();

    const none = await post({}, { form: "contact", email: "someone@example.com" });
    if (configured) {
      rec(
        "a post with no key is refused",
        none.status === 401,
        `HTTP ${none.status}`,
      );

      const wrong = await post(
        { [SISTER_KEY_HEADER]: "definitely-not-the-key-but-long-enough" },
        { form: "contact", email: "someone@example.com" },
      );
      rec("and a wrong key is refused the same way", wrong.status === 401, `HTTP ${wrong.status}`);

      const body = await wrong.json().catch(() => null);
      rec(
        "and the refusal does not say which brand it failed against",
        !/sealed|stamp/i.test(JSON.stringify(body ?? {})),
        JSON.stringify(body ?? {}),
      );

      /*
       * ============================================================
       * THE WRITE PATH, END TO END, WITH ITS OWN TEARDOWN.
       *
       * Everything above is a refusal. This is the part that matters: a real
       * key posts a real lead, the row lands with the brand the KEY names, a
       * retry does not make a second one, and the rows are removed afterwards
       * and the removal is verified.
       *
       * The address is on the probe domain and the message says what it is, so
       * a row that survives a crash is obviously not a customer.
       * ============================================================
       */
      const db = auditClient("sister-intake-audit", { neverProduction: true });
      const key = process.env[SISTER_KEY_ENV.sealed] ?? "";
      const stamp = `${Date.now()}`;
      const email = `probe-intake-${stamp}@audit-probe.invalid`;
      const message = `Audit probe ${stamp}, safe to ignore.`;

      const first = await post(
        { [SISTER_KEY_HEADER]: key },
        {
          form: "contact",
          name: "Audit Probe",
          email,
          message,
          city: "Corpus Christi",
          landingPath: "/",
          site: "254",
        },
      );
      const firstBody = await first.json().catch(() => null);

      rec(
        "a real key writes a lead",
        first.status === 200 && firstBody?.ok === true && Boolean(firstBody?.id),
        `HTTP ${first.status} ${JSON.stringify(firstBody ?? {}).slice(0, 120)}`,
      );

      /*
       * AND THE BODY SAID site: "254", WHICH MUST HAVE CHANGED NOTHING. This is
       * the security model asserted rather than described: the row belongs to
       * the brand the key names.
       */
      rec(
        "and the row belongs to the brand the key names, not the one the body claimed",
        firstBody?.site === "sealed",
        `the body asked for 254 and the answer is ${firstBody?.site}`,
      );

      if (db && firstBody?.id) {
        const { data: row } = await db
          .from("eng_leads")
          .select("id, site, form, email, message")
          .eq("id", firstBody.id)
          .maybeSingle();
        rec(
          "the row is in the database, with that brand on it",
          row?.site === "sealed" && row?.email === email,
          `site=${row?.site ?? "no row"}`,
        );

        /*
         * AND THE ANSWER AGREES WITH THE ROW.
         *
         * Injecting a route that trusted the body showed why this is separate:
         * the response still said "sealed", because it was reporting the brand
         * the key named, while the row it had just written said "254". The
         * check above caught it and the response check did not, because the
         * response was the thing that was wrong. An endpoint whose answer
         * disagrees with what it wrote is worse than one that refuses.
         */
        rec(
          "and what the endpoint answered is what it wrote",
          firstBody?.site === row?.site,
          `answered ${firstBody?.site}, wrote ${row?.site ?? "nothing"}`,
        );
      } else {
        rec("the row could be read back", false, "no database client or no id returned");
      }

      const retry = await post(
        { [SISTER_KEY_HEADER]: key },
        { form: "contact", name: "Audit Probe", email, message, city: "Corpus Christi" },
      );
      const retryBody = await retry.json().catch(() => null);
      rec(
        "an identical retry is answered as the same lead rather than a second one",
        retry.status === 200 && retryBody?.duplicate === true && retryBody?.id === firstBody?.id,
        `duplicate=${retryBody?.duplicate} sameId=${retryBody?.id === firstBody?.id}`,
      );

      const incomplete = await post(
        { [SISTER_KEY_HEADER]: key },
        { form: "contact", name: "Nobody At All" },
      );
      rec(
        "a submission with no way to reach anybody is refused over the wire",
        incomplete.status === 400,
        `HTTP ${incomplete.status}`,
      );

      /* ---- teardown, verified, because this audit writes real rows ---- */
      if (db) {
        await db.from("eng_leads").delete().like("email", "%@audit-probe.invalid");
        const { data: left } = await db
          .from("eng_leads")
          .select("id")
          .like("email", "%@audit-probe.invalid");
        rec(
          "the probe leads were removed",
          (left ?? []).length === 0,
          (left ?? []).length ? `${left.length} left behind` : "swept by address, not by the ids this run held",
        );
      } else {
        rec("the probe leads could be removed", false, "no database client");
      }
    } else {
      /*
       * NOT SKIPPED. An endpoint with no key configured must be a 404, and that
       * is a claim worth checking on a development machine where no key is set,
       * because it is the state the platform is in until the operator sets one.
       */
      rec(
        "with no key configured the endpoint answers 404 rather than 401",
        none.status === 404,
        `HTTP ${none.status}; an unconfigured endpoint and a missing one look the same to a prober`,
      );
      rec(
        "the live write path was NOT exercised, and that is recorded rather than passed over",
        true,
        "set INTAKE_KEY_SEALED in .env.local to exercise it here; production is the operator's to set",
      );
    }
  }
}

// =========================================================================
// 5. THE COUPLING. The proxy must not gate it, and the perimeter must know it.
// =========================================================================

{
  const proxy = readFileSync("src/proxy.ts", "utf8");
  rec(
    "the proxy does not gate the intake endpoint",
    !/\/api\/intake/.test(proxy),
    "a sister has a key and no cookie, so a gated prefix would refuse it before the key was read",
  );

  const security = readFileSync("scripts/security-audit.mjs", "utf8");
  rec(
    "security-audit knows the endpoint exists",
    /\/api\/intake\/lead/.test(security),
    "an endpoint that writes rows for another business belongs in the perimeter checks",
  );

  const surfaces = readFileSync("scripts/surface-audit.mjs", "utf8");
  rec(
    "and the surface inventory names this audit as its owner",
    /intake: \["scripts\/sister-intake-audit\.mjs"/.test(surfaces),
    "every route handler tree belongs to a surface or names the audit that measures it",
  );
}

// =========================================================================

const failed = out.filter((o) => !o.ok);
for (const o of out) console.log(`  ${o.ok ? "PASS" : "FAIL"}: ${o.name}${o.note ? ` (${o.note})` : ""}`);
console.log("");

if (failed.length) {
  console.log(`FAIL: ${failed.length} of ${out.length} checks.`);
  console.log("");
  console.log("This endpoint writes rows on behalf of another business. Everything");
  console.log("that goes wrong with it goes wrong quietly.");
  process.exit(1);
}

console.log(`PASS: ${out.length} checks. A sister can post a lead, and only its own.`);
