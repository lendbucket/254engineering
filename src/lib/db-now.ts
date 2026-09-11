/**
 * WHEN SOMETHING HAPPENED IS THE DATABASE'S ANSWER, NEVER THIS PROCESS'S.
 *
 * Operator ruling, 2026-09-09: no recorded timestamp anywhere comes from the
 * machine. Every planned_at, sent_at, sealed_at is the database's now().
 *
 * WHAT PROVOKED IT
 * -----------------
 * queue-audit measured the two clocks and found this machine running 85 seconds
 * ahead of the database. Not drifting: 85 seconds, consistently, on every
 * reading. Everything the queue decides is decided by the DATABASE's now() and
 * everything the application stamped was written with the machine's, and the
 * gap had already produced two defects before anybody measured it.
 *
 *   Phase 8 Section 2  Four jobs were enqueued and a batch run milliseconds
 *                      later claimed none of them. run_after had been written
 *                      a second ahead of the database's now(), so rows meant to
 *                      be eligible immediately were not.
 *   Phase 12 Section 4 A probe lease written at "a minute ago" on this machine
 *                      had not expired on the database. The audit reported that
 *                      a crashed worker's job is never reclaimed. It is.
 *
 * Both were found as puzzles rather than as clock problems, which is what a
 * clock problem looks like from inside.
 *
 * THE COST IS NOT THE 85 SECONDS
 * -------------------------------
 * A resynced machine makes the gap small, and small is not zero. The real cost
 * is that "when did this happen" then has two possible answers depending on
 * which host wrote the row, and a record of when money moved or when a document
 * was sealed cannot have two possible answers. Deployments run on Vercel's
 * machines rather than this one, and nothing anybody does here fixes the clock
 * on a serverless instance that came up thirty seconds ago.
 *
 * HOW IT WORKS, AND WHY IT IS A STRING
 * -------------------------------------
 * PostgREST sends JSON, so there is no way to pass `now()` as a function call.
 * There does not need to be. Postgres accepts the literal string 'now' as input
 * to any date or time type and resolves it to `transaction_timestamp()`, the
 * database's clock at the moment the statement runs.
 *
 *   insert into t (a) values ('now')  ->  a = transaction_timestamp()
 *
 * So the value below travels as an ordinary string, the database evaluates it,
 * and the row carries a time this process never knew. Verified against the
 * development database rather than taken from documentation.
 *
 * WHAT THIS IS NOT FOR
 * ---------------------
 * A time that is COMPUTED rather than observed. A due date thirty days out, a
 * retention cutoff, a lease expiry, a backoff: those are arithmetic on a moment
 * and the arithmetic happens here. They keep their Date objects, and the
 * argument for that is the same one: an arithmetic result is a value the
 * application decided, and it should look like one.
 *
 * The exception inside the exception is anything the CLAIM compares against.
 * ops-jobs already learned that and says so: run_after is left out of the
 * insert entirely so the column's own default applies, which is the database
 * stamping it, which is this rule reached by a different road.
 */

/**
 * The database's own clock, as a value that can be sent in a row.
 *
 * Typed as a plain string so it goes anywhere a timestamp column is written,
 * and named so a reader who has never seen this trick asks the question rather
 * than assuming somebody left a placeholder in.
 */
export const DB_NOW = "now";
