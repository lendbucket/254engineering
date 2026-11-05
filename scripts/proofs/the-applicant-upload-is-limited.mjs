/**
 * PROOF: THE APPLICANT'S UPLOAD IS LIMITED PER CONNECTION AND PER APPLICATION,
 * BEFORE ANY URL IS SIGNED.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-applicant-upload-is-limited.mjs
 *
 * Robert's answer L3 of 2026-11-05 (auth low findings, 6594441148): "its own
 * small branch on Q11's counted limiter." /api/upload signs an upload URL for
 * anybody with no session, so it was a way to fill the private bucket without
 * end.
 *
 *   A  the limits are the pinned literals below, not the module's own constants
 *   B  the real limiter, counting in memory with the database off: the
 *      thirty first request from one connection is refused, the thirteenth for
 *      one application from fresh connections is refused, and another
 *      application from a fresh connection is still taken
 *   C  a board run's application key carries its prefix on development and
 *      production's does not
 *   D  the route counts after its shape check and before it signs anything,
 *      and answers a refusal with 429 and the refusal sentence
 */
import { readFileSync } from "node:fs";

/* The database is off for this process, so the limiter's in-memory fallback answers. */
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.BOARD_RUN_ID;
delete process.env.BOARD_AUDIT;

const forms = await import("../../src/lib/public-form-limits.ts");
const { DEVELOPMENT_REF } = await import("../../src/lib/db-guard.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};
const code = (path) =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => (/^\s*\/\//.test(l) ? "" : l))
    .join("\n");

/* A ------------------------------------------------------------------------ */
const PINNED = { windowSeconds: 3600, perConnection: 30, perApplication: 12 };
for (const [k, v] of Object.entries(PINNED)) check(`the ${k} limit is ${v}`, forms.UPLOAD_LIMITS[k] === v, String(forms.UPLOAD_LIMITS[k]));

/* B ------------------------------------------------------------------------ */
const from = (ip) => new Headers({ "x-forwarded-for": ip });
const app = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let taken = 0;
for (let i = 0; i < 30; i++) if ((await forms.takeUploadAttempt(from("198.51.100.20"), app(100 + i))).allowed) taken++;
check("thirty uploads from one connection are taken", taken === 30, String(taken));
check("and the thirty first is refused", !(await forms.takeUploadAttempt(from("198.51.100.20"), app(999))).allowed);

let forOne = 0;
for (let i = 0; i < 12; i++) if ((await forms.takeUploadAttempt(from(`198.51.100.${30 + i}`), app(1))).allowed) forOne++;
check("twelve uploads for one application from fresh connections are taken", forOne === 12, String(forOne));
check("and the thirteenth for that application is refused", !(await forms.takeUploadAttempt(from("198.51.100.60"), app(1))).allowed);
check("another application from a fresh connection is still taken", (await forms.takeUploadAttempt(from("198.51.100.61"), app(2))).allowed);

/* C ------------------------------------------------------------------------ */
const devUrl = `https://${DEVELOPMENT_REF}.supabase.co`;
process.env.SUPABASE_URL = devUrl;
process.env.BOARD_RUN_ID = "41500000002";
process.env.BOARD_AUDIT = "careers-audit";
const boardKeys = forms.uploadKeys(from("198.51.100.7"), app(3));
check(
  "a board run counts the connection under its run and audit",
  boardKeys.connection === "upload:ip:board:41500000002:careers-audit:198.51.100.7",
  boardKeys.connection,
);
check(
  "and the application under its run, so concurrent boards do not share it",
  boardKeys.application === `upload:app:board:41500000002:${app(3)}`,
  boardKeys.application,
);
process.env.SUPABASE_URL = "https://fsaryeciduszuahgjbly.supabase.co";
const prodKeys = forms.uploadKeys(from("198.51.100.7"), app(3));
check(
  "production's keys are exactly the connection and the application",
  prodKeys.connection === "upload:ip:198.51.100.7" && prodKeys.application === `upload:app:${app(3)}`,
  `${prodKeys.connection} ${prodKeys.application}`,
);
delete process.env.SUPABASE_URL;
delete process.env.BOARD_RUN_ID;
delete process.env.BOARD_AUDIT;

/* D ------------------------------------------------------------------------ */
const route = code("src/app/api/upload/route.ts");
const shapeAt = route.indexOf('typeof size !== "number"');
const limitAt = route.indexOf("await takeUploadAttempt(request.headers, applicationId)");
const signAt = route.indexOf("await createSignedUpload(");
check("the route counts after its shape check", shapeAt >= 0 && limitAt > shapeAt, `${shapeAt} < ${limitAt}`);
check("and before it signs anything", limitAt >= 0 && signAt > limitAt, `${limitAt} < ${signAt}`);
const refusal = limitAt >= 0 ? route.slice(limitAt, signAt) : "";
check(
  "a refusal answers 429 with the refusal sentence",
  /if \(!limited\.allowed\)/.test(refusal) && /error: UPLOAD_REFUSAL \}, \{ status: 429 \}/.test(refusal),
);
check("the sentence names no address and no application", !/@|application id|[0-9a-f]{8}-/.test(forms.UPLOAD_REFUSAL));

console.log("");
if (wrong === 0) {
  console.log("PASS: the applicant's upload is limited per connection and per application before any URL is signed.");
} else {
  console.log(`FAIL: ${wrong} check(s) above.`);
}
process.exit(wrong === 0 ? 0 : 1);
