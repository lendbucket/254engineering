/**
 * EVERY ROW, OR A REFUSAL. NEVER THE FIRST THOUSAND.
 *
 * PostgREST answers an unbounded `select("*")` with AT MOST 1000 rows and no
 * error, no warning, and no indication in the response that anything was left
 * behind. A caller that does not page gets a thousand rows and believes it has
 * the table.
 *
 * WHAT THAT COST, AND IT IS THE REASON THIS MODULE EXISTS
 * -------------------------------------------------------
 * `copy-project.mjs` read its source rows with a bare `select("*")` and compared
 * what it got against an EXACT count of the destination:
 *
 *     const { data: rows } = await src.from(t.name).select("*");   // capped at 1000
 *     const { count: destAfter } = await dst.from(t.name)
 *       .select(firstKey, { count: "exact", head: true });         // not capped
 *     const agree = destAfter === rows.length;
 *
 * On a table with 17,500 rows that reads 1000, writes 1000, counts 1000 at the
 * destination, and prints **agree**. It would have copied a thousand of
 * seventeen and a half thousand audit events and reported success.
 *
 * The same cap hit the one check written to be stricter than a count. The audit
 * trail is compared by ID SET rather than by count, because two sets of the same
 * size can differ and that table is the firm's regulatory memory. Both sides of
 * that comparison were capped at 1000, so it printed "id sets identical (1000
 * ids compared one by one)" while 16,500 rows on each side were never looked at.
 *
 * **The strictest check in the file was the one the cap made meaningless**, which
 * is this repository's recurring defect exactly: a check looking at the right
 * subject through a window too small to see it.
 *
 * THE ASSERTION IS THE POINT, NOT THE PAGING
 * -------------------------------------------
 * Paging alone would fix today and not tomorrow. So this reads the EXACT count
 * first and refuses to return unless the number of rows it actually assembled
 * equals it. A future change that reintroduces a cap, or a row deleted midway
 * through the walk, fails loudly rather than returning a short list that looks
 * like a complete one.
 *
 * It is deliberately NOT tolerant of a moving table. A source that changes under
 * a copy is a copy nobody can verify, which is why the cutover freezes writes
 * before it copies anything.
 */

/** PostgREST's own ceiling. Pages are requested at this size, never larger. */
const PAGE = 1000;

/**
 * Read every row of a table, or throw.
 *
 * @param client   a supabase-js client
 * @param table    the table name
 * @param columns  the column list, "*" for all
 * @param options  { orderBy } a column to order by, so paging is stable
 * @returns        every row, with the count asserted against an exact count
 */
export async function readEveryRow(client, table, columns = "*", options = {}) {
  const { count, error: countError } = await client
    .from(table)
    .select(columns.split(",")[0].trim(), { count: "exact", head: true });

  if (countError) {
    throw new Error(`${table}: could not count before reading: ${countError.message}`);
  }

  const expected = count ?? 0;
  if (expected === 0) return [];

  /*
   * ORDERED, because an unordered page boundary is not stable. Without an order
   * PostgREST may return rows in any order between requests, so page two can
   * repeat or skip rows from page one and the total still looks right.
   */
  const orderBy = options.orderBy ?? null;

  const rows = [];
  for (let from = 0; from < expected; from += PAGE) {
    let query = client.from(table).select(columns).range(from, from + PAGE - 1);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const { data, error } = await query;
    if (error) {
      throw new Error(`${table}: page starting at ${from} failed: ${error.message}`);
    }
    rows.push(...(data ?? []));
    /*
     * A page that comes back short before the end means the table moved or the
     * server stopped early. Either way the walk is over and the assertion below
     * is what says so, but breaking here avoids looping forever on an empty page.
     */
    if (!data || data.length === 0) break;
  }

  if (rows.length !== expected) {
    throw new Error(
      `${table}: read ${rows.length} rows against an exact count of ${expected}. ` +
        "A short read is never returned as a complete one: either the table changed " +
        "under the walk, or something capped the response. PostgREST caps an " +
        "unbounded select at 1000 with no error, which is what this function exists " +
        "to make impossible.",
    );
  }

  return rows;
}

/** The exact row count, with the error surfaced rather than folded into zero. */
export async function exactCount(client, table, column = "*") {
  const { count, error } = await client
    .from(table)
    .select(column, { count: "exact", head: true });
  if (error) throw new Error(`${table}: count failed: ${error.message}`);
  return count ?? 0;
}
