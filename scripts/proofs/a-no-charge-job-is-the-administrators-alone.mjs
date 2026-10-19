/**
 * A JOB AT NO CHARGE IS OPENED BY AN ADMINISTRATOR, WITH A FRESH CODE, AND IS
 * RECORDED BEFORE IT EXISTS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-no-charge-job-is-the-administrators-alone.mjs
 *
 * Operator ruling, 2026-10-16. "Open it unpaid" stays bill-later under
 * files.create. A client price of ZERO needs the administrator role, a fresh
 * authenticator code through verifyFreshCode, a typed reason, and an audit row
 * written before the file is created. Until this, any files.create holder,
 * Sales included, could enter $0 with a ten character reason.
 *
 * The verdicts are exercised on noChargeRefusal, the one rule the screen and
 * the server share. That takeJob asks it, then the code, then writes the
 * record, all BEFORE it creates a client or a file, is asserted from the
 * source by position, because the ordering is the whole guarantee: an audit row
 * written after the file is a record that can be missing.
 */
import { readSource } from "../lib/read-source.mjs";

const { noChargeRefusal, isNoCharge } = await import("../../src/lib/job-intake-rules.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const REASON = "The owner's own property, inspected at no charge.";
const ask = (over) =>
  noChargeRefusal({
    actorId: "person-1",
    actorRole: "admin",
    reason: REASON,
    paymentIntent: "released_unpaid",
    code: "123456",
    ...over,
  });

check("a price of zero is a no-charge job", isNoCharge(0) === true);
check("a price of one cent, or none, is not", isNoCharge(1) === false && isNoCharge(null) === false);

check("an administrator with a reason and a code passes the rule", ask({}) === null, "the code itself is then checked by verifyFreshCode");
check("a Sales account is refused", ask({ actorRole: "sales" }) !== null, ask({ actorRole: "sales" }) ?? "allowed");
check("a technician account is refused", ask({ actorRole: "field_tech" }) !== null, ask({ actorRole: "field_tech" }) ?? "allowed");
check("a dispatcher and customer service are refused too", ask({ actorRole: "dispatcher" }) !== null && ask({ actorRole: "customer_service" }) !== null);
check("the platform acting with no person behind it is refused", ask({ actorId: null }) !== null);
check("a missing code is refused", ask({ code: null }) !== null && ask({ code: "   " }) !== null, ask({ code: null }) ?? "allowed");
check("a reason under ten characters is refused", ask({ reason: "free" }) !== null);
check("and it cannot be sent a payment link or invoiced", ask({ paymentIntent: "link_sent" }) !== null && ask({ paymentIntent: "invoiced" }) !== null);

/* takeJob, read in order. */
const intake = readSource("src/lib/ops-job-intake.ts");
const start = intake.indexOf("export async function takeJob(");
const body = start >= 0 ? intake.slice(start) : "";
const at = (s) => body.indexOf(s);
const rule = at("const refused = noChargeRefusal({");
const refusedReturn = at("if (refused) return { ok: false, error: refused");
const code = at('const fresh = await verifyFreshCode(actor.id as string, input.noChargeCode ?? "", "A job at no charge");');
const codeReturn = at("if (!fresh.ok) return { ok: false, error: fresh.error");
const record = at("const recorded = await writeAuditOrRefuse({");
const recordReturn = at("if (!recorded.ok) return { ok: false, error: recorded.error");
const client = at("const made = await createClient(");
const file = at("const file = await createFile(");
check("takeJob is found, so the order below is read from it", start >= 0);
check(
  "the rule, then the code, then the record, each refusing on failure",
  rule > 0 && refusedReturn > rule && code > refusedReturn && codeReturn > code && record > codeReturn && recordReturn > record,
  `rule ${rule}, code ${code}, record ${record}`,
);
check(
  "and all of it before a client or a file is created",
  recordReturn > 0 && client > recordReturn && file > recordReturn,
  `record refuses at ${recordReturn}, client at ${client}, file at ${file}`,
);
check("the rule is asked only for a price of zero, read from the price actually decided", /if \(isNoCharge\(clientCents\)\) \{/.test(body) && /const clientCents = decision\.overridden \? decision\.cents : catalogCents;/.test(body));
check("the record carries the reason and when the code was checked", /action: "job\.no_charge"/.test(body) && /second_factor_verified_at: factor\.verifiedAt/.test(body) && /factor = \{ kind: "authenticator", verifiedAt: fresh\.verifiedAt \}/.test(body) && /reason: decision\.overridden/.test(body));

/*
 * THE OWNER OVERRIDE, operator ruling 2026-10-19. The code path above is the
 * ELSE of one branch, taken by every id except the owner's administrator id.
 * Asserted by position: the branch is decided by isOwnerAdmin on the actor's
 * id, the override's own record refuses before the no-charge record is
 * written, and the code path is unchanged inside the else. The id itself,
 * and that no other id reaches the branch, is the-owner-override-is-two-ids.
 */
const branch = at("if (isOwnerAdmin(actor.id)) {");
const overrideRecord = at("const used = await writeAuditOrRefuse({");
const overrideReturn = at('if (!used.ok) return { ok: false, error: used.error, field: "noChargePassword" };');
const elseAt = branch >= 0 ? body.indexOf("} else {", branch) : -1;
check(
  "the override branch is decided by the actor's id, after the rule and before the code",
  branch > refusedReturn && branch < code && elseAt > branch && elseAt < code,
  `branch ${branch}, else ${elseAt}, code ${code}`,
);
check(
  "and its own record refuses before the no-charge record is written",
  overrideRecord > branch && overrideReturn > overrideRecord && overrideReturn < elseAt && record > codeReturn,
  `override record ${overrideRecord}, refuses ${overrideReturn}`,
);
check("the password is checked by the signed-in id, before the record", /const pw = await verifyOwnPassword\(actor\.id as string, input\.noChargePassword \?\? ""\);/.test(body) && at("const pw = await verifyOwnPassword(") < overrideRecord);

const probe = "11111111-1111-4111-8111-111111111111";
check(
  "another administrator with a password and no code is refused",
  ask({ actorId: probe, code: null, password: "a-password" }) !== null,
  ask({ actorId: probe, code: null, password: "a-password" }) ?? "allowed",
);

/* The record that refuses, rather than logging and carrying on. */
const audit = readSource("src/lib/ops-audit.ts");
const orRefuse = audit.slice(audit.indexOf("export async function writeAuditOrRefuse("));
check(
  "writeAuditOrRefuse returns a refusal when the row is not written",
  /\.insert\(auditRow\(input\)\)\.select\("id"\)\.single\(\)/.test(orRefuse) && /if \(error \|\| !data\) \{\s*return \{ ok: false/.test(orRefuse),
);

/* The route still needs files.create, so a technician never reaches takeJob at all. */
const route = readSource("src/app/api/portal/files/route.ts");
check("the intake route still refuses anybody without files.create", /if \(action === "take_job"\) \{\s*if \(!can\(actor, "files\.create"\)\)/.test(route));

console.log("");
if (wrong === 0) {
  console.log("PASS: a job at no charge is an administrator's, with a fresh code, recorded before it exists.");
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
