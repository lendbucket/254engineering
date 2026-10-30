/**
 * Every title and description the public site declares in code meets the
 * budget seo-audit holds the rendered pages to, checked before any server runs.
 *
 * WHY, 2026-10-30. Board 41099813913 missed on "/guides: description has no
 * call to action", and an earlier branch carried a title one character over the
 * 60 limit that only a person counting caught. Both rules ran only on the
 * board, after a server rendered every page. This proof runs in the preflight
 * among the static proofs and applies the same rules, from
 * scripts/lib/metadata-rules.mjs, to the values the code states.
 *
 * WHAT IT READS, DERIVED RATHER THAN LISTED.
 *   - Every page.tsx under src/app/(site) that calls buildMetadata({ ... }) in
 *     its `metadata` export. A title or description written as a string
 *     literal, or as a field of an imported object (windstormHub.title), is
 *     read. Anything else is counted as not statically known, and the board
 *     covers it.
 *   - Every page.tsx whose generateMetadata maps one content entry, as
 *     `const post = insightBySlug(slug)` then `title: post.title`. The entries
 *     are every element of the content module's exported arrays that the
 *     bySlug function finds, so a new post is read the day it is written.
 * Pages marked noIndex are left out, as seo-audit reads the sitemap only.
 *
 * Each value goes through fitTitle and fitDescription from src/lib/seo.ts,
 * which is what buildMetadata renders, before the rules apply.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { titleProblems, descriptionProblems, duplicateProblems } from "../lib/metadata-rules.mjs";

const ROOT = "src/app/(site)";
/*
 * A literal specifier, so proofs-audit's invocation scan sees that this proof
 * imports TypeScript and runs it under tsx. A computed path hid it, and board
 * 41127255244 ran it under bare node, where the `@/config` alias inside seo.ts
 * cannot resolve.
 */
const { fitTitle, fitDescription } = await import("../../src/lib/seo.ts");

let wrong = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) wrong += 1;
};

function pages(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...pages(p));
    else if (name === "page.tsx") out.push(p);
  }
  return out;
}

/** The route a page file serves, from its directory under src/app/(site). */
function routeOf(file) {
  const rel = file.slice(ROOT.length).replace(/[\\/]page\.tsx$/, "").replace(/\\/g, "/");
  return rel === "" ? "/" : rel;
}

/** The text of the object literal passed to the call starting at `at`. */
function objectAfter(src, at) {
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      const q = c;
      i += 1;
      while (i < src.length && src[i] !== q) i += src[i] === "\\" ? 2 : 1;
      continue;
    }
    if (c === "{") depth += 1;
    if (c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return "";
}

/**
 * The value of one property in an object literal's text: a string literal, a
 * dotted name, or null when it is anything else.
 */
function valueOf(obj, key) {
  const m = new RegExp(`[{,\\s]${key}\\s*:\\s*`).exec(obj);
  if (!m) return null;
  const rest = obj.slice(m.index + m[0].length);
  const str = /^"((?:[^"\\]|\\.)*)"\s*[,}\n]/.exec(rest);
  if (str) return { kind: "literal", value: JSON.parse(`"${str[1]}"`) };
  const tpl = /^`([^`$]*)`\s*[,}\n]/.exec(rest);
  if (tpl) return { kind: "literal", value: tpl[1] };
  const dotted = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*[,}\n]/.exec(rest);
  if (dotted) return { kind: "field", object: dotted[1], field: dotted[2] };
  return { kind: "unknown" };
}

/** The path aliases, read from tsconfig.json rather than typed here. */
const ALIASES = Object.entries(JSON.parse(readFileSync("tsconfig.json", "utf8")).compilerOptions.paths ?? {}).map(
  ([from, [to]]) => [from.replace(/\*$/, ""), to.replace(/\*$/, "")],
);

/** The module a page imports a name from, resolved to a file. */
function moduleOf(src, name) {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop());
    if (!names.includes(name)) continue;
    const spec = m[2];
    const alias = ALIASES.find(([from]) => spec.startsWith(from));
    if (!alias) return null;
    const base = resolve(alias[1], spec.slice(alias[0].length));
    for (const ext of [".ts", ".tsx", "/index.ts"]) if (existsSync(base + ext)) return base + ext;
  }
  return null;
}

const load = async (file) => import(pathToFileURL(file).href);

const entries = [];
let notStatic = 0;
let noIndexed = 0;
const unknownWhere = [];

for (const file of pages(ROOT)) {
  const src = readFileSync(file, "utf8");
  const route = routeOf(file);
  const gen = src.indexOf("function generateMetadata");
  if (gen >= 0) {
    const call = src.indexOf("buildMetadata(", gen);
    if (call < 0) continue;
    const obj = objectAfter(src, call);
    if (/noIndex\s*:\s*true/.test(obj)) {
      noIndexed += 1;
      continue;
    }
    const t = valueOf(obj, "title");
    const d = valueOf(obj, "description");
    const p = /path:\s*`([^`]*)`/.exec(obj);
    const bind = new RegExp(`const\\s+${t?.object}\\s*=\\s*(\\w+)\\(\\s*slug\\s*\\)`).exec(src.slice(gen));
    if (t?.kind !== "field" || d?.kind !== "field" || !p || !bind) {
      notStatic += 1;
      unknownWhere.push(`${route} (generateMetadata)`);
      continue;
    }
    const mod = moduleOf(src, bind[1]);
    if (!mod) {
      notStatic += 1;
      unknownWhere.push(`${route} (${bind[1]} not resolved)`);
      continue;
    }
    const m = await load(mod);
    const bySlug = m[bind[1]];
    const slugs = new Set();
    for (const v of Object.values(m)) {
      if (Array.isArray(v)) for (const e of v) if (e && typeof e.slug === "string") slugs.add(e.slug);
    }
    for (const slug of slugs) {
      const entry = bySlug(slug);
      if (!entry || typeof entry[t.field] !== "string" || typeof entry[d.field] !== "string") continue;
      const path = p[1].replace(/\$\{[^}]*\}/, slug);
      entries.push({ route: path, title: entry[t.field], description: entry[d.field] });
    }
    continue;
  }
  const at = src.indexOf("export const metadata");
  if (at < 0) continue;
  const call = src.indexOf("buildMetadata(", at);
  if (call < 0 || call - at > 80) continue;
  const obj = objectAfter(src, call);
  /* Out of the index either way: buildMetadata's noIndex, or robots set beside it. */
  const whole = objectAfter(src, at);
  if (/noIndex\s*:\s*true/.test(obj) || /robots\s*:\s*\{\s*index\s*:\s*false/.test(whole)) {
    noIndexed += 1;
    continue;
  }
  const resolveValue = async (v) => {
    if (v?.kind === "literal") return v.value;
    if (v?.kind === "field") {
      const mod = moduleOf(src, v.object);
      if (!mod) return null;
      const value = (await load(mod))[v.object]?.[v.field];
      return typeof value === "string" ? value : null;
    }
    return null;
  };
  const title = await resolveValue(valueOf(obj, "title"));
  const description = await resolveValue(valueOf(obj, "description"));
  if (title === null || description === null) {
    notStatic += 1;
    unknownWhere.push(route);
    continue;
  }
  entries.push({ route, title, description });
}

const problems = [];
const titles = new Map();
const descriptions = new Map();
for (const e of entries) {
  const title = fitTitle([e.title]);
  const description = fitDescription(e.description);
  problems.push(...titleProblems(e.route, title), ...descriptionProblems(e.route, description));
  if (!titles.has(title)) titles.set(title, []);
  titles.get(title).push(e.route);
  if (!descriptions.has(description)) descriptions.set(description, []);
  descriptions.get(description).push(e.route);
}
problems.push(...duplicateProblems(titles, descriptions));

console.log(`=== ${entries.length} declared titles and descriptions, ${notStatic} not statically known, ${noIndexed} noIndex left out ===`);
if (unknownWhere.length) console.log(`  not statically known, left to the board: ${unknownWhere.join(", ")}`);
/*
 * The vacuity guard names members, because a count alone passes over a set
 * whose readers broke. The home page and an insights post always exist; /guides
 * is required whenever its page does.
 */
const hasGuides = existsSync(join(ROOT, "guides", "page.tsx"));
check(
  `the set is not empty, and holds the home page, an insights post${hasGuides ? " and /guides" : ""}`,
  entries.length > 0 &&
    entries.some((e) => e.route === "/") &&
    entries.some((e) => e.route.startsWith("/insights/")) &&
    (!hasGuides || entries.some((e) => e.route === "/guides")),
  `${entries.length} read`,
);
check(
  "every declared title and description meets the budget, and none is duplicated",
  problems.length === 0,
  problems.length ? problems.join(" | ") : `${entries.length} of ${entries.length}`,
);

console.log("");
if (wrong === 0) {
  console.log(`PASS: ${entries.length} declared titles and descriptions meet the budget seo-audit holds the rendered pages to.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
