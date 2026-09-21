/**
 * ===========================================================================
 * THE SCOPE RULE IS THE DATE OF THE WORK, NOT THE YEAR THE HOUSE WENT UP.
 * ===========================================================================
 *
 * This proof exists because the first encoding got it backwards and the defect
 * was invisible from the code: a function that asks for a construction year and
 * compares it to 1988 looks entirely reasonable, and turns away the commonest
 * legitimate enquiry this form receives.
 *
 * THE CASE THAT DECIDES IT is the one the firm's own published page uses:
 *
 *   "A roof replaced last year on a house built in 1975 is work done on or
 *    after January 1, 1988, and subsection (a) reaches it."
 *
 * So the first case below is not an example, it is the rule. A 1975 house with
 * a 2021 reroof is IN SCOPE, and any version of this function that says
 * otherwise is the defect returning.
 *
 * THE AUTHORITY IS SECOND HAND AND IS NAMED AS SUCH. This rests on
 * /insights/twia-coverage-homes-built-before-1988 reading Tex. Ins. Code
 * 2210.251. That page was written by a session and has not been checked against
 * the statute by a person. It is in the bundle for the engineer of record.
 *
 * Run standalone, no server and no database:
 *   npx tsx scripts/proofs/windstorm-scope-is-the-date-of-the-work.mjs
 */
import {
  windstormScopeVerdict,
  WINDSTORM_WORK_IN_SCOPE_YEAR,
  WINDSTORM_WORK_IN_SCOPE_FROM,
} from "../../src/lib/windstorm-inquiry.ts";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

console.log("");
console.log("======== THE DATE OF THE WORK, NOT THE YEAR OF THE HOUSE ========");
console.log("");

/* ---- the case the rule turns on ---- */
{
  const v = windstormScopeVerdict([{ what: "Roof replaced", year: 2021 }]);
  check(
    "a 1975 house with a 2021 reroof is IN SCOPE",
    v.state === "in_scope",
    `${v.state}. The house's own year is not an input, which is the point.`,
  );
  check(
    "and the reason names the year of the WORK",
    v.state === "in_scope" && v.because.includes("2021"),
    v.because.slice(0, 70),
  );
  check(
    "and the qualifying work is named rather than counted",
    v.state === "in_scope" && v.inScope.length === 1 && v.inScope[0].what === "Roof replaced",
    "a verdict that cannot say WHICH work qualifies cannot be acted on",
  );
}

/* ---- the boundary, which moved when the rule was corrected ---- */
{
  const onTheLine = windstormScopeVerdict([{ what: "Addition", year: WINDSTORM_WORK_IN_SCOPE_YEAR }]);
  check(
    `work in ${WINDSTORM_WORK_IN_SCOPE_YEAR} itself is IN SCOPE, because the statute says on or after`,
    onTheLine.state === "in_scope",
    `${onTheLine.state}. The first encoding excluded this year entirely, which is a calendar year of enquiries.`,
  );
  const justBefore = windstormScopeVerdict([{ what: "Addition", year: WINDSTORM_WORK_IN_SCOPE_YEAR - 1 }]);
  check(
    `and work in ${WINDSTORM_WORK_IN_SCOPE_YEAR - 1} is not`,
    justBefore.state === "all_pre_1988",
    justBefore.state,
  );
  check(
    "and the line is stated as a date rather than only a year",
    WINDSTORM_WORK_IN_SCOPE_FROM === "1988-01-01",
    WINDSTORM_WORK_IN_SCOPE_FROM,
  );
}

/* ---- the operator's case: work either side of the line, on one structure ---- */
{
  /*
   * A 1985 ADDITION AND A 2021 REROOF. The case the operator named, and it is
   * sharper than the 1975 house above because BOTH dates are work rather than
   * one being the building's age: one falls before the line and one after, on
   * the same structure, and the structure is in scope.
   *
   * This is what "a structure can have more than one" means where it bites. A
   * rule that took the earliest date, or that required every date to qualify,
   * would refuse this and would look entirely reasonable doing it.
   */
  const v = windstormScopeVerdict([
    { what: "Addition", year: 1985 },
    { what: "Roof replaced", year: 2021 },
  ]);
  check(
    "a 1985 addition and a 2021 reroof puts the structure IN SCOPE",
    v.state === "in_scope",
    `${v.state}. One date each side of the line, and the later one decides.`,
  );
  check(
    "and only the 2021 work is named as qualifying",
    v.state === "in_scope" && v.inScope.length === 1 && v.inScope[0].year === 2021,
    v.state === "in_scope" ? v.inScope.map((w) => w.year).join(", ") : "no verdict",
  );
  /*
   * AND THE STORED COLUMN CARRIES THE SAME ANSWER. The table keeps one year,
   * `most_recent_work_year`, and the route writes the most recent. That is
   * exact rather than a shortcut, and this asserts the equivalence: the verdict
   * on the whole list matches the verdict on the most recent alone.
   */
  const stored = windstormScopeVerdict([{ what: "Roof replaced", year: 2021 }]);
  check(
    "and storing only the most recent year gives the same verdict",
    stored.state === v.state,
    `list ${v.state}, most recent alone ${stored.state}`,
  );
}

/* ---- a structure can have more than one date ---- */
{
  const v = windstormScopeVerdict([
    { what: "Original construction", year: 1961 },
    { what: "Windows replaced", year: 2019 },
  ]);
  check(
    "one qualifying piece of work puts the structure in scope, however old the rest",
    v.state === "in_scope",
    "the enquiry turns on whether ANY date reaches the line, not on the oldest",
  );
  check(
    "and the pre-1988 work is not what the verdict names",
    v.state === "in_scope" && v.inScope.every((w) => w.year >= WINDSTORM_WORK_IN_SCOPE_YEAR),
    "naming the 1961 work as qualifying would be the old defect wearing the new shape",
  );
}

/* ---- absent is not a refusal ---- */
{
  const undated = windstormScopeVerdict([{ what: "A reroof at some point" }]);
  check(
    "work nobody has dated is UNDATED rather than out of scope",
    undated.state === "undated",
    `${undated.state}. A person who cannot date their reroof is the ordinary case.`,
  );
  check(
    "and the reason says where the date comes from instead of memory",
    undated.state === "undated" && /permit|appraisal/i.test(undated.because),
    undated.because.slice(0, 60),
  );

  const none = windstormScopeVerdict([]);
  check("an empty list is undated rather than in scope", none.state === "undated", none.state);
}

/* ---- every pre-1988 case is a conversation, not a refusal ---- */
{
  const v = windstormScopeVerdict([{ what: "Original construction", year: 1962 }]);
  check(
    "all pre-1988 work is not told it cannot be certified",
    v.state === "all_pre_1988" && !/cannot be certified/i.test(v.because),
    "pre-1988 work may be eligible WITHOUT inspection, which is a better answer than a certification",
  );
}

console.log("");
if (wrong === 0) {
  console.log("PASS: the rule reads the date of the work. A 1975 house with a 2021 reroof is in scope.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} case(s) wrong.`);
  console.log("");
  console.log("If the first case failed, the construction-year test has come back.");
  process.exitCode = 1;
}
