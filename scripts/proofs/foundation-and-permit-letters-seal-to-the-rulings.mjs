/**
 * THE FOUNDATION AND PERMIT LETTERS SEAL TO THE RULINGS, AND ROOF IS WHAT IT WAS.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/foundation-and-permit-letters-seal-to-the-rulings.mjs
 *
 * Operator ruling FC-1 and ruling 7 of 2026-10-23. The pure foundation draft is
 * run; the sealing step, the after decision job and the review screen are read
 * as source for the call each must make; the foundation refund disclosure is
 * read from the real function over the real catalogue entry.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { draftFoundationLetter, producesFoundationLetter } = await import("../../src/lib/letter-draft-fc-pl.ts");
const { refundDisclosure } = await import("../../src/lib/ops-orders.ts");
const { CATALOG } = await import("../../data/catalog.ts");

/* FC-1: which determinations produce a foundation letter. */
check("FC-1: pass, repairs required and a decline at review produce a foundation letter", ["pass", "repairs-required", "decline"].every(producesFoundationLetter));
check("FC-1: revise and site revisit produce none", !producesFoundationLetter("revise") && !producesFoundationLetter("site-revisit"));

const facts = {
  determination_date: "October 23, 2026", recipient_name: "Proof Lender", recipient_address: "1 Bank St", recipient_salutation: "Dear Underwriter",
  property_address: "2 Fictional Way", county: "Fictional", file_number: "254-F-1", purpose_verbatim: "a home sale", requestor_name: "Proof Requestor",
  inspection_date: "October 20, 2026", foundation_type: "crawlspace", method: "Visual inspection with relative elevation survey and crawlspace inspection.",
  protocol_number: "254-FC-001", protocol_version: "1.0", evidence_count: "30", items_not_observed: "none",
};
const observed = "Hairline cracking at the east wall; slope within one percent across the survey.";
const c = draftFoundationLetter("decline", facts, observed);
const text = c.ok ? c.lines.map((l) => l.text).join("\n") : "";
check("a decline at review drafts option C, his sentence", c.ok && text.includes("this firm declines to certify the foundation"), c.ok ? "" : c.why);
check("and carries his observed condition after \"Observed condition:\"", /Observed condition:\n.*Hairline cracking at the east wall/.test(text));
const noObs = draftFoundationLetter("pass", facts, "");
check("a foundation letter without his observed condition drafts nothing", !noObs.ok && noObs.missing.includes("observed_condition"));
const noType = draftFoundationLetter("pass", { ...facts, foundation_type: null, method: null }, observed);
check("nor without a confirmed foundation type and its method", !noType.ok && noType.missing.includes("foundation_type") && noType.missing.includes("method"));

/* The sealing step, by source. */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
check("exactly roof, foundation and permit letters are sealable", /export const SEALABLE_PROTOCOLS = \["254-RC-001", "254-FC-001", "254-PL-001"\] as const;/.test(seal));
check("FC-3: the foundation type that prints is the one he confirmed, never the intake answer alone", /const confirmed = recorded\.foundation_type\?\.value \?\? null;/.test(seal) && /foundation_type: confirmed,/.test(seal) && !/foundation_type: answers\.foundation_type/.test(seal));
check("PL-3: the element that prints is the one he reviewed", /element_described: recorded\.element_described\?\.value \?\? null,/.test(seal));
check("PL-2: the authority's address and salutation are the office's record", /authority_address: recorded\.authority_address\?\.value/.test(seal) && /authority_salutation: recorded\.authority_salutation\?\.value/.test(seal));
check("PL-4: the basis is the triage record", /basis: triage\.basis,/.test(seal));
check("PL-5: the documents schedule is the evidence he relied on", /const relied = new Set\(det\.relied_on_evidence_ids \?\? \[\]\);/.test(seal));
check(
  "FC-1: a foundation decline letter is delivered and settles as sealed work, as a pass does",
  /const delivers = det\.determination === "pass" \|\| \(det\.protocol_document === "254-FC-001" && det\.determination === "decline"\);/.test(seal),
);
check("roof's path is unchanged: its facts and draft are what they were", /const facts = await letterFactsFor\(det, entered\);[\s\S]{0,300}draftRoofLetter\(det\.determination, facts\.facts\)/.test(seal));

/* The after decision job: no refund for a foundation decline at review. */
const jobs = readFileSync("src/lib/job-handlers.ts", "utf8");
check(
  "FC-1: the after decision job does not refund a foundation decline at review",
  /const lettersInstead = refusedFile\?\.service_slug === "foundation-inspections";\s*const order = lettersInstead \? null : await liveOrderForFile\(fileId, "id"\);/.test(jobs),
);
const hold = readFileSync("src/lib/dispatch-hold.ts", "utf8");
check("and a decline before dispatch still refunds", /settleDecision\(\{ orderId: order\.id as string, outcome: "refuse"/.test(hold));

/* What the foundation customer is told before paying. */
const fc = CATALOG.find((e) => e.serviceSlug === "foundation-inspections");
const said = refundDisclosure(fc).join(" ");
check("the foundation disclosure says a decline before anyone attends is a full refund", /before anyone attends the property, you are refunded in full/.test(said));
/* Robert's approved wording of 2026-10-23, pinned as a literal so a reworded sentence goes red. */
const APPROVED =
  "If the engineer declines to certify the foundation after reviewing the evidence, you receive his sealed letter stating so and his reason. That letter is the work delivered, so it is not refunded.";
check("and that a declining letter after review is the work delivered and not refunded, in Robert's approved words", refundDisclosure(fc).includes(APPROVED));
const roofSaid = refundDisclosure(CATALOG.find((e) => e.serviceSlug === "roof-inspections")).join(" ");
check("the roof disclosure is unchanged: a decline after attendance retains only the inspection fee", /refunded everything except the \$175\.00 inspection/.test(roofSaid));

/* The review screen. */
const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check(
  "the review screen offers the seal for a foundation or permit letter of any producing determination, and for roof its pass only",
  /selectedAwaiting\.find\(\(l\) => l\.protocolDocument !== "254-RC-001"\)/.test(review) && /l\.protocolDocument === "254-RC-001" && l\.determination === "pass"/.test(review),
);

console.log("");
if (wrong === 0) {
  console.log("PASS: the foundation and permit letters seal to the rulings, and roof is what it was.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
