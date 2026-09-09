import "server-only";

/**
 * EVERY READ THAT RETURNS A LIST SAYS WHETHER IT RETURNED ALL OF IT.
 *
 * Phase 12 Section 3. One helper, because the alternative is twenty two places
 * remembering to pair a count with a read, and the third one is where somebody
 * forgets.
 *
 * THE FACT THIS EXISTS FOR
 * ------------------------
 * PostgREST returns at most a thousand rows and reports nothing when it
 * truncates. Measured on production, 2026-09-09: `eng_audit_events` held 7,421
 * rows and `.select("id")` returned exactly 1,000, no error, nothing on the
 * response to say so.
 *
 * A read that is then counted, summed, grouped or written back is therefore
 * silently WRONG once its matching set passes a thousand. Not slow. Wrong in
 * the flattering direction for a cost and the unflattering one for revenue,
 * and looking entirely ordinary either way.
 *
 * TWO SHAPES, AND THE CHOICE BETWEEN THEM IS THE WHOLE DESIGN
 * -----------------------------------------------------------
 * `readAll` asks for a bounded page and reports whether the set was bigger.
 * The caller then decides, and for a figure the decision is always the same:
 * an absence with a reason rather than a total computed from part of a set.
 * That is the reports module's rule applied everywhere else.
 *
 * `readEvery` pages until the set is exhausted. It is for the cases where a
 * partial answer is not an option: a statement total that gets written back, a
 * period close that claims entries, a permission set. Those cannot say "some of
 * it" and must not guess, so they pay for the extra round trips.
 *
 * WHICH ONE A CALL SITE USES IS A JUDGEMENT ABOUT WHETHER THE FIGURE MAY
 * HONESTLY BE PARTIAL. IT IS NEVER ABOUT SIZE.
 *
 * Operator ruling, 2026-09-09, and it is the rule rather than a preference. A
 * dashboard tile can say "not known" and lose nothing. A customer's invoice
 * total, a partner's balance, a checkout's line items and a permission set
 * cannot: for those, half an answer is not a smaller answer, it is a wrong one
 * that looks ordinary.
 *
 * A small set does not earn `readAll`, and a large one does not force it. The
 * question is only ever what the caller does with the rows.
 *
 * **Every call site states which it uses and why, in one comment line.** Same
 * ruling. The reason is that the choice is not visible from the code: both
 * spellings look identical at a glance, and the judgement behind them is the
 * only thing that says whether the next person may change one to the other.
 */

/**
 * PostgREST's own cap, measured rather than read from documentation.
 *
 * Nothing here should ever ask for more than this in one request: a limit ABOVE
 * the cap is the worst of both, because it reads as a deliberate bound and
 * silently delivers a different one. `chargeLogPeriods` carried `.limit(2000)`
 * and had been quietly losing rows for as long as it existed.
 */
export const READ_CAP = 1000;

/** The default page. Under the cap with room to spare, so the cap is never the bound. */
export const READ_PAGE = 500;

type Result<T> = { data: T[] | null; count: number | null; error: { message: string } | null };

export type BoundedRead<T> =
  | { ok: true; rows: T[]; total: number; complete: boolean }
  | { ok: false; error: string };

/**
 * Read one bounded page, and say how many rows there really were.
 *
 * `complete` is false when the set was larger than the page. A caller deriving
 * a FIGURE from an incomplete read must not state it; a caller rendering a LIST
 * may show the page as long as it says so.
 *
 * The count comes back on the same request, so the true size and the returned
 * size cannot be two answers from two moments.
 */
export async function readAll<T>(query: PromiseLike<Result<T>>): Promise<BoundedRead<T>> {
  const { data, count, error } = await query;
  if (error) return { ok: false, error: error.message };
  const rows = data ?? [];
  const total = count ?? rows.length;
  return { ok: true, rows, total, complete: total <= rows.length };
}

/**
 * Page until the set is exhausted, for answers that cannot be partial.
 *
 * `build` is called with a zero based row range and must return the same query
 * each time with only the range changed. The loop stops when a page comes back
 * short, which is the only reliable signal PostgREST gives.
 *
 * MAX_PAGES is a guard against a query whose page never shrinks, not a bound on
 * the data. It is set far beyond any real set so that reaching it means
 * something is wrong rather than that the firm grew, and reaching it is
 * reported as a failure rather than returning what was collected so far: a
 * partial answer from this function would be the exact defect it exists to
 * prevent.
 */
export async function readEvery<T>(
  build: (from: number, to: number) => PromiseLike<Result<T>>,
  options: { pageSize?: number; maxPages?: number } = {},
): Promise<BoundedRead<T>> {
  const pageSize = Math.min(options.pageSize ?? READ_PAGE, READ_CAP);
  const maxPages = options.maxPages ?? 200;

  const rows: T[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) return { ok: false, error: error.message };
    const got = data ?? [];
    rows.push(...got);
    if (got.length < pageSize) return { ok: true, rows, total: rows.length, complete: true };
  }

  return {
    ok: false,
    error:
      `Reading this set did not finish inside ${maxPages} pages of ${pageSize}, which is ` +
      `${(maxPages * pageSize).toLocaleString("en-US")} rows. Something is wrong with the query ` +
      `rather than with the data, and a partial answer here would be the defect this exists to stop.`,
  };
}

/** The sentence a figure carries when its set was larger than one read. */
export function tooManyRows(what: string, total: number, got: number): string {
  return (
    `${what} matched ${total.toLocaleString("en-US")} records and this read returned ` +
    `${got.toLocaleString("en-US")}, so no figure is stated. A total from part of a set is a ` +
    `plausible number rather than a smaller one, which is worse than saying nothing.`
  );
}
