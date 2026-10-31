/**
 * A service page shows a protocol's quoted scope while its signature is live,
 * the pending sentence once a successful read finds it voided or unsigned, and
 * the scope plus an error event and an office alert when the read fails. A
 * placed order keeps the scope it was bought under.
 *
 * Robert, 17:31 Central 2026-10-31 (queue item 15), amended at 18:04: "The
 * proof covers all three cases: live shows scope, voided shows pending, read
 * fails shows scope plus an alert." The decision is resolveDeliverable in
 * src/lib/scope-quote.ts, pure with the read passed in, so the three cases are
 * driven here with no database. The wiring that passes the real read and does
 * the recording (scope-live.ts) and the cron that revalidates
 * (scope-revalidate.ts) are server-only, so their source is read.
 *
 * The pending sentence is written out here as a literal, never imported.
 */
import { readFileSync } from "node:fs";

const PENDING = "The scope of this service is published here once the engineer of record signs its protocol.";

const { protocolQuotedBy, resolveDeliverable, pagesQuoting, VOID_LOOKBACK_MINUTES } = await import("../../src/lib/scope-quote.ts");
const { services } = await import("../../src/content/services.ts");
const catalog = await import("../../data/catalog.ts");
const { OFFICE_ALERT_IDS } = await import("../../src/lib/alert-recipient-rules.ts");
const templates = await import("../../src/lib/email-templates.ts");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

check("the catalogue's pending sentence is the operator's wording", catalog.SCOPE_PENDING === PENDING);

/* Which protocol a page quotes. */
const quoting = services.map((s) => ({ slug: s.slug, doc: protocolQuotedBy(s.deliverable) })).filter((s) => s.doc);
const quotedDocs = new Set(quoting.map((s) => s.doc));
check(
  "every service page that quotes a protocol is found, 254-WS-001, 254-FC-001 and 254-SL-001 among them",
  ["254-WS-001", "254-FC-001", "254-SL-001"].every((d) => quotedDocs.has(d)),
  quoting.map((s) => `${s.slug}=${s.doc}`).join(", "),
);
const ws = catalog.PROTOCOL_RECEIVES["254-WS-001"];
check("the pending sentence quotes nothing", protocolQuotedBy([PENDING]) === null);
check("a list missing one sentence quotes nothing", protocolQuotedBy(ws.slice(1)) === null);
check("a list in another order quotes nothing", protocolQuotedBy([...ws].reverse()) === null);

/* THE THREE CASES. */
const wsPage = services.find((s) => protocolQuotedBy(s.deliverable) === "254-WS-001");
const reader = (reads) => async () => reads;

const live = await resolveDeliverable(wsPage.deliverable, reader([{ state: "signed" }]), PENDING);
check("1. live: the page shows the quoted scope", live.deliverable.join("|") === ws.join("|") && live.failed === null);

const voided = await resolveDeliverable(wsPage.deliverable, reader([{ state: "void", why: "voided at a sitting" }]), PENDING);
check("2. voided: the page shows the pending sentence", voided.deliverable.length === 1 && voided.deliverable[0] === PENDING && voided.failed === null);
const unsigned = await resolveDeliverable(wsPage.deliverable, reader([{ state: "unsigned" }]), PENDING);
check("   and unsigned does the same", unsigned.deliverable[0] === PENDING && unsigned.failed === null);

const failed = await resolveDeliverable(
  wsPage.deliverable,
  reader([{ state: "unknown", why: "The signature record could not be read: timeout" }]),
  PENDING,
);
check(
  "3. read fails: the page keeps the quoted scope",
  failed.deliverable.join("|") === ws.join("|"),
  failed.deliverable[0]?.slice(0, 40),
);
check(
  "   and hands back the failure, naming the protocol and why, for the error event and the alert",
  failed.failed?.documentNumber === "254-WS-001" && /timeout/.test(failed.failed?.why ?? ""),
  JSON.stringify(failed.failed),
);
const thrown = await resolveDeliverable(wsPage.deliverable, async () => { throw new Error("connection refused"); }, PENDING);
check("   a read that throws is a failed read too: scope kept, failure handed back", thrown.deliverable.join("|") === ws.join("|") && /connection refused/.test(thrown.failed?.why ?? ""));
const mixed = await resolveDeliverable(wsPage.deliverable, reader([{ state: "unsigned" }, { state: "unknown", why: "timeout" }]), PENDING);
check("   one version unsigned and another unreadable is not a successful read: scope kept", mixed.deliverable.join("|") === ws.join("|") && mixed.failed !== null);
const none = await resolveDeliverable(wsPage.deliverable, reader([]), PENDING);
check("   no read made at all removes nothing", none.deliverable.join("|") === ws.join("|") && none.failed !== null);
const either = await resolveDeliverable(wsPage.deliverable, reader([{ state: "void" }, { state: "signed" }]), PENDING);
check("   a live signature on any offered version keeps the scope", either.deliverable.join("|") === ws.join("|") && either.failed === null);
const plain = await resolveDeliverable(["A sentence of the firm's own."], async () => { throw new Error("never read"); }, PENDING);
check("   a deliverable that quotes no protocol is never read and never changed", plain.deliverable[0] === "A sentence of the firm's own." && plain.failed === null);

/* The wiring: the real read, the error event and the office alert naming the page. */
const liveSrc = read("src/lib/scope-live.ts");
check("the wiring is server-only and passes signatureStatus as the read", /^import "server-only";/.test(liveSrc) && liveSrc.includes("signatureStatus(documentNumber, p.version)"));
check("a failed read writes an error event naming the page", liveSrc.includes("captureError(new Error(message), { kind: \"scope-read\", route: page"));
check("and queues the office alert naming the page", liveSrc.includes("queueEmail(") && liveSrc.includes("scopeReadFailedAlert({") && liveSrc.includes("page,"));
check("the alert is an office alert, so it reaches the list the owner edits", OFFICE_ALERT_IDS.includes("ops.scope_read_failed"));
const sample = templates.scopeReadFailedAlert({
  page: "/services/windstorm-wpi-8",
  documentNumber: "254-WS-001",
  why: "timeout",
  pageUrl: "https://254engineering.com/services/windstorm-wpi-8",
  environment: "production",
});
check("the alert names the page in its subject and its body", sample.subject.includes("/services/windstorm-wpi-8") && sample.text.includes("/services/windstorm-wpi-8"), sample.subject);

/* Who renders it. */
const page = read("src/app/(site)/services/[slug]/page.tsx");
check("the service page reads its deliverable through it, naming itself", page.includes("await deliverableAsSigned(service.deliverable, `/services/${service.slug}`)"));
check("and renders that, never the raw list", page.includes("{deliverable.map((item) =>") && !page.includes("service.deliverable.map("));
check("and stays prerendered: no per-view rendering was switched on", !/export const dynamic\s*=\s*"force-dynamic"/.test(page) && !/export const revalidate/.test(page));
const llms = read("src/app/llms-full.txt/route.ts");
check("llms-full.txt reads the same", llms.includes('(await deliverableAsSigned(service.deliverable, "/llms-full.txt"))') && !llms.includes("service.deliverable.map("));

/* The trigger: the every-minute cron revalidates the pages quoting a voided protocol. */
const pages = pagesQuoting(["254-WS-001"], services);
check("a void on 254-WS-001 revalidates its service page and llms-full.txt", pages.includes(`/services/${wsPage.slug}`) && pages.includes("/llms-full.txt"), pages.join(", "));
check("a void on a protocol no page quotes revalidates nothing", pagesQuoting(["254-RC-001"], services).length === 0);
check("the lookback covers missed runs of a one-minute cron", VOID_LOOKBACK_MINUTES >= 5, `${VOID_LOOKBACK_MINUTES}`);
const sweep = read("src/lib/scope-revalidate.ts");
check("the sweep reads protocol seal acts voided in the window and revalidates each page", sweep.includes('.eq("kind", "protocol")') && sweep.includes('.gte("voided_at", since)') && sweep.includes("revalidatePath(page)"));
check("the jobs cron calls it", read("src/app/api/cron/jobs/route.ts").includes("await sweepVoidedProtocolScopes()"));
check("and the cron runs every minute", /"path": "\/api\/cron\/jobs",\s*"schedule": "\* \* \* \* \*"/.test(read("vercel.json")));

/* Who must not: a placed order keeps the scope it was bought under. */
for (const p of ["src/app/(order)/order/[reference]/page.tsx", "src/lib/email-templates.ts", "src/lib/ops-customer.ts", "src/lib/ops-payments.ts"]) {
  check(`a placed order's surface does not re-read it: ${p}`, !read(p).includes("deliverableAsSigned"));
}

let failedCount = 0;
for (const r of results) {
  if (!r.ok) failedCount += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failedCount === 0
    ? "PASS: live shows the scope, voided shows pending, a failed read shows the scope and alerts the office; the cron revalidates on a void; a placed order keeps its own."
    : `FAIL: ${failedCount} check(s).`,
);
process.exitCode = failedCount === 0 ? 0 : 1;
