/**
 * THE GUIDE PAGES AND WHAT EACH IS WRITTEN IN, AND THEIR DATES FROM GIT.
 *
 * Robert, 2026-10-25, from the Ahrefs crawl: Article schema on the fifteen
 * guide pages, with datePublished and dateModified from each page's real git
 * history, never typed. The build cannot read git (Vercel and the board clone
 * shallow), so scripts/emit-guide-dates.mjs writes the dates into
 * src/content/guide-dates.ts, and scripts/guide-dates-audit.mjs derives them
 * again from git and refuses any difference.
 *
 * A page's sources are the lines that hold its own words: the whole page file
 * where the page writes its own copy, or its own block in a shared content
 * file, found by its slug. The shared [slug] templates are not sources: a
 * restyle of the template is not a change to what any one page says.
 *
 *   datePublished  the oldest commit in the history of those lines
 *   dateModified   the newest
 *
 * `git log -L` follows a block of lines back through every commit that changed
 * it, so a commit elsewhere in a shared file does not move a page's date.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SE = "src/content/structural-engineer.ts";
const WS = "src/content/windstorm-program.ts";

/* The fifteen, as Robert named them. Coverage, process and index pages are not guides. */
export const GUIDES = [
  { path: "/what-is-a-structural-engineer", sources: [{ file: "src/app/(site)/what-is-a-structural-engineer/page.tsx" }] },
  {
    path: "/structural-engineer",
    sources: [
      { file: "src/app/(site)/structural-engineer/page.tsx" },
      { file: SE, from: /^export const proximityHub\b/, to: /^export const proximityPages\b/ },
    ],
  },
  { path: "/structural-engineer/cost", sources: [{ file: "src/app/(site)/structural-engineer/cost/page.tsx" }] },
  ...["when-you-need-one", "inspection", "how-to-choose"].map((slug) => ({
    path: `/structural-engineer/${slug}`,
    sources: [{ file: SE, slug }],
  })),
  ...[
    "before-work-begins",
    "catastrophe-area",
    "completed-construction",
    "re-roofs-and-repairs",
    "appointed-engineers",
    "buying-and-selling",
    "opening-protection",
    "twia-coverage",
  ].map((slug) => ({ path: `/windstorm/${slug}`, sources: [{ file: WS, slug }] })),
];

/** The 1-based line range a source covers in the file as it is now. Throws if it cannot be found. */
export function lineRange(source) {
  const lines = readFileSync(source.file, "utf8").split("\n");
  if (source.from) {
    const a = lines.findIndex((l) => source.from.test(l));
    const b = lines.findIndex((l, i) => i > a && source.to.test(l));
    if (a < 0 || b < 0) throw new Error(`${source.file}: the block ${source.from} to ${source.to} is not there`);
    return [a + 1, b];
  }
  if (source.slug) {
    const at = lines.findIndex((l) => l.trim() === `slug: "${source.slug}",`);
    if (at < 0) throw new Error(`${source.file}: no block with slug "${source.slug}"`);
    let open = at;
    while (open >= 0 && lines[open].trim() !== "{") open -= 1;
    if (open < 0) throw new Error(`${source.file}: the block for "${source.slug}" has no opening brace`);
    const indent = lines[open].match(/^\s*/)[0];
    const close = lines.findIndex((l, i) => i > at && (l === `${indent}},` || l === `${indent}}`));
    if (close < 0) throw new Error(`${source.file}: the block for "${source.slug}" has no closing brace`);
    return [open + 1, close + 1];
  }
  return null;
}

/** Author dates of every commit in a source's history, newest first. */
function datesOf(source) {
  const range = lineRange(source);
  const args = range
    ? ["log", `-L${range[0]},${range[1]}:${source.file}`, "--format=%aI", "-s"]
    : ["log", "--follow", "--format=%aI", "--", source.file];
  const out = execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.split("\n").map((l) => l.trim()).filter((l) => /^\d{4}-\d{2}-\d{2}T/.test(l));
}

/*
 * ===========================================================================
 * THE INSIGHT POSTS, Robert's answer of 2026-10-25: a post whose wording
 * changed takes that day as its dateModified, from this same git history, and
 * a typed dateModified that disagrees with git fails guide-dates-audit.
 * ===========================================================================
 *
 * Every post in the three insight files is found by its own slug, the same way
 * a guide block is. Its dates are Chicago calendar days, because a post shows a
 * day, never a time.
 *
 * A COMMIT THAT CHANGES ONLY A DATE LINE IS NOT A CHANGE TO THE POST. Writing a
 * post's git date into its typed field is itself an edit to the block, and
 * without this the date would chase itself forward every time it was written
 * down. So a commit whose every added and removed line inside the block is a
 * datePublished or dateModified line is skipped.
 */
export const POST_FILES = ["src/content/insights.ts", "src/content/insights-roofs.ts", "src/content/insights-coastal.ts"];
const DATE_LINE = /^\s*date(Published|Modified):/;
export const chicagoDay = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date(iso));

/** Every post block: { slug, file, from, to } with 1-based lines, in file order. */
export function postBlocks() {
  return POST_FILES.flatMap((file) => {
    const lines = readFileSync(file, "utf8").split("\n");
    return lines.flatMap((l, i) => {
      const m = l.match(/^ {4}slug: "([^"]+)",$/);
      if (!m) return [];
      const [from, to] = lineRange({ file, slug: m[1] });
      return [{ slug: m[1], file, from, to, text: lines.slice(from - 1, to).join("\n") }];
    });
  });
}

/** Author dates of the commits that changed a block's words, newest first: date-only commits skipped. */
function wordDatesOf(file, from, to) {
  const out = execFileSync("git", ["log", `-L${from},${to}:${file}`, "--format=__COMMIT__%aI"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return out
    .split("__COMMIT__")
    .filter(Boolean)
    .flatMap((chunk) => {
      const [date, ...rest] = chunk.split("\n");
      const changed = rest.filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l)).map((l) => l.slice(1));
      if (changed.length > 0 && changed.every((l) => DATE_LINE.test(l))) return [];
      return /^\d{4}-\d{2}-\d{2}T/.test(date.trim()) ? [date.trim()] : [];
    });
}

/** { slug: { datePublished, dateModified } } for every post, as Chicago days, from git. */
export function derivePostDates() {
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim();
  if (shallow === "true") throw new Error("this clone is shallow, so its history is not the post's history; fetch with depth 0");
  const out = {};
  for (const p of postBlocks()) {
    const dates = wordDatesOf(p.file, p.from, p.to).sort((x, y) => Date.parse(x) - Date.parse(y));
    if (dates.length === 0) throw new Error(`${p.slug}: git has no history for its block`);
    out[p.slug] = { datePublished: chicagoDay(dates[0]), dateModified: chicagoDay(dates[dates.length - 1]) };
  }
  return out;
}

/** A post's typed dates, with a section constant resolved from its own file. */
export function typedPostDates(p) {
  const fileText = readFileSync(p.file, "utf8");
  const resolve = (raw) => {
    if (!raw) return null;
    const lit = raw.match(/^"(\d{4}-\d{2}-\d{2})"$/);
    if (lit) return lit[1];
    const c = fileText.match(new RegExp(`^const ${raw} = "(\\d{4}-\\d{2}-\\d{2})";$`, "m"));
    return c ? c[1] : `unresolved ${raw}`;
  };
  return {
    datePublished: resolve(p.text.match(/^\s*datePublished: ([^,\n]+),$/m)?.[1]?.trim()),
    dateModified: resolve(p.text.match(/^\s*dateModified: ([^,\n]+),$/m)?.[1]?.trim()),
  };
}

/** { path: { datePublished, dateModified } } for every guide, from git. Throws on a shallow clone. */
export function deriveGuideDates() {
  const shallow = execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim();
  if (shallow === "true") throw new Error("this clone is shallow, so its history is not the page's history; fetch with depth 0");
  const out = {};
  for (const g of GUIDES) {
    const all = g.sources.flatMap(datesOf).sort((x, y) => Date.parse(x) - Date.parse(y));
    if (all.length === 0) throw new Error(`${g.path}: git has no history for its sources`);
    out[g.path] = { datePublished: all[0], dateModified: all[all.length - 1] };
  }
  return out;
}
