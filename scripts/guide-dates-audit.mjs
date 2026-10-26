/**
 * THE GUIDE PAGES' DATES ARE THEIR GIT HISTORY, NEVER TYPED.
 *
 *   node scripts/guide-dates-audit.mjs
 *
 * Robert, 2026-10-25: Article schema on the fourteen guide pages, dated from
 * each page's real git history. The build cannot read git, so the dates sit in
 * src/content/guide-dates.ts, written by scripts/emit-guide-dates.mjs. This
 * derives them again from git, by the declaration in scripts/lib/guide-dates.mjs,
 * and refuses any difference, so a guide edited without re-running the emitter
 * is named here rather than publishing a stale dateModified.
 *
 * It compares the generated file with git, never the file with itself, and pins
 * the fourteen paths as a literal so the declaration cannot shrink.
 */
import { readFileSync } from "node:fs";
import { GUIDES, deriveGuideDates, derivePostDates, lineRange, postBlocks, typedPostDates } from "./lib/guide-dates.mjs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const PINNED = [
  "/what-is-a-structural-engineer",
  "/structural-engineer",
  "/structural-engineer/cost",
  "/structural-engineer/when-you-need-one",
  "/structural-engineer/inspection",
  "/structural-engineer/how-to-choose",
  "/windstorm/before-work-begins",
  "/windstorm/catastrophe-area",
  "/windstorm/completed-construction",
  "/windstorm/re-roofs-and-repairs",
  "/windstorm/appointed-engineers",
  "/windstorm/buying-and-selling",
  "/windstorm/opening-protection",
  "/windstorm/twia-coverage",
];
check(
  "the declaration names exactly the fourteen guide pages Robert listed",
  JSON.stringify(GUIDES.map((g) => g.path).sort()) === JSON.stringify([...PINNED].sort()),
  `${GUIDES.length} declared`,
);

for (const g of GUIDES) {
  for (const s of g.sources) {
    let range = null;
    let error = "";
    try {
      range = lineRange(s);
    } catch (e) {
      error = e.message;
    }
    check(`${g.path}: its source ${s.file}${s.slug ? ` (${s.slug})` : s.from ? " (its block)" : ""} is found`, !error, error || (range ? `lines ${range[0]} to ${range[1]}` : "the whole file"));
  }
}

const text = readFileSync("src/content/guide-dates.ts", "utf8");
const [guideText, postText = ""] = text.split("export const POST_DATES");
const rowsOf = (t) => {
  const out = {};
  for (const m of t.matchAll(/^\s*"([^"]+)": \{ datePublished: "([^"]+)", dateModified: "([^"]+)" \},$/gm)) {
    out[m[1]] = { datePublished: m[2], dateModified: m[3] };
  }
  return out;
};
const recorded = rowsOf(guideText);
const recordedPosts = rowsOf(postText);
check("the generated file records every guide page", PINNED.every((p) => p in recorded), `${Object.keys(recorded).length} recorded`);

let derived = null;
try {
  derived = deriveGuideDates();
} catch (e) {
  check("git history could be read", false, e.message);
}
if (derived) {
  for (const p of PINNED) {
    const r = recorded[p];
    const d = derived[p];
    check(
      `${p}: the published dates are its git history`,
      Boolean(r && d) && r.datePublished === d.datePublished && r.dateModified === d.dateModified,
      r && d
        ? r.datePublished === d.datePublished && r.dateModified === d.dateModified
          ? `${d.datePublished} to ${d.dateModified}`
          : `file says ${r.datePublished} to ${r.dateModified}, git says ${d.datePublished} to ${d.dateModified}; run node scripts/emit-guide-dates.mjs and commit it`
        : "missing",
    );
  }
}

/*
 * THE INSIGHT POSTS (Robert, 2026-10-25): the generated dates are each post's
 * git history, as Chicago days with date-only commits skipped, and a typed
 * date in a post that disagrees with git fails.
 */
const posts = postBlocks();
check("every insight post is found by its slug (the floor is the 35 of 2026-10-25)", posts.length >= 35, `${posts.length} posts`);
let postGit = null;
try {
  postGit = derivePostDates();
} catch (e) {
  check("the posts' git history could be read", false, e.message);
}
if (postGit) {
  const stale = [];
  const typedWrong = [];
  for (const p of posts) {
    const g = postGit[p.slug];
    const r = recordedPosts[p.slug];
    if (!r || r.datePublished !== g.datePublished || r.dateModified !== g.dateModified)
      stale.push(`${p.slug}: file ${r ? `${r.datePublished} to ${r.dateModified}` : "missing"}, git ${g.datePublished} to ${g.dateModified}`);
    const t = typedPostDates(p);
    if (t.datePublished !== g.datePublished || t.dateModified !== g.dateModified)
      typedWrong.push(`${p.slug} (${p.file}): typed ${t.datePublished} to ${t.dateModified}, git ${g.datePublished} to ${g.dateModified}`);
  }
  check(
    `every post's generated dates are its git history (${posts.length} posts)`,
    stale.length === 0,
    stale.length ? `${stale.join("; ")}; run node scripts/emit-guide-dates.mjs and commit it` : "",
  );
  check(
    "and no typed post date disagrees with git",
    typedWrong.length === 0,
    typedWrong.length ? `${typedWrong.join("; ")}; write the git date into the typed field` : "",
  );
  check("and the generated file lists no post that does not exist", Object.keys(recordedPosts).every((s) => s in postGit), Object.keys(recordedPosts).filter((s) => !(s in postGit)).join(", "));
}

console.log("");
if (wrong === 0) {
  console.log(`PASS: the ${PINNED.length} guide pages publish the dates their git history gives.`);
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
