/**
 * A service page shows a protocol's quoted scope only while that protocol's
 * signature reads as live, and a placed order keeps the scope it was bought
 * under.
 *
 * Robert, 17:31 Central 2026-10-31, queue item 15: /services pages drop the
 * scope once a signature is voided, without a database read on every public
 * view; a placed order keeps its scope. The read itself (src/lib/scope-live.ts)
 * needs the database and runs at build or revalidation, so this proof tests
 * the pure half, which protocol a deliverable quotes, against services.ts, and
 * reads the source for the rest: who calls the read, what it treats as live,
 * and who must not call it.
 *
 * The pending sentence is written out here as a literal, never imported.
 */
import { readFileSync } from "node:fs";

const PENDING = "The scope of this service is published here once the engineer of record signs its protocol.";

const { protocolQuotedBy } = await import("../../src/lib/scope-quote.ts");
const { services } = await import("../../src/content/services.ts");
const catalog = await import("../../data/catalog.ts");

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

check("the catalogue's pending sentence is the operator's wording", catalog.SCOPE_PENDING === PENDING);

const quoting = services
  .map((s) => ({ slug: s.slug, doc: protocolQuotedBy(s.deliverable) }))
  .filter((s) => s.doc);
check(
  "every service page that quotes a protocol is found, and each names its document",
  quoting.length >= 3 && quoting.every((s) => /^254-[A-Z]{2}-001$/.test(s.doc)),
  quoting.map((s) => `${s.slug}=${s.doc}`).join(", "),
);
const quotedDocs = new Set(quoting.map((s) => s.doc));
check(
  "254-WS-001, 254-FC-001 and 254-SL-001 are among them",
  ["254-WS-001", "254-FC-001", "254-SL-001"].every((d) => quotedDocs.has(d)),
  [...quotedDocs].join(", "),
);
check("the pending sentence quotes nothing", protocolQuotedBy([PENDING]) === null);
const ws = catalog.PROTOCOL_RECEIVES["254-WS-001"];
check("a list missing one sentence quotes nothing", protocolQuotedBy(ws.slice(1)) === null);
check("a list in another order quotes nothing", protocolQuotedBy([...ws].reverse()) === null);
check("an empty list quotes nothing", protocolQuotedBy([]) === null);

/* The read: only a live signature keeps the quote. */
const live = read("src/lib/scope-live.ts");
check("the read is server-only", /^import "server-only";/.test(live));
check("it asks signatureStatus, the portal's own read", live.includes("signatureStatus(documentNumber, p.version)"));
check(
  "it keeps the quote only on a state of signed, so void, unsigned and unknown all render the pending sentence",
  live.includes('statuses.some((s) => s.state === "signed") ? [...deliverable] : [SCOPE_PENDING]'),
);

/* Who renders it. */
const page = read("src/app/(site)/services/[slug]/page.tsx");
check("the service page reads its deliverable through the signed record", page.includes("await deliverableAsSigned(service.deliverable)"));
check("and renders that, never the raw list", page.includes("{deliverable.map((item) =>") && !page.includes("service.deliverable.map("));
check("and stays prerendered: no per-view rendering was switched on", !/export const dynamic\s*=\s*"force-dynamic"/.test(page) && !/export const revalidate/.test(page));
const llms = read("src/app/llms-full.txt/route.ts");
check("llms-full.txt reads the same", llms.includes("(await deliverableAsSigned(service.deliverable))") && !llms.includes("service.deliverable.map("));

/* Who must not: a placed order keeps the scope it was bought under. */
for (const p of ["src/app/(order)/order/[reference]/page.tsx", "src/lib/email-templates.ts", "src/lib/ops-customer.ts", "src/lib/ops-payments.ts"]) {
  check(`a placed order's surface does not re-read it: ${p}`, !read(p).includes("deliverableAsSigned"));
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? "  PASS" : "  FAIL"}: ${r.name}${r.detail ? ` (${r.detail})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: a service page keeps a protocol's scope only while its signature is live, read at render, and a placed order keeps its own."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
