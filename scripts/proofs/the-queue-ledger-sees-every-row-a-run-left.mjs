/**
 * PROOF: THE BOARD'S QUEUE LEDGER SEES EVERY ROW A RUN LEFT, HOWEVER LONG THE QUEUE.
 *
 * Found 2026-11-13, pruning development's job queue under Robert's ruling 4.
 * The board printed "removed 25 pending or dead row(s) this run caused" while
 * rows from that very run stayed pending. queueGrowth read the queue with
 * `.limit(5000)`, and PostgREST answers at most 1,000 rows with no error, so
 * with 2,280 rows on the table it saw an arbitrary thousand and called that the
 * queue.
 *
 * The fake client below answers exactly as PostgREST does: never more than
 * 1,000 rows per request, an exact count when asked, and pages when ranged.
 * The queue holds 2,280 rows; the run adds 30 more, with the highest ids, so a
 * capped read never reaches them. Every one must be found and offered for
 * removal, and a read that fails must be COULD NOT TELL (null), never "nothing
 * grew".
 */
import { queueSnapshot, queueGrowth } from "../lib/queue-ledger.mjs";

let wrong = 0;
const check = (name, ok, note) => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? ` (${note})` : ""}`);
};

const CAP = 1000;
function fakeDb(rows, { failAfter = Infinity } = {}) {
  let calls = 0;
  const from = () => {
    const state = { head: false, count: false, range: null, limit: null };
    const q = {
      select(_cols, opts = {}) {
        state.head = Boolean(opts.head);
        state.count = opts.count === "exact";
        return q;
      },
      order() {
        return q;
      },
      range(a, b) {
        state.range = [a, b];
        return q;
      },
      limit(n) {
        state.limit = n;
        return q;
      },
      then(resolve) {
        calls += 1;
        if (calls > failAfter) return resolve({ data: null, error: { message: "injected failure" } });
        if (state.head) return resolve({ data: null, count: state.count ? rows.length : null, error: null });
        let out = [...rows].sort((x, y) => x.id - y.id);
        if (state.range) out = out.slice(state.range[0], state.range[1] + 1);
        if (state.limit != null) out = out.slice(0, state.limit);
        return resolve({ data: out.slice(0, CAP), error: null });
      },
    };
    return q;
  };
  return { from };
}

const existing = Array.from({ length: 2280 }, (_, i) => ({ id: i + 1, kind: "email.send", status: i < 1530 ? "pending" : "done" }));
const db = fakeDb(existing);
const before = await queueSnapshot(db);
check("the snapshot reads every existing row past the cap", before?.size === 2280, `${before?.size}`);

const added = Array.from({ length: 30 }, (_, i) => ({ id: 5000 + i, kind: "email.send", status: i < 27 ? "pending" : "done" }));
const after = fakeDb([...existing, ...added]);
const growth = await queueGrowth(after, before);
check("every row the run added is found, though the table is past the 1,000 cap", growth?.added.length === 30, `${growth?.added.length} of 30`);
check("and every pending one is offered for removal", growth?.removable.length === 27, `${growth?.removable.length} of 27`);

const failing = fakeDb([...existing, ...added], { failAfter: 1 });
check("a read that fails is COULD NOT TELL, never nothing grew", (await queueGrowth(failing, before)) === null, "");

if (wrong) {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exit(1);
}
console.log("PASS: the queue ledger sees every row a run left, past the 1,000 row cap.");
