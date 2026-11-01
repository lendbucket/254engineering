/**
 * EVERY /insights ARTICLE SHOWS AN UPDATED DATE, AND ITS FAQPAGE IS ITS VISIBLE
 * QUESTIONS. Robert's GEO ruling of 2026-10-31, item 7: "Preflight rule: every
 * /guides page has an Updated date and FAQPage JSON-LD that matches its visible
 * questions", applied to /insights by his answer 4 (articles stay under
 * /insights; there are no /guides pages). The standard is docs/content-standard.md.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-insight-is-dated-and-its-questions-are-its-markup.mjs
 *
 * It needs no server, so the preflight runs it. The articles come from the
 * corpus the page renders; the page's own source is read for what it shows.
 */
import { readFileSync, existsSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { insights } = await import("../../src/content/insights.ts");
const PAGE = "src/app/(site)/insights/[slug]/page.tsx";
const page = readFileSync(PAGE, "utf8");

/*
 * The floor guards against a walk that found nothing. It was the 37 articles of
 * 2026-10-31; item h (Robert, 2026-11-01) retired one,
 * /insights/windstorm-certificate-of-compliance, which now answers 301 to the
 * WPI-8 guide, so the floor is 36. It moves only with a ruled removal or
 * addition, named here, and never to make a short walk pass.
 */
check("the corpus was found (the floor is 36 articles: the 37 of 2026-10-31, less the one item h retired)", insights.length >= 36, `${insights.length} articles`);

/* The Updated date: on every article, a real day, never before publication, and always rendered. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const badDates = insights.filter((p) => !DAY.test(p.dateModified ?? "") || !DAY.test(p.datePublished ?? "") || p.dateModified < p.datePublished);
check("every article carries a dateModified that is a day on or after its publication", badDates.length === 0, badDates.map((p) => p.slug).join(", "));
const updatedLine = "Updated <time dateTime={post.dateModified}>{longDate(post.dateModified)}</time>";
const at = page.indexOf(updatedLine);
const before = at > 0 ? page.slice(Math.max(0, at - 600), at) : "";
check("the article page renders the Updated line", at > 0);
check(
  "and renders it unconditionally, not only when the two dates differ",
  at > 0 && !/dateModified !== post\.datePublished \? \(/.test(before) && !/post\.dateModified \? \(/.test(before),
);

/* The questions: every article has visible ones, and the markup is built from exactly them. */
const noFaq = insights.filter((p) => !Array.isArray(p.faqs) || p.faqs.length === 0);
check("every article has visible questions", noFaq.length === 0, noFaq.map((p) => p.slug).join(", "));
const malformed = insights.flatMap((p) => (p.faqs ?? []).filter((f) => !f.q?.trim().endsWith("?") || !f.a?.trim()).map((f) => `${p.slug}: ${f.q}`));
check("every visible question is a question with an answer", malformed.length === 0, malformed.slice(0, 3).join(" | "));
check("the page shows the article's questions through FaqBlock", page.includes("<FaqBlock faqs={post.faqs}"));
check("and builds its FAQPage from the same array", page.includes("faqSchema(post.faqs)") && (page.match(/faqSchema\(/g) ?? []).length === 1);

const { faqSchema } = await import("../../src/lib/schema.tsx");
const unequal = insights.filter((p) => {
  const node = faqSchema(p.faqs);
  return node.mainEntity.length !== p.faqs.length || p.faqs.some((f, i) => node.mainEntity[i].name !== f.q || node.mainEntity[i].acceptedAnswer.text !== f.a);
});
check("for every article the FAQPage equals the visible questions and answers, one for one", unequal.length === 0, unequal.map((p) => p.slug).join(", "));

check("no /guides/<slug> page exists beside them (answer 4)", !existsSync("src/app/(site)/guides/[slug]"));

console.log(wrong === 0 ? "PASS: every /insights article is dated, and its FAQPage is its visible questions." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
