/**
 * LOAD THE SAME ENVIRONMENT THE SERVER READS, BEFORE ANYTHING READS IT.
 *
 * Operator ruling, 2026-09-17, after `placeholder-audit` reported 155 findings
 * that were all one thing: "unexpected phone number (this site publishes none)".
 *
 * THE DEFECT, AND ITS SIBLING ALREADY HAD IT WRITTEN DOWN. `scripts/lib/db-target.mjs`
 * carries this in its own header: "an audit that decides what the database can
 * do by reading its own environment, while the server it is testing reads
 * .env.local, is an audit measuring a different system". That was recorded about
 * forms-audit and a database. It is the same defect here about a phone number.
 *
 * `next dev` and `next build` load `.env.local`. A script run with `npx tsx`
 * does not. So the server rendered the firm's telephone number and the audit,
 * reading an empty `FIRM_PHONE`, judged every occurrence against an allowlist
 * that could not contain it.
 *
 * THE SHARPER HALF, WHICH IS WHY THIS FILE EXISTS RATHER THAN A ONE LINE FIX.
 * `placeholder-audit` has two branches for a phone number it does not recognise:
 *
 *   PERMITTED_PHONE_DIGITS.size === 0   "this site publishes none"
 *   otherwise                           "not the configured FIRM_PHONE"
 *
 * The second branch is the one that matters. It is the check that would catch a
 * wrong number published to every visitor, and because the set has been empty in
 * every ordinary run since it was written, **it has never once executed**. The
 * audit's own comment says both directions are injection verified, and the
 * direction that could be verified was the one where the set is empty.
 *
 * That is the vacuous green again, hiding behind a configuration difference
 * rather than behind a cap, a fixture or an empty table. The question this
 * repository asks of every green applies exactly: what was it green OVER.
 *
 * IMPORT THIS FIRST. ES modules evaluate their dependencies in declaration
 * order, so a side effect import placed above the others runs before any module
 * that reads `process.env` at load time. `src/config/contact.ts` is exactly such
 * a module, which is why the ordering is load bearing rather than tidy.
 */
import { existsSync } from "node:fs";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}
