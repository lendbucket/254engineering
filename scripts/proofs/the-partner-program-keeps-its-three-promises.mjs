/**
 * THE PARTNER PROGRAM KEEPS ITS THREE PROMISES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-partner-program-keeps-its-three-promises.mjs
 *
 * Run item 22 of 2026-10-10:
 *
 *   1. NO EARNINGS CLAIMS. Every pattern in EARNINGS_CLAIMS refuses a sentence
 *      it exists to refuse (a set is proved by exercising its members, never by
 *      its length), copyVerdict refuses each with its own summary, a statement
 *      of record is not a claim, and no partner surface's source makes one.
 *   2. EVERY PARTNER PAGE NAMES 254 AS THE ENGINEERING FIRM. Every page under
 *      the partner app and the partner order page, found by walking the disk,
 *      renders performingFirmLine() itself or through a layout above it, and
 *      that line names the registrant (a pinned literal).
 *   3. A LAPSE REMOVES ACCESS AND TOUCHES NOTHING ELSE. setPartnerStatus writes
 *      one table; on development a probe partner is found by its code while
 *      active and not once suspended, which is what closes its order page; the
 *      partner session refuses a partner that is not active.
 *
 * Probes: one @audit-probe.invalid administrator and one partner row with no
 * touches, both removed at the end.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { EARNINGS_CLAIMS, findClaims } = await import("../lib/regulatory.mjs");
const { copyVerdict, performingFirmLine } = await import("../../src/lib/partner-copy.ts");

/* ---- 1. No earnings claims ---------------------------------------------- */
console.log("1. No earnings claims");
const EXAMPLES = [
  "Partners earn up to $2,000 a month.",
  "Our average partner makes more than the fee back.",
  "Build a passive income from referrals.",
  "A six-figure side business.",
  "Real income potential for roofers.",
  "Guaranteed commission on every job.",
  "The program pays for itself in a month.",
];
check("every pattern has an example and every example has a pattern", EXAMPLES.length === EARNINGS_CLAIMS.length, `${EXAMPLES.length} examples, ${EARNINGS_CLAIMS.length} patterns`);
EARNINGS_CLAIMS.forEach((p, i) => {
  const hit = p.pattern.test(EXAMPLES[i] ?? "");
  check(`pattern ${i + 1} refuses its example: "${EXAMPLES[i]}"`, hit, p.why);
});
for (const sentence of EXAMPLES) {
  const v = copyVerdict(sentence);
  if (v.ok || !/promises what a partner will make/.test(v.summary)) {
    check(`copyVerdict refuses "${sentence}" as an earnings claim`, false, v.summary.slice(0, 80));
  }
}
check("copyVerdict refuses every example as an earnings claim, with its own summary", EXAMPLES.every((s) => /promises what a partner will make/.test(copyVerdict(s).summary)));
check("a statement of record is not a claim", findClaims("You earned $120 in September, paid on October 15.", EARNINGS_CLAIMS).length === 0);

const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(full.split("\\").join("/"));
  }
  return out;
};
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const partnerSource = [
  ...walk("src/app/partner"),
  ...walk("src/components/partner"),
  ...walk("src/app/(order)/order/referred"),
  "src/lib/partner-copy.ts",
];
check("the sweep had partner source to read", partnerSource.length > 10, `${partnerSource.length} files`);
const claimHits = partnerSource.flatMap((f) =>
  findClaims(stripComments(readFileSync(f, "utf8")), EARNINGS_CLAIMS).map((h) => `${f}: "${h.match}"`),
);
check("no partner surface's source makes an earnings claim", claimHits.length === 0, claimHits.join("; "));

/* ---- 2. Every partner page names the firm --------------------------------- */
console.log("2. Every partner page names 254 as the engineering firm");
const line = performingFirmLine();
check("the performing firm line names the registrant", line.startsWith("254 Engineering LLC is the firm of record"), line.slice(0, 60));

const pages = [...walk("src/app/partner"), ...walk("src/app/(order)/order/referred")].filter((f) => f.endsWith("/page.tsx"));
const callsLine = (f) => stripComments(readFileSync(f, "utf8")).includes("performingFirmLine()");
const coveredBy = (page) => {
  let dir = page.slice(0, page.lastIndexOf("/"));
  if (callsLine(page)) return page;
  while (dir.startsWith("src/app/partner") || dir.startsWith("src/app/(order)/order/referred")) {
    try {
      const layout = `${dir}/layout.tsx`;
      if (statSync(layout) && callsLine(layout)) return layout;
    } catch {
      /* no layout at this level */
    }
    dir = dir.slice(0, dir.lastIndexOf("/"));
  }
  return null;
};
check("the walk found the partner pages", pages.length >= 8, `${pages.length} pages`);
const uncovered = pages.filter((p) => !coveredBy(p));
check("every one renders the performing firm line, itself or through a layout", uncovered.length === 0, uncovered.join(", "));

/* ---- 3. A lapse removes access and touches nothing else ------------------ */
console.log("3. A lapse removes access and touches nothing else");
const admin = readFileSync("src/lib/ops-partners-admin.ts", "utf8");
const at = admin.indexOf("export async function setPartnerStatus(");
const body = admin.slice(at, admin.indexOf("\nexport ", at + 1));
const tables = [...new Set([...body.matchAll(/\.from\("([a-z_]+)"\)/g)].map((m) => m[1]))];
check("a status change reads and writes one table, the partner's own row", tables.length === 1 && tables[0] === "eng_partners", tables.join(", "));
check("and never an order, a file, a payment or a document", !/eng_service_orders|eng_files|eng_order_payments|eng_sealed|eng_documents/.test(body));
const auth = readFileSync("src/lib/partner-auth.ts", "utf8");
check("a partner who is not active cannot hold a session", auth.includes('principal.partner.status !== "active"'));

const { auditClient } = await import("../lib/db-target.mjs");
const db = auditClient("the partner program proof", { neverProduction: true });
if (!db) {
  console.log("  COULD NOT TELL: no development database client, so the live lapse was not run.");
} else {
  const { partnerByCode } = await import("../../src/lib/ops-partners.ts");
  const { setPartnerStatus } = await import("../../src/lib/ops-partners-admin.ts");
  const { destroyProbes } = await import("../lib/portal-probe.mjs");
  const LABEL = "partner-lapse-proof";
  const code = `lapse-${Date.now().toString(36)}`;
  let partnerId = null;
  try {
    const email = `${LABEL}-${Date.now()}@audit-probe.invalid`;
    const { data: u, error: uErr } = await db.auth.admin.createUser({ email, password: `p-${randomUUID()}`, email_confirm: true });
    if (uErr || !u?.user) throw new Error(`createUser: ${uErr?.message}`);
    const { error: pErr } = await db.from("eng_profiles").insert({
      id: u.user.id, email, display_name: "Partner lapse proof admin, not a real person", role: "admin", status: "active", is_demo: true,
    });
    if (pErr) throw new Error(`profile: ${pErr.message}`);
    const actor = { id: u.user.id, email, role: "admin", status: "active", grants: new Set(["partners.manage"]) };

    const { data: p, error: insErr } = await db
      .from("eng_partners")
      .insert({ organisation: "Partner lapse proof, not a real business", contact_name: "Nobody", contact_email: `partner-${email}`, code })
      .select("id")
      .single();
    if (insErr || !p) throw new Error(`partner: ${insErr?.message}`);
    partnerId = p.id;

    check("an active partner is found by its code, so its order page opens", (await partnerByCode(code))?.id === partnerId);
    const lapsed = await setPartnerStatus(actor, partnerId, "suspended", "The partner lapse proof suspends its own probe.");
    check("the suspension is accepted", lapsed.ok, lapsed.ok ? "" : lapsed.error);
    check("a suspended partner is not found by its code, so its order page is a 404", (await partnerByCode(code)) === null);
  } catch (err) {
    wrong += 1;
    console.log(`  FAIL: the live lapse could not run (${err instanceof Error ? err.message : String(err)})`);
  } finally {
    if (partnerId) {
      const { error } = await db.from("eng_partners").delete().eq("id", partnerId);
      if (error) console.log(`  note: the probe partner was not removed: ${error.message}`);
    }
    const swept = await destroyProbes(LABEL);
    if (!swept.ok) console.log(`  note: probe teardown: ${JSON.stringify(swept)}`);
  }
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the partner program keeps its three promises.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
