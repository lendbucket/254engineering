/**
 * A LINK IS SIGNED WHEN THE MESSAGE GOES OUT, NEVER WHEN IT IS COMPOSED.
 *
 * Operator ruling, 2026-09-09, and it is a fix with a deadline rather than a
 * backlog item.
 *
 * WHAT WAS WRONG, FOUND BY READING ONE OF THE 35 EMAILS
 * ------------------------------------------------------
 * The application notification carries a signed storage link to the applicant's
 * resume. `signedDownloadUrl` gives it seven days, and the reasoning beside that
 * number is right: long enough to read an application over a weekend, short
 * enough that an old forwarded email stops being a key to somebody's resume.
 *
 * The clock started when the message was COMPOSED. The one read for the gate 0
 * report was composed on 2026-09-05 and delivered on 2026-09-09, so it reached
 * the operator with three of its seven days left, and nothing anywhere said so.
 *
 * It does not matter while the queue drains in a minute, which is why nobody
 * met it. It matters exactly when the queue is the thing that failed: a job
 * that dead letters and is replayed by hand a week later delivers an
 * application whose resume link is already dead, and the reader gets a refusal
 * with no way to tell whether the file was ever there.
 *
 * HOW IT WORKS
 * -------------
 * The composer puts a TOKEN where the URL goes. The token carries the storage
 * path and nothing else: no signature, no expiry, no credential. `email.send`
 * finds every token in the message and replaces each with a freshly signed URL
 * immediately before handing the message to the provider, so the seven days
 * start when the recipient could first have clicked.
 *
 * WHY THE TOKEN IS SHAPED LIKE AN ABSOLUTE URL
 * ---------------------------------------------
 * Two reasons, and the second is the one that matters.
 *
 * email-audit asserts every link in every template is absolute, which is a
 * check worth keeping, so the token has to satisfy it rather than be exempted
 * from it.
 *
 * And the host is `.invalid`, which RFC 2606 guarantees will never resolve. If
 * a token ever escaped unresolved, the failure is a link that visibly goes
 * nowhere rather than a link that quietly goes SOMEWHERE. A placeholder host
 * that somebody might one day register is a placeholder waiting to become an
 * open redirect in the firm's own outbound mail.
 *
 * WHY THERE IS NO server-only HERE
 * ---------------------------------
 * It has no server-only dependency and it must not pretend to. Everything in
 * this file is base64 and string replacement; the SIGNER is passed in, so this
 * module never touches storage or a credential.
 *
 * Marking it server-only made it unreachable from email-audit, which runs
 * without the react-server condition, and the whole check would then have been
 * a source match rather than an exercise of the thing. deletion-request-kinds.ts
 * learned this in Section 3 from the other direction: a client component
 * importing a server-only module is tsc-green and build-red.
 */

/** The host no token may ever reach. RFC 2606 reserves the TLD. */
export const DEFERRED_HOST = "https://signed-link.invalid/";

/**
 * A stand-in for a link that will be signed at send time.
 *
 * The storage path is base64url encoded so it survives a round trip through
 * JSONB, an HTML attribute and a plain text part without anything having to
 * escape it.
 */
export function deferredLink(storagePath: string): string {
  return DEFERRED_HOST + Buffer.from(storagePath, "utf8").toString("base64url");
}

/** Every token in a message, as the storage paths they stand for. */
export function deferredPathsIn(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/https:\/\/signed-link\.invalid\/([A-Za-z0-9_-]+)/g)) {
    try {
      const path = Buffer.from(m[1], "base64url").toString("utf8");
      if (path) found.add(path);
    } catch {
      /* A token that will not decode is not a path. It is left in place so the
       * message shows a dead link rather than this throwing on the way out. */
    }
  }
  return [...found];
}

/**
 * Replace every token with what `sign` returns for its path.
 *
 * A path the signer cannot sign keeps its token, deliberately. The alternative
 * is dropping the link, and a message that silently loses its attachment is
 * worse than one carrying a link that plainly does not work: the first looks
 * like an application with no resume attached.
 */
export async function resolveDeferred(
  text: string,
  sign: (path: string) => Promise<string | null>,
): Promise<string> {
  const paths = deferredPathsIn(text);
  if (paths.length === 0) return text;

  let out = text;
  for (const path of paths) {
    const url = await sign(path);
    if (!url) continue;
    out = out.split(deferredLink(path)).join(url);
  }
  return out;
}
