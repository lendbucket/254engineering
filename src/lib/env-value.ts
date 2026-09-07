/**
 * An environment variable that is SET AND EMPTY is not a value.
 *
 * WHAT WAS WRONG, FOUND 2026-09-06 IN A SCREENSHOT
 * -------------------------------------------------
 * The portal footer renders `RELEASE · <the environment label>`. On the
 * operator's machine it rendered " · local on the development database", with
 * nothing at all where the commit should be, and it had been doing that for as
 * long as the footer existed.
 *
 * RELEASE was written as
 *
 *   process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? process.env.SENTRY_RELEASE ?? "local"
 *
 * and `vercel env pull` writes VERCEL_GIT_COMMIT_SHA= with nothing after it,
 * because a local checkout has no deployment commit. An empty string is not
 * null and not undefined, so `?.` produces "" and `??` keeps it. Every fallback
 * behind it is dead. The same shape was in sentry-config's release(), where a
 * fault would have been tagged with an empty release, which groups worse than
 * no tag at all because it looks like a real value.
 *
 * This is the recurring defect in one line of code: `??` asks whether a value
 * EXISTS, and every one of these places meant to ask whether it SAYS anything.
 *
 * It is a function rather than a rule to remember, so the next variable read
 * this way cannot get it wrong.
 */
export function firstNonEmpty(...values: (string | undefined | null)[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  /*
   * Never an empty string back. Every caller is naming something for a person
   * or for a grouping key, and "" is the value that reads as a bug in a footer
   * and hides as a bug in a dashboard. A caller that wants a blank passes one
   * as its last argument and says so.
   */
  return "";
}
