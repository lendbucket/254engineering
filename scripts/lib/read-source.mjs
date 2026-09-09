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
