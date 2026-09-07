/**
 * ENUMERATE EVERY OBJECT IN A BUCKET, INCLUDING THE ONES IN FOLDERS.
 *
 * WHY THIS IS ITS OWN MODULE
 * --------------------------
 * It was six lines inside copy-project.mjs, and those six lines were wrong in a
 * way that made the cutover's storage verification meaningless. A function that
 * a whole step depends on, living inside a script that cannot be imported
 * because it exits on load, is a function nothing can test.
 *
 * THE DEFECT IT REPLACES, RECORDED BECAUSE IT WILL LOOK OBVIOUS LATER
 * -------------------------------------------------------------------
 * Supabase's `list(prefix)` is NOT recursive. It returns the entries directly
 * at that prefix, and an object nested below one appears only as its top
 * FOLDER, which arrives with `id: null`.
 *
 * copy-project.mjs called `list("")` and then filtered with
 * `.filter(f => f.id !== null)`, which is exactly the line that removed the
 * folder rather than descending into it. Production's two objects are at
 * `254/<uuid>/resume-*.pdf`, three levels down, so the enumeration found zero
 * files, `--apply` copied nothing, and the verification compared zero against
 * zero and printed "agree".
 *
 * That is this repository's defect class in its purest form: not a check that
 * failed, but a check whose green and red both meant nothing, because both
 * sides of its comparison came from the same blind instrument.
 *
 * TWO PROPERTIES THIS HAS THAT THE OLD CODE DID NOT
 * -------------------------------------------------
 * It descends, and it paginates. The old call passed `limit: 1000` with nothing
 * behind it, which silently truncates at the one moment somebody is relying on
 * it to be complete.
 */

/** A page size small enough that the pagination path is exercised in real use. */
const PAGE = 100;

/**
 * Every object in the bucket, as `{ name, metadata }` with `name` the full key.
 *
 * Throws rather than returning an empty array on error, because "the bucket is
 * empty" and "the bucket could not be read" are the two answers that must never
 * be confused here. Returning [] for both is how the original defect stayed
 * invisible.
 */
export async function walkBucket(client, bucket, prefix = "") {
  const found = [];

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset });

    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    const page = data ?? [];

    for (const entry of page) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      /*
       * id null means a folder, and descending into it is the entire point.
       * The old code's filter removed these, which is why it was silently
       * correct about the wrong thing.
       */
      if (entry.id === null) found.push(...(await walkBucket(client, bucket, path)));
      else found.push({ name: path, metadata: entry.metadata });
    }

    /* A short page is the last page. */
    if (page.length < PAGE) break;
  }

  return found;
}

/**
 * What the OLD code did, kept so a test can show the difference rather than
 * describe it.
 *
 * Exported deliberately. A fix whose proof consists of asserting the new
 * behaviour proves the new behaviour and says nothing about whether the old one
 * was actually broken. Running both against the same bucket does.
 */
export async function walkBucketTheOldWay(client, bucket) {
  const { data } = await client.storage.from(bucket).list("", { limit: 1000 });
  return (data ?? []).filter((f) => f.id !== null);
}
