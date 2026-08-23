// Keyword registry integrity.
//
//   npm run registry-audit
//
// WHY A REGISTRY NEEDS ITS OWN AUDIT
// ----------------------------------
// data/keyword-registry.ts is consulted before any page or post is written on
// any of the three brands, and it is trusted. A registry that contradicts itself
// is therefore worse than no registry at all: the check still runs, still
// returns an answer, and the answer is arbitrary.
//
// It also runs against the live sites, because the registry makes claims about
// them ("this term is live at this path on this brand") and those claims decay.
// A `live` entry pointing at a 404 is a decision recorded about a page that no
// longer exists.
//
// Runs under tsx because the registry is TypeScript and is imported by app code
// as well as by this script. Two copies of the data would be the same defect
// this file exists to prevent.
import { registry, BRANDS, duplicateOwners } from "../data/keyword-registry.ts";

const CHECK_LIVE = process.env.REGISTRY_SKIP_LIVE !== "1";

const problems = [];
const notes = [];

// ---------- self consistency ----------

const dupes = duplicateOwners();
for (const d of dupes) {
  problems.push(`"${d.keyword}" is claimed by more than one brand: ${d.owners.join(", ")}`);
}

const seen = new Set();
for (const entry of registry) {
  const key = `${entry.keyword.toLowerCase()}|${entry.owner}`;
  if (seen.has(key)) problems.push(`duplicate row for "${entry.keyword}" under ${entry.owner}`);
  seen.add(key);

  if (!BRANDS[entry.owner]) problems.push(`"${entry.keyword}" has unknown owner "${entry.owner}"`);

  // A concession without a reason is a decision nobody can review later, which
  // is how a future session re-targets a term and calls it an improvement.
  if (entry.status === "conceded" && !entry.note) {
    problems.push(`"${entry.keyword}" is conceded with no note explaining why`);
  }

  // A live entry has to say where it lives.
  if (entry.status === "live" && !entry.path) {
    problems.push(`"${entry.keyword}" is marked live but carries no path`);
  }

  // Pattern entries use braces. They are not URLs and must not be checked as
  // such, but they must be marked so a reader does not treat them as literals.
  const isPattern = /[{}]/.test(entry.keyword) || /[{}]/.test(entry.path ?? "");
  if (isPattern && !entry.note) {
    problems.push(`"${entry.keyword}" is a pattern entry with no note explaining the pattern`);
  }
}

notes.push(`${registry.length} entries`);
for (const brand of Object.keys(BRANDS)) {
  const owned = registry.filter((e) => e.owner === brand);
  notes.push(
    `${BRANDS[brand].name}: ${owned.length} terms (${owned.filter((e) => e.status === "live").length} live, ${owned.filter((e) => e.status === "planned").length} planned, ${owned.filter((e) => e.status === "conceded").length} conceded to it)`,
  );
}

// ---------- the claims about live pages ----------

if (CHECK_LIVE) {
  const checked = registry.filter(
    (e) => e.status === "live" && e.path && !/[{}]/.test(e.path),
  );
  // One request per distinct URL rather than per entry, since several terms
  // legitimately share a page.
  const urls = new Map();
  for (const e of checked) {
    const url = `https://${BRANDS[e.owner].domain}${e.path === "/" ? "" : e.path}`;
    if (!urls.has(url)) urls.set(url, []);
    urls.get(url).push(e.keyword);
  }

  /**
   * Fetch with retries, because this audit reads three independently deployed
   * sites.
   *
   * A single shot fetch failed this repo's suite on a URL that was live before
   * the run and live after it: the sibling brand happened to be mid deploy, the
   * page 404ed for a few seconds, and a green build was reported red for a
   * defect that never existed. An audit that fails on somebody else's rollout
   * teaches people to ignore it, which costs more than the check is worth.
   *
   * Three attempts with a short backoff. A page that is genuinely gone stays
   * gone across all three, and the reported status is the last one seen so the
   * failure still names what happened.
   */
  async function statusOf(url) {
    let last = "no response";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (res.status === 200) return { ok: true };
        last = `HTTP ${res.status}`;
      } catch (err) {
        last = err.message;
      }
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    return { ok: false, last };
  }

  for (const [url, keywords] of urls) {
    const result = await statusOf(url);
    if (!result.ok) {
      problems.push(
        `${url} answers ${result.last} on three attempts, claimed live for: ${keywords.join(", ")}`,
      );
    }
  }
  notes.push(`${urls.size} distinct live URLs verified across three brands`);
} else {
  notes.push("live URL check skipped (REGISTRY_SKIP_LIVE=1)");
}

// ---------- report ----------

console.log("=== KEYWORD REGISTRY AUDIT ===");
for (const n of notes) console.log(`  ${n}`);

console.log("\n=== RESULT ===");
if (problems.length === 0) {
  console.log("PASS: the registry is self consistent and every live claim resolves.");
} else {
  console.log(`${problems.length} problem(s):`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exitCode = 1;
}
