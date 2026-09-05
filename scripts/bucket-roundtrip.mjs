/**
 * DOES AN ATTACHMENT ACTUALLY ROUND TRIP.
 *
 *   node scripts/bucket-roundtrip.mjs
 *
 * A bucket row saying `public = false` is a claim about configuration. This is
 * the claim tested: put an object in, read it back through a signed url, watch
 * an expired url stop working, and confirm the object is not reachable without
 * a signature at all.
 *
 * The last one is the point. A private bucket that still serves its objects to
 * an unauthenticated GET is a public bucket with a misleading column, and
 * property photographs are what is in it.
 *
 * WHERE THIS CAN RUN
 * ------------------
 * Development, by default and by design. It writes an object and deletes it,
 * and `neverProduction` in db-target refuses production before ALLOW_PRODUCTION_DB
 * is even read, which is the same standing roles-audit and seed-field-demo
 * carry.
 *
 * The production bucket's configuration is verified by reading storage.buckets
 * directly, which writes nothing. The round trip on production needs either the
 * service role key, which standing law keeps out of the working tree, or a
 * signed in portal session. Recorded in BACKLOG rather than quietly skipped.
 */

import { auditClient, describeTarget } from "./lib/db-target.mjs";

const BUCKET = "eng-messages";

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

console.log("");
console.log("================ ATTACHMENT ROUND TRIP ================");
console.log(`${describeTarget(process.env.SUPABASE_URL)}, bucket ${BUCKET}\n`);

const db = auditClient("bucket-roundtrip", { neverProduction: true });
if (!db) {
  console.log("FAIL: no client. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

/* A one pixel jpeg, so nothing here depends on a fixture file existing. */
const PIXEL = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

const key = `roundtrip/${Date.now()}.jpg`;

// ------------------------------------------------------------ configuration
{
  const { data: buckets } = await db.storage.listBuckets();
  const bucket = (buckets ?? []).find((b) => b.name === BUCKET);
  rec("the bucket exists", Boolean(bucket));
  rec("and is private", bucket ? bucket.public === false : false, "a public bucket is the whole risk");
}

// -------------------------------------------------------------------- upload
{
  const { error } = await db.storage.from(BUCKET).upload(key, PIXEL, { contentType: "image/jpeg" });
  rec("an object can be uploaded", !error, error?.message ?? key);
}

// ------------------------------------------------- unauthenticated retrieval
{
  /*
   * THE CHECK THAT MATTERS MOST. The public url form is what somebody would
   * guess, and on a private bucket it must refuse. If this ever returns the
   * image, every property photograph the firm holds is on the open internet.
   */
  const { data } = db.storage.from(BUCKET).getPublicUrl(key);
  const res = await fetch(data.publicUrl, { redirect: "manual" });
  rec(
    "and is NOT served without a signature",
    res.status >= 400,
    `HTTP ${res.status} on the public url form`,
  );
}

// -------------------------------------------------------- signed retrieval
let signedUrl = null;
{
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(key, 60);
  signedUrl = data?.signedUrl ?? null;
  rec("a signed url can be issued", Boolean(signedUrl) && !error, error?.message ?? "");

  if (signedUrl) {
    const res = await fetch(signedUrl);
    const bytes = res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    rec("and it retrieves the object", res.ok, `HTTP ${res.status}`);
    rec(
      "and the bytes are the bytes that went in",
      Boolean(bytes) && bytes.equals(PIXEL),
      bytes ? `${bytes.length} bytes, expected ${PIXEL.length}` : "nothing came back",
    );
  }
}

// ---------------------------------------------------------------- expiry
{
  /*
   * A URL THAT WAS ALIVE AND THEN WAS NOT.
   *
   * The first version asked for a negative lifetime, and the service refused to
   * issue one at all. That proves Supabase will not sign a dead url; it does
   * not prove a live url stops working, which is the property the whole scheme
   * rests on. So this signs a real one second url, uses it while it is valid,
   * waits for it to lapse, and uses it again.
   *
   * Three seconds of waiting is worth it for a check that would otherwise be
   * testing the wrong half.
   */
  const { data } = await db.storage.from(BUCKET).createSignedUrl(key, 1);
  const url = data?.signedUrl ?? null;
  rec("a one second signed url is issued", Boolean(url));

  if (url) {
    const alive = await fetch(url, { redirect: "manual" });
    rec("and works while it is alive", alive.ok, `HTTP ${alive.status}`);

    await new Promise((r) => setTimeout(r, 3000));

    const dead = await fetch(url, { redirect: "manual" });
    rec(
      "and stops working once it has lapsed",
      dead.status >= 400,
      `HTTP ${dead.status} after three seconds, having answered ${alive.status} before`,
    );
  }
}

// --------------------------------------------------------------- teardown
{
  const { error } = await db.storage.from(BUCKET).remove([key]);
  const { data: left } = await db.storage.from(BUCKET).list("roundtrip");
  rec(
    "the probe object was removed",
    !error && (left ?? []).every((f) => !f.name.endsWith(".jpg")),
    `${(left ?? []).length} object(s) left under roundtrip/`,
  );
}

console.log("");
const failed = out.filter((c) => !c.ok);
for (const c of out) console.log(`  ${c.ok ? "PASS" : "FAIL"}: ${c.name}${c.note ? ` (${c.note})` : ""}`);
console.log("");
console.log(
  failed.length
    ? `FAIL: ${failed.length} of ${out.length} checks.`
    : `PASS: ${out.length} checks. An attachment goes in, comes back signed, and cannot be read without one.`,
);
process.exit(failed.length ? 1 : 0);
