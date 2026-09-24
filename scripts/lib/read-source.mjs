import { readFileSync } from "node:fs";

/**
 * READ A SOURCE FILE FOR MATCHING, WITH ONE KIND OF LINE ENDING.
 *
 * An audit that matches a MULTI LINE pattern against a source file is asserting
 * something about what the code says. Line endings are not part of what it
 * says, and on Windows they are not stable: git checks files out with CRLF,
 * every patch script in this repository writes LF, and a file can therefore
 * have either depending on how it last arrived on disk.
 *
 * THE FAILURE THIS EXISTS BECAUSE OF, 2026-09-09
 * -----------------------------------------------
 * retention-audit asserted that the one DELETE in ops-retention.ts sits inside
 * the mode check, with a pattern spanning two lines. It passed on the feature
 * branch, where node had written the file with LF, and FAILED ON MAIN, where
 * `git checkout` had materialised the same bytes with CRLF. Nothing about the
 * code had changed. The check was measuring how the file got there.
 *
 * That is worse than a check that is merely wrong: it is a check whose answer
 * depends on the machine and the moment, so it would pass for one person and
 * fail for the next with nothing to argue about between them.
 *
 * Every audit matching across lines reads through here.
 */
export function readSource(path) {
  return readFileSync(path, "utf8").split("\r\n").join("\n");
}

/**
 * THE SAME FILE WITH THE PROSE TAKEN OUT.
 *
 * Lived in accounts-audit.mjs from 2026-09-13 until 2026-09-24, where its own
 * comment records why it exists: the first version of those checks grepped
 * whole files, and three of them failed against the very comments explaining
 * why the code does NOT do the thing being checked for.
 *
 * MOVED HERE THE MOMENT A SECOND AUDIT NEEDED IT, rather than copied. money-
 * audit was about to assert that the proving charge path reads
 * `stripeAccount.proof`, against a file whose header explains the proof six
 * times in prose, so the check would have passed on the explanation after
 * somebody deleted the code. That is this repository's matcher defect and its
 * two-homes defect arriving together, which is a good enough reason to give the
 * helper one address.
 *
 * It is deliberately crude: block comments anywhere, and lines whose first non
 * whitespace is `//`. A `//` inside a string literal survives, which is correct
 * for a URL and is why a trailing comment on a line of code is left alone.
 */
export function codeOnly(path) {
  const withoutBlocks = readSource(path).replace(/\/\*[\s\S]*?\*\//g, "");
  return withoutBlocks
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}
