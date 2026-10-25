/**
 * HOW ORDERING WORKS SHOWS WHAT THE LINE'S STATE SAYS, AND NO UNENFORCED TIME.
 *
 * Operator ruling 7 of 2026-10-18, built under Q8 of 2026-10-19: a section on
 * every service page that walks the buyer through the real process for that
 * line, from what the code and the signed protocol do, the quote path for a
 * line that is not orderable, and "if a turnaround isn't enforced in the app,
 * don't print a number".
 *
 * Four things are asserted, and the last is the reason this file exists:
 *
 *   1. every service line gets the steps its state names, for the state the
 *      gate is in when this runs, which the output states
 *   2. an orderable line shows only steps written for it, never another
 *      protocol's, and a line with no written steps shows none
 *   3. every line with a brief form of its own has steps written for it
 *   4. no step anywhere carries a number beside a unit of time, checked with
 *      the matcher the content file exports, after that matcher is handed a
 *      sentence it exists to refuse and shown to match it, because a pattern
 *      that matches nothing passes this check perfectly
 */
import {
  ORDERABLE_STEPS,
  QUOTE_FORM_STEPS,
  QUOTE_STEPS,
  WAITLIST_STEPS,
  TIMEFRAME,
  allOrderingSteps,
  orderingStepsFor,
} from "../../src/content/ordering-steps.ts";
import { QUOTE_FORMS, lineOffer } from "../../src/lib/ordering.ts";
import { services } from "../../src/content/services.ts";
import { isOpen, isPrelaunch } from "../../src/lib/launch.ts";

let failed = 0;
const rec = (name, ok, note = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const mode = isPrelaunch() ? "prelaunch" : isOpen() ? "open" : "trading";
rec("there are service lines to check", services.length >= 8, `${services.length} line(s); the gate reads ${mode}`);

/* 1 and 2. Each line's steps are the set its state names. */
const wrong = [];
for (const s of services) {
  const { state, steps } = orderingStepsFor(s.slug);
  if (state !== lineOffer(s.slug).state) wrong.push(`${s.slug}: steps chose ${state}, the action chose ${lineOffer(s.slug).state}`);
  const expected =
    state === "orderable"
      ? (ORDERABLE_STEPS[s.slug] ?? [])
      : state === "quote-form"
        ? (QUOTE_FORM_STEPS[s.slug] ?? QUOTE_STEPS)
        : state === "waitlist"
          ? WAITLIST_STEPS
          : QUOTE_STEPS;
  if (steps !== expected) wrong.push(`${s.slug} (${state}): shows a different set from the one its state names`);
  if (state === "orderable" && !ORDERABLE_STEPS[s.slug]) wrong.push(`${s.slug}: orderable with no steps written for it`);
}
rec(
  "every line shows the steps its state names, the same state that picks its action",
  wrong.length === 0,
  wrong.slice(0, 4).join(" | ") ||
    services.map((s) => `${s.slug}=${orderingStepsFor(s.slug).state}`).join(", "),
);

/* An orderable line's steps belong to a real line. */
const strays = Object.keys(ORDERABLE_STEPS).filter((slug) => !services.some((s) => s.slug === slug));
rec("every written walk-through names a real service line", strays.length === 0, strays.join(", ") || `${Object.keys(ORDERABLE_STEPS).length} line(s)`);

/* 3. A brief form of its own has its own steps. */
const unwritten = Object.keys(QUOTE_FORMS).filter((slug) => !QUOTE_FORM_STEPS[slug]);
rec(
  "every line with a brief form of its own has its steps written",
  unwritten.length === 0,
  unwritten.join(", ") || Object.keys(QUOTE_FORMS).join(", "),
);

/* 4. The matcher works, then nothing matches it. */
const refuses = [
  "The visit is scheduled within 2 business days.",
  "Most lenders treat one as current for six to twelve months",
  "Review takes a few days.",
  "Turnaround is ten business days.",
];
const missed = refuses.filter((t) => !TIMEFRAME.test(t));
rec("the timeframe matcher refuses each sentence it exists for", missed.length === 0, missed.join(" | ") || `${refuses.length} of ${refuses.length}`);

const steps = allOrderingSteps();
const timed = steps.filter((s) => TIMEFRAME.test(`${s.name} ${s.text}`)).map((s) => `${s.id}: ${s.text}`);
rec(
  "and no step carries a number beside a unit of time",
  timed.length === 0,
  timed.slice(0, 3).join(" | ") || `${steps.length} step(s) read`,
);

if (failed > 0) process.exitCode = 1;
