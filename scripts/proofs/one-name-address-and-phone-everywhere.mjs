/**
 * ONE NAME, ADDRESS AND PHONE EVERYWHERE, PROVED WITHOUT A SERVER.
 * Robert's instruction of 2026-10-26, 15:57 Central, piece 4.
 *
 * seo-audit runs scripts/lib/nap.mjs on every rendered sitemap page, which
 * needs a server and so runs on the board. This proof hands the same function
 * pages built to be right and pages built to be wrong in each way that matters,
 * and asserts it names exactly the fault each one carries. It then reads
 * seo-audit as TEXT, to assert the three pinned literals are Robert's and that
 * the function is called on every route with the count asserted afterwards.
 *
 *   node scripts/proofs/one-name-address-and-phone-everywhere.mjs
 */
import { readFileSync } from "node:fs";
import { napFindings } from "../lib/nap.mjs";

const NAME = "254 Engineering";
// Robert, 12:50 Central 2026-10-29: the office moved, and the hours joined.
const ADDRESS = "11103 San Pedro Ave, San Antonio, TX 78216";
const PHONE = "(281) 940-4490";
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = { line: "Monday to Sunday, 8:00 AM to 8:00 PM Central", days: WEEK, opens: "08:00", closes: "20:00" };
const EXPECTED = { name: NAME, address: ADDRESS, phone: PHONE, hours: HOURS };

let failed = 0;
function check(label, ok, detail = "") {
  if (!ok) failed += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${label}${detail ? ` (${detail})` : ""}`);
}

/* A page shaped as SiteFooter and schema.tsx render it, React comments included. */
function page({ footerName = NAME, footerAddress = ADDRESS, footerPhone = `<span class="whitespace-nowrap">${PHONE}</span>`, footerHours = HOURS.line, footer = true } = {}) {
  return [
    "<html><body><main><p>11103 San Pedro Ave</p></main>",
    footer
      ? `<footer class="mt-auto"><div><p class="mt-3">${footerAddress}</p><p class="mt-1">${footerHours}</p><a href="tel:+12819404490">${footerPhone}</a></div>` +
        `<div><p class="font-display">${footerName}</p><p>254 Engineering LLC, TBPELS Firm F-29811</p></div>` +
        `<p>Copyright <!-- -->2026<!-- --> <!-- -->254 Engineering LLC<!-- -->. All rights reserved.</p></footer>`
      : "",
    "</body></html>",
  ].join("");
}

function org(overrides = {}) {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "ProfessionalService"],
    "@id": "https://254engineering.com/#organization",
    name: NAME,
    telephone: "+12819404490",
    address: {
      "@type": "PostalAddress",
      streetAddress: "11103 San Pedro Ave",
      addressLocality: "San Antonio",
      addressRegion: "TX",
      postalCode: "78216",
      addressCountry: "US",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: WEEK.map((d) => `https://schema.org/${d}`),
        opens: "08:00",
        closes: "20:00",
      },
    ],
    ...overrides,
  };
}

function only(label, findings, needle) {
  check(label, findings.length === 1 && findings[0].includes(needle), findings.join(" | ") || "no finding");
}

console.log("=== ONE NAME, ADDRESS AND PHONE ===");

check("a page that agrees has no finding", napFindings("/", page(), [org()], EXPECTED).length === 0,
  napFindings("/", page(), [org()], EXPECTED).join(" | "));

only("the legal name alone in the footer is not the brand name",
  napFindings("/", page({ footerName: "254 Engineering LLC" }), [org()], EXPECTED), 'name "254 Engineering"');
only("a different street number in the footer is named",
  napFindings("/", page({ footerAddress: ADDRESS.replace("11103", "11105") }), [org()], EXPECTED), "address");
only("the old Corpus Christi office in the footer is named",
  napFindings("/", page({ footerAddress: "5601 South Padre Island Drive, Suite E, Corpus Christi, TX 78412" }), [org()], EXPECTED), "address");
only("different hours in the footer are named",
  napFindings("/", page({ footerHours: "Monday to Friday, 8:00 AM to 5:00 PM Central" }), [org()], EXPECTED), "hours");
only("schema hours missing a day are named",
  napFindings("/", page(), [org({ openingHoursSpecification: [{ ...org().openingHoursSpecification[0], dayOfWeek: WEEK.slice(0, 6).map((d) => `https://schema.org/${d}`) }] })], EXPECTED),
  "opening hours");
only("schema hours closing at another time are named",
  napFindings("/", page(), [org({ openingHoursSpecification: [{ ...org().openingHoursSpecification[0], closes: "17:00" }] })], EXPECTED),
  "opening hours");
only("schema with no opening hours is named",
  napFindings("/", page(), [org({ openingHoursSpecification: undefined })], EXPECTED), "opening hours");
check("a caller that passes no hours is named rather than passed",
  napFindings("/", page(), [org()], { name: NAME, address: ADDRESS, phone: PHONE }).some((f) => f.includes("no hours were passed")));
only("a phone split across two text nodes is not the phone",
  napFindings("/", page({ footerPhone: "<span>(281) 940-</span><span>4490</span>" }), [org()], EXPECTED), "phone");
only("an HTML entity in the footer is read as the character it encodes",
  napFindings("/", page({ footerName: "254&#32;Engineering", footerAddress: ADDRESS.replace("San Pedro", "San&nbsp;Pedro") }), [org({ name: "x" })], EXPECTED),
  "Organization name");
check("a page with no footer is named rather than passed",
  napFindings("/", page({ footer: false }), [org()], EXPECTED).some((f) => f.includes("no footer")));

only("a display string in the schema telephone is named",
  napFindings("/", page(), [org({ telephone: PHONE })], EXPECTED), "telephone");
only("a different address in the schema is named",
  napFindings("/", page(), [org({ address: { ...org().address, postalCode: "78411" } })], EXPECTED), "address");
only("another name in the schema is named",
  napFindings("/", page(), [org({ name: "254 Engineering Services" })], EXPECTED), "Organization name");
check("a page with no Organization node is named rather than passed",
  napFindings("/", page(), [{ "@type": "WebSite", "@id": "x" }], EXPECTED).some((f) => f.includes("no Organization node")));

/* seo-audit, read as text: the literals are Robert's, and the call runs on every route. */
const seo = readFileSync("scripts/seo-audit.mjs", "utf8");
check("seo-audit pins the name as a literal", seo.includes(`name: "${NAME}",`));
check("seo-audit pins the address as a literal", seo.includes(`address: "${ADDRESS}",`));
check("seo-audit pins the phone as a literal", seo.includes(`phone: "${PHONE}",`));
check("seo-audit pins the hours as a literal", seo.includes(`line: "${HOURS.line}",`) && seo.includes(`opens: "08:00",`) && seo.includes(`closes: "20:00",`));
check("seo-audit imports neither config for these values", !/from "\.\.?\/?.*src\/config\//.test(seo));
check("seo-audit calls the check inside its sitemap route loop",
  /for \(const route of routes\) \{[\s\S]*?napPagesRead \+= 1;\s*problems\.push\(\.\.\.napFindings\(route, html, meta\.jsonLd, NAP\)\);/.test(seo));
check("and asserts it read every sitemap page", /napPagesRead === 0 \|\| napPagesRead !== routes\.length/.test(seo));

console.log("");
if (failed === 0) {
  console.log("PASS: the footer and the Organization node are held to one name, address and phone, on every page.");
} else {
  console.log(`FAIL: ${failed} check(s).`);
  process.exitCode = 1;
}
