/**
 * A PARTNER'S ORDER PAGE NAMES THE FIRM FROM THE REGISTER, AND LISTS ONLY OPEN LINES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-partner-order-page-names-the-firm-from-the-register.mjs
 *
 * Run item 16 of 2026-10-10. /order/referred/<code> carries, per open line,
 * "Roof certifications by <name>, TBPELS Firm <number>" from the register. The
 * name beside the number is one the board holds (CLAUDE.md section 1): the
 * brand "254 Engineering" once the registration's dbas holds it, the
 * registrant's name until then. Compared against PINNED LITERALS.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { partnerAttributionLine } = await import("../../src/lib/partner-copy.ts");

const today = partnerAttributionLine("Roof Certifications");
check(
  "today the line names the registrant, because the board does not yet hold the brand",
  today === "Roof certifications by 254 Engineering LLC, TBPELS Firm F-29811",
  today ?? "null",
);

const filed = partnerAttributionLine("Roof Certifications", {
  issuedTo: "254 Engineering LLC",
  number: "F-29811",
  dbas: ["Sealed Engineering", "Stamp My Plans", "254 Engineering Services", "254 Engineering"],
});
check(
  "once the board holds the brand as an assumed name, the line reads the brand",
  filed === "Roof certifications by 254 Engineering, TBPELS Firm F-29811",
  filed ?? "null",
);
check("with no active registration there is no line", partnerAttributionLine("Roof Certifications", null) === null);

/* The page: the register's line, the performing firm sentence, and the money door for every deliverable. */
const page = readFileSync("src/app/(order)/order/referred/[code]/page.tsx", "utf8");
check("the page asks every deliverable through orderBlockedNow", page.includes("orderBlockedNow(d, mode)"));
check("and lists a line only when one of its deliverables is open", page.includes("blocked.some((b) => b === null)"));
check("it renders the attribution from the register", page.includes("partnerAttributionLine(service.shortName)"));
check("and the performing firm sentence every partner surface carries", page.includes("performingFirmLine()"));
check("it is never indexed", /robots:\s*\{\s*index:\s*false/.test(page));
check("an unknown or inactive code is a 404", page.includes("if (!partner) notFound()"));
check("the visit is recorded as the partner's touch", page.includes("<ReferralCapture code={partner.code} />"));

const surfaces = readFileSync("scripts/lib/surfaces.mjs", "utf8");
check("the browser audits measure it, by a real development partner", surfaces.includes('"/order/referred/demo-title"'));

console.log("");
if (wrong === 0) {
  console.log("PASS: a partner's order page names the firm from the register, and lists only open lines.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
