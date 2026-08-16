import { readFileSync } from "node:fs";

/**
 * "Is the server at this URL serving the build currently on disk?"
 *
 * This is the other half of the build guard. Once a torn artifact exists, or
 * once a stale server is holding the port, the audit is the thing that would
 * have caught it and instead confirms it: a stale server answers 200 on every
 * route it knew about, which is precisely what a crawl checks.
 *
 * Next generates BUILD_ID during `next build` to identify which version of the
 * application is being served, and it appears in the served HTML. Comparing it
 * against `.next/BUILD_ID` is a direct answer to "am I testing what I built".
 *
 * It lives in one module because every audit that reads the shared server calls
 * it. A check that exists in two copies is a check that drifts, and the failure
 * it guards against is one where two signals already agree on the wrong answer.
 */
export async function checkServingCurrentBuild(base) {
  // Only meaningful against a server built from this working copy. Pointing a
  // harness at a deployed origin is legitimate and has no local artifact to
  // compare against.
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(base);
  if (!isLocal) {
    return { ok: true, skipped: true, message: `${base} is not local, skipping the stale-server check.` };
  }

  let onDisk = null;
  try {
    onDisk = readFileSync(new URL("../../.next/BUILD_ID", import.meta.url), "utf8").trim();
  } catch {
    return {
      ok: true,
      skipped: true,
      message: "no .next/BUILD_ID on disk, skipping the stale-server check.",
    };
  }

  let html = "";
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(15000) });
    html = await res.text();
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      message:
        `Nothing is answering at ${base}.\n${err.message}\n\n` +
        `Start the server against the current build first:\n` +
        `  npm run build && npx next start -p 3225\n`,
    };
  }

  if (!html.includes(onDisk)) {
    return {
      ok: false,
      skipped: false,
      message:
        `${base} is not serving the build in .next (BUILD_ID ${onDisk}).\n\n` +
        `A server started before the last build is still holding the port. Every\n` +
        `check would describe that older artifact, and would pass, which is the\n` +
        `failure this preflight exists to prevent.\n\n` +
        `\`npm run build-guard\` will name the process holding it.\n`,
    };
  }

  return { ok: true, skipped: false, message: `serving build ${onDisk}.` };
}
