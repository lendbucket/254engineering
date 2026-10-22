/**
 * Which pdftotext the AUDIT gets, asked the way the audit asks: spawnSync from
 * Node, on Node's PATH. A shell's `which` can answer differently, and on the
 * first Windows run it did: bash found Git's ucrt64 build (xpdf 4.06) while
 * protocol-registry-audit read every PDF exactly as xpdf 4.00 does.
 * Prints the path and the version line; exits 1 if none is found.
 */
import { spawnSync } from "node:child_process";

const finder = process.platform === "win32" ? ["where", ["pdftotext"]] : ["which", ["-a", "pdftotext"]];
const where = spawnSync(finder[0], finder[1], { encoding: "utf8" });
const version = spawnSync("pdftotext", ["-v"], { encoding: "utf8" });
const first = `${version.stdout ?? ""}${version.stderr ?? ""}`.split(/\r?\n/).find((l) => /version/i.test(l));
console.log(`on Node's PATH, in order: ${(where.stdout ?? "").trim().split(/\r?\n/).join(" ; ") || "none"}`);
console.log(`the one spawn runs: ${first ?? "no version line"}`);
process.exitCode = version.error ? 1 : 0;
