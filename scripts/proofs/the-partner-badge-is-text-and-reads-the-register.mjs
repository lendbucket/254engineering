/**
 * PROOF: THE PARTNER BADGE IS TEXT ONLY, SAYS WHAT partnerBadgeText() SAYS, AND
 * CARRIES THE REGISTRANT AND THE FIRM NUMBER FROM THE REGISTER.
 *
 * Robert's answer 4 of 2026-11-01, round 3 item c: "text-only SVG, gate-aware
 * wording, carrying '254 Engineering LLC, Firm F-29811'", on a /partners/badge
 * page with copy-paste HTML linking to 254engineering.com, plain link, no
 * tracking script. Answer 19 of 2026-10-26 and the 2026-10-15 rule: no logo,
 * never a mark to trade under.
 *
 *   A  the SVG draws a box, a title and text, and nothing else: no image, no
 *      path, no script, no link inside it
 *   B  its text, joined back from its lines, is exactly partnerBadgeText(false),
 *      and its accessible name is the same sentence
 *   C  that sentence names the registrant and the number the register holds
 *   D  the route and the page both take the sentence from partnerBadgeText and
 *      type no firm name or number of their own
 *   E  the snippets link business.url, carry no script, and the page is in the
 *      sitemap so the sitemap-driven audits measure it
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-partner-badge-is-text-and-reads-the-register.mjs
 */
import { readFileSync } from "node:fs";

const { partnerBadgeText, partnerBadgeHtml } = await import("../../src/lib/partner-copy.ts");
const { partnerBadgeSvg, wrapBadgeText } = await import("../../src/lib/partner-badge-svg.ts");
const { activeFirmRegistration } = await import("../../src/lib/launch.ts");
const { business } = await import("../../src/config/business.ts");

const out = [];
const check = (name, ok, note = "") => out.push({ name, ok, note });

const text = partnerBadgeText(false);
const { svg } = partnerBadgeSvg(text);

const tags = [...svg.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]);
const allowed = new Set(["svg", "title", "rect", "text", "tspan"]);
const others = tags.filter((t) => !allowed.has(t));
check("the SVG draws only a box, a title and text", others.length === 0, others.join(", "));
check("it carries no script, image, path or link", !/<(script|image|img|path|a)\b/.test(svg));

const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const drawn = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => unescape(m[1])).join(" ");
check("its drawn text is exactly partnerBadgeText(false)", drawn === text, drawn);
check("its accessible name is the same sentence", svg.includes(`aria-label="${text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"`));
check("no wrapped line runs past the line length", wrapBadgeText(text).every((l) => l.length <= 46 || !l.includes(" ")));

const reg = activeFirmRegistration();
check("the register holds an active registration", Boolean(reg));
check(`the sentence names the registrant, ${reg?.issuedTo}`, text.includes(reg?.issuedTo ?? "\u0000"));
check(`the sentence names the firm number, ${reg?.number}`, text.includes(reg?.number ?? "\u0000"));

const route = readFileSync("src/app/partners/badge.svg/route.ts", "utf8");
const page = readFileSync("src/app/(site)/partners/badge/page.tsx", "utf8");
for (const [name, src] of [["the route", route], ["the page", page]]) {
  check(`${name} takes the sentence from partnerBadgeText`, src.includes("partnerBadgeText(false)"));
  check(`${name} types no firm number`, !/F-\d{4,}/.test(src));
  check(`${name} types no registrant name`, !/254 Engineering LLC/.test(src));
}

const textSnippet = partnerBadgeHtml(text, business.url);
check("the text snippet links business.url", textSnippet.startsWith(`<a href="${business.url}"`));
check("the page's image snippet links business.url and the SVG", page.includes("<a href=\"${business.url}\" rel=\"noopener\"><img src=\"${svgUrl}\""));
check("no snippet carries a script", !/<script/i.test(page) && !/<script/i.test(textSnippet));
check("the page is in the sitemap", readFileSync("src/app/sitemap.ts", "utf8").includes('entry("/partners/badge"'));

let failed = 0;
for (const x of out) {
  if (!x.ok) failed += 1;
  console.log(`${x.ok ? "  PASS" : "  FAIL"}: ${x.name}${x.note ? ` (${x.note})` : ""}`);
}
console.log(
  failed === 0
    ? "PASS: the partner badge is a text-only SVG whose sentence is partnerBadgeText's, naming the registrant and number the register holds, offered as plain links with no script on a page the sitemap lists."
    : `FAIL: ${failed} check(s).`,
);
process.exitCode = failed === 0 ? 0 : 1;
