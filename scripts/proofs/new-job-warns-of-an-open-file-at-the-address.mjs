// @runtime react-server
//
// Declared because it imports src/lib/ops-job-intake.ts, which carries server-only.

/**
 * NEW JOB WARNS, BEFORE THE JOB IS TAKEN, WHEN A FILE IS ALREADY OPEN AT THE
 * ADDRESS, WITH A LINK TO IT. Robert, 2026-11-14: the after walk left
 * 254-DEMO-0023 and 0024 open at 1 Killeen Walk Lane and nothing said so.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/new-job-warns-of-an-open-file-at-the-address.mjs
 *
 * Replayed to the end of the chain, the real openFilesAtAddress asked through
 * the replay REST server, so the columns it reads are proved to exist:
 *   1. an open file at the same address is found, under another spelling;
 *   2. a cancelled, delivered, closed or refused one is not;
 *   3. a neighbour's number and the same street in another city are not;
 *   4. a role that does not take jobs is refused, not answered "none";
 *   5. by source: the route gates it on files.create, and the screen says it
 *      below the address and again beside Take the job, each with a link.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

const { readSource } = await import("../lib/read-source.mjs");
const { SUPABASE_REPLAY_STUBS } = await import("../lib/replay-stubs.mjs");
const { PORTS } = await import("../lib/ports.mjs");
const { startReplayRest } = await import("../lib/replay-rest.mjs");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const db = new PGlite();
await db.exec(SUPABASE_REPLAY_STUBS);
const DIR = "supabase/migrations";
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort()) await db.exec(readSource(join(DIR, f)));

const REP = "00000000-0000-4000-8000-00000000a301";
const TECH = "00000000-0000-4000-8000-00000000a302";
const CLIENT = "00000000-0000-4000-8000-00000000b301";
const id = (n) => `00000000-0000-4000-8000-00000000c3${String(n).padStart(2, "0")}`;
const rows = [
  [1, "254-PROOF-AD-1", "1 Killeen Walk Lane", "Killeen", "intake"],
  [2, "254-PROOF-AD-2", "1 Killeen Walk Lane", "Killeen", "cancelled"],
  [3, "254-PROOF-AD-3", "1 Killeen Walk Lane", "Killeen", "delivered"],
  [4, "254-PROOF-AD-4", "1 Killeen Walk Lane", "Killeen", "closed"],
  [5, "254-PROOF-AD-5", "1 Killeen Walk Lane", "Killeen", "refused"],
  [6, "254-PROOF-AD-6", "11 Killeen Walk Lane", "Killeen", "intake"],
  [7, "254-PROOF-AD-7", "1 Killeen Walk Lane", "Temple", "needs_dispatch"],
  [8, "254-PROOF-AD-8", "1 Killeen Walk Ln", null, "sealed"],
];
/*
 * Sealed and delivered need a sealed letter (0110), which this proof is not
 * about: the fixture goes in with triggers off, in this thrown-away replay only,
 * and they are on again before anything is asked.
 */
await db.exec(`
  set session_replication_role = replica;
  insert into auth.users (id) values ('${REP}'), ('${TECH}');
  insert into eng_profiles (id, email, display_name, role, status) values
    ('${REP}', 'address-rep@audit-probe.invalid', 'Address proof rep, not a real person', 'rep', 'active'),
    ('${TECH}', 'address-tech@audit-probe.invalid', 'Address proof technician, not a real person', 'field_tech', 'active');
  insert into eng_clients (id, kind, name, email) values ('${CLIENT}', 'individual', 'Address proof client, not a real person', 'address-client@audit-probe.invalid');
  insert into eng_files (id, file_number, client_id, service_slug, deliverable, property_address, city, county, status)
    values ${rows.map(([n, num, a, c, s]) => `('${id(n)}', '${num}', '${CLIENT}', 'roof-inspections', 'standard', '${a}', ${c ? `'${c}'` : "null"}, 'Bell', '${s}')`).join(",\n    ")};
  set session_replication_role = origin;
`);
const statuses = (await db.query(`select status from eng_files where file_number like '254-PROOF-AD-%' order by file_number`)).rows.map((r) => r.status);
check("the premise: all eight fixture files are in, with the statuses written", statuses.join(",") === rows.map((r) => r[4]).join(","), statuses.join(","));

const rest = await startReplayRest(db, PORTS.replayRest);
process.env.SUPABASE_URL = rest.url;
process.env.SUPABASE_SERVICE_ROLE_KEY = "replay-stand-in";
delete process.env.VERCEL_ENV;
try {
  const { actionsFor } = await import("../../src/lib/ops-authz.ts");
  const intake = await import("../../src/lib/ops-job-intake.ts");
  const actor = (uid, role) => ({ id: uid, role, status: "active", email: `${role}@audit-probe.invalid`, grants: new Set(actionsFor(role)) });
  const rep = actor(REP, "rep");
  const tech = actor(TECH, "field_tech");

  const found = await intake.openFilesAtAddress(rep, "1 killeen walk ln.", "Killeen");
  const numbers = found.ok ? found.files.map((f) => f.fileNumber).sort() : [];
  check("the read answers", found.ok, found.ok ? "" : found.error);
  check("an open file at the address is found, under another spelling", numbers.includes("254-PROOF-AD-1"), numbers.join(", "));
  check("a sealed file with no city is still open and still found", numbers.includes("254-PROOF-AD-8"));
  check(
    "a cancelled, delivered, closed or refused file is not",
    !["254-PROOF-AD-2", "254-PROOF-AD-3", "254-PROOF-AD-4", "254-PROOF-AD-5"].some((n) => numbers.includes(n)),
  );
  check("a neighbour's number is not", !numbers.includes("254-PROOF-AD-6"));
  check("nor the same street in another city", !numbers.includes("254-PROOF-AD-7"));
  check("exactly the two open here", numbers.length === 2, numbers.join(", "));
  const link = found.ok ? found.files.find((f) => f.fileNumber === "254-PROOF-AD-1") : null;
  check("each carries the file's id for its link", link?.id === id(1));

  const elsewhere = await intake.openFilesAtAddress(rep, "9 Nowhere Road", "Killeen");
  check("an address with nothing open answers none", elsewhere.ok && elsewhere.files.length === 0);

  const refused = await intake.openFilesAtAddress(tech, "1 Killeen Walk Lane", "Killeen");
  check("a role that does not take jobs is refused, not answered none", !refused.ok);
} finally {
  await rest.close?.();
}

/* By source: the route's gate, and the screen saying it twice with links. */
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const route = code("src/app/api/portal/files/route.ts");
const action = route.slice(route.indexOf('if (action === "open_files_at_address")'));
check(
  "the route asks files.create and reads through openFilesAtAddress",
  /if \(!can\(actor, "files\.create"\)\)/.test(action.slice(0, 300)) && /await openFilesAtAddress\(actor,/.test(action.slice(0, 600)),
);
const screen = code("src/app/portal/(app)/intake/IntakeClient.tsx");
check("the screen asks while the address is typed", /action: "open_files_at_address", propertyAddress, city/.test(screen));
check("each open file is a link to it", /href=\{`\/portal\/files\?id=\$\{f\.id\}`\}/.test(screen.slice(screen.indexOf("const openHereNote"))));
const belowAddress = screen.indexOf("{openHereNote}\n");
const besideTake = screen.indexOf('{openHereNote ? <div className="mb-3">{openHereNote}</div> : null}');
check(
  "it is said below the address and again beside Take the job",
  belowAddress > screen.indexOf('id="city"') &&
    besideTake > belowAddress &&
    besideTake < screen.indexOf('"Take the job"'),
);
check("a failed read is said, not shown as none", /could not be read: \{openHere\.error\}/.test(screen));
/* The screenshot walk of 2026-11-14 read "2 files are already open ... Open it". */
check(
  "one file says Open it, several say Open them",
  /"A file is already open at this address\. Open it before you take another job here\."/.test(screen) &&
    /files are already open at this address\. Open them before you take another job here\.`/.test(screen) &&
    !/\}\{" "\}\s*Open it before/.test(screen),
);
check("an answer for an address since edited is never shown", /atAddress\.key === addressAsked/.test(screen));
const rules = code("src/lib/job-intake-rules.ts");
check(
  "open means not delivered, closed, cancelled or refused, written here as the ruling",
  /NOT_OPEN_AT_ADDRESS = \["delivered", "closed", "cancelled", "refused"\] as const;/.test(rules),
);

console.log(wrong === 0 ? "\nNew job warns of an open file at the address, with a link, before the job is taken." : `\n${wrong} check(s) wrong.`);
await db.close();
process.exitCode = wrong === 0 ? 0 : 1;
