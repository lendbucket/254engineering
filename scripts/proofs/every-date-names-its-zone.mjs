/**
 * EVERY DATE THE PRODUCT PRINTS NAMES ITS TIME ZONE. Operator ruling, 2026-10-09.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/proofs/every-date-names-its-zone.mjs
 *
 * The product audit found 39 server rendered date calls naming no zone. A server
 * renders in its own zone and Vercel's is UTC, so an instant after about 7 pm
 * Central printed as the next day, including on sealed records, statements and
 * payouts. The ruling: one shared formatter pinning FIRM_TIME_ZONE
 * (formatInFirmZone in src/lib/firm-calendar.ts), every call site moved to it,
 * a check that fails the board on any toLocaleDateString, toLocaleString or
 * Intl.DateTimeFormat call without a timeZone, no exemption for server code,
 * and a test that renders 2026-10-09 23:30 CT and expects October 9.
 *
 * TWO HALVES.
 *
 * 1. THE TEST, in a child process with TZ=UTC, which is how Vercel renders. It
 *    first proves its own premise, that formatting the instant with no zone in
 *    that process prints October 10, so the test cannot pass by running
 *    somewhere the defect does not show.
 *
 * 2. THE CHECK, by the TypeScript type checker rather than by text. A call is a
 *    DATE call when its method only exists on Date (toLocaleDateString,
 *    toLocaleTimeString), when it is Intl.DateTimeFormat, or when it is
 *    toLocaleString on a receiver whose type is not a number. Every date call
 *    must pass an options object literal carrying a timeZone property. A
 *    toLocaleString on a NUMBER (money, row counts) has no zone to name, and is
 *    told apart by the receiver's type, which is a property of the code rather
 *    than a list anybody can grow; those are counted and named in the output. A
 *    receiver whose type cannot be resolved counts as a date: the check fails
 *    closed.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SELF = fileURLToPath(import.meta.url);

if (process.env.EVERY_DATE_CHILD === "1") {
  /* The child: TZ=UTC, as on Vercel. One line back to the parent. */
  const { formatInFirmZone, formatCalendarDate } = await import("../../src/lib/firm-calendar.ts");
  const instant = "2026-10-10T04:30:00Z"; /* 2026-10-09 23:30 Central (CDT, UTC-5) */
  const naive = new Date(instant).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: undefined });
  const pinned = formatInFirmZone(instant, { month: "long", day: "numeric", year: "numeric" });
  const calendar = formatCalendarDate("2026-10-09", { month: "long", day: "numeric", year: "numeric" });
  console.log(`CHILD ${JSON.stringify({ tz: process.env.TZ, offset: new Date(instant).getTimezoneOffset(), naive, pinned, calendar })}`);
  process.exit(0);
}

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

// ------------------------------------------------------------------ 1. the test
{
  const tsx = "node_modules/tsx/dist/cli.mjs";
  const r = spawnSync(process.execPath, [tsx, SELF], { env: { ...process.env, TZ: "UTC", EVERY_DATE_CHILD: "1" }, encoding: "utf8" });
  const line = (r.stdout ?? "").split("\n").find((l) => l.startsWith("CHILD "));
  const got = line ? JSON.parse(line.slice(6)) : null;
  check("the child process renders in UTC, as Vercel does", got?.offset === 0, got ? `TZ=${got.tz}, offset ${got.offset}` : `no answer: ${(r.stderr ?? "").slice(0, 200)}`);
  check("and there, a date formatted with no zone prints the wrong day, so the test below is about something", got?.naive === "October 10, 2026", got?.naive ?? "none");
  check("2026-10-09 23:30 CT renders as October 9 through the shared formatter", got?.pinned === "October 9, 2026", got?.pinned ?? "none");
  check("and a calendar date, 2026-10-09, stays October 9", got?.calendar === "October 9, 2026", got?.calendar ?? "none");
}

// ------------------------------------------------------------------ 2. the check
{
  const ts = (await import("typescript")).default;
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
  const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, process.cwd());
  const program = ts.createProgram({ rootNames: parsed.fileNames.filter((f) => /[\\/]src[\\/]/.test(f)), options: { ...parsed.options, noEmit: true } });
  const checker = program.getTypeChecker();

  const dates = [];
  const numbers = [];
  const missing = [];
  const hasZone = (arg) =>
    Boolean(arg) && ts.isObjectLiteralExpression(arg) && arg.properties.some((p) => p.name && ts.isIdentifier(p.name) && p.name.text === "timeZone");
  const where = (sf, node) => `${sf.fileName.replace(/^.*?[\\/]src[\\/]/, "src/")}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;

  for (const sf of program.getSourceFiles()) {
    if (!/[\\/]src[\\/]/.test(sf.fileName) || sf.isDeclarationFile) continue;
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const name = node.expression.name.text;
        if (name === "toLocaleDateString" || name === "toLocaleTimeString" || name === "toLocaleString") {
          const t = checker.getTypeAtLocation(node.expression.expression);
          const isNumber = name === "toLocaleString" && (t.flags & (ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike)) !== 0;
          if (isNumber) numbers.push(where(sf, node));
          else {
            dates.push(where(sf, node));
            if (!hasZone(node.arguments[1])) missing.push(where(sf, node));
          }
        }
      }
      const isIntl = (expr) => ts.isPropertyAccessExpression(expr) && expr.name.text === "DateTimeFormat" && ts.isIdentifier(expr.expression) && expr.expression.text === "Intl";
      if ((ts.isNewExpression(node) || ts.isCallExpression(node)) && isIntl(node.expression)) {
        dates.push(where(sf, node));
        if (!hasZone(node.arguments?.[1])) missing.push(where(sf, node));
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  check("the check had source to read", program.getSourceFiles().length > 100 && dates.length > 0, `${dates.length} date call(s) found`);
  check(
    "every date formatting call names a timeZone (toLocaleDateString, toLocaleTimeString, toLocaleString on a non-number, Intl.DateTimeFormat)",
    missing.length === 0,
    missing.length ? `NO ZONE: ${missing.join(", ")}` : `${dates.length} of ${dates.length}`,
  );
  console.log(`  note: ${numbers.length} toLocaleString call(s) on a number, told apart by type, none a date: ${numbers.join(", ")}`);
}

console.log("");
if (wrong === 0) {
  console.log("PASS: every date the product prints names its time zone, and 23:30 CT on October 9 is October 9.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
