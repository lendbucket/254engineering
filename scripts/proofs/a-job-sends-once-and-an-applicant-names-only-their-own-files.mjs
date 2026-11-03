/**
 * PROOF: AN EMAIL JOB SENDS ONCE, AND AN APPLICANT NAMES ONLY THEIR OWN FILES.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-job-sends-once-and-an-applicant-names-only-their-own-files.mjs
 *
 * Robert's Q12 of 2026-11-02 (office audit F3, F5, F6): "Resend idempotency key
 * per job; apply refuses a document path outside the applicant's own prefix;
 * applications page signs links for ten minutes." F8 (setGrants as one SQL
 * function) needs a migration and is staged with the migration chain, so it is
 * not proved here.
 *
 *   A  the real email.send handler, with the network replaced by a stub that
 *      records every request: a fresh job sends once to Resend carrying the
 *      job's idempotency key, and stamps the provider's id on its own payload;
 *      a re-run of a job already stamped sends nothing and is done
 *   B  isApplicantDocumentPath accepts the applicant's own upload paths and
 *      refuses another applicant's, a traversal, an unknown kind, a nested key
 *      and a non-string
 *   C  /api/apply refuses a foreign path with 422 before it writes, and the
 *      applications screen signs only the applicant's own paths, for ten
 *      minutes; the operator email keeps seven days
 *   No request leaves this process: every fetch is answered by the stub.
 */
import { readFileSync } from "node:fs";

const requests = [];
globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  const headers = new Headers(init.headers ?? (typeof input === "string" ? undefined : input.headers));
  requests.push({ url, method: (init.method ?? "GET").toUpperCase(), headers, body: init.body ? String(init.body) : "" });
  if (url.includes("api.resend.com")) {
    return new Response(JSON.stringify({ id: "msg_proof_1" }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
};
process.env.RESEND_API_KEY = "re_proof_not_a_key";
process.env.SUPABASE_URL = "https://ythzaiqeoijlrdibnieo.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "proof-not-a-key";
delete process.env.VERCEL_ENV;

await import("../../src/lib/job-handlers.ts");
const { handlerFor } = await import("../../src/lib/ops-jobs.ts");
const { emailJobIdempotencyKey } = await import("../../src/lib/job-handlers.ts");
const uploads = await import("../../src/lib/uploads.ts");
const { SITE_KEY } = await import("../../src/lib/supabase.ts");

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

/* A ------------------------------------------------------------------------ */
const handler = handlerFor("email.send");
check("the email.send handler is registered", Boolean(handler));
const job = (id) => ({ id, kind: "email.send", attempts: 0, maxAttempts: 5, effectMode: "live", payload: {} });
const payload = { id: "proof", purpose: "human", to: "someone@proof-mail.test", subject: "A proof", text: "Body.", from: "254 Engineering <notifications@254engineering.com>" };

const fresh = await handler.run({ ...payload }, job(9101));
const sends = requests.filter((r) => r.url.includes("api.resend.com"));
check("a fresh job is done", fresh.kind === "done", JSON.stringify(fresh));
check("and it sent once", sends.length === 1, String(sends.length));
check("carrying the job's idempotency key", sends[0]?.headers.get("idempotency-key") === "email-job-9101", sends[0]?.headers.get("idempotency-key") ?? "none");
check("the key is the job's own", emailJobIdempotencyKey(9101) === "email-job-9101");
const stamp = requests.find((r) => r.method === "PATCH" && r.url.includes("/rest/v1/eng_jobs") && r.url.includes("id=eq.9101"));
check("and it stamped the provider's id on its own payload", Boolean(stamp) && /"sentMessageId":"msg_proof_1"/.test(stamp.body), stamp ? stamp.body.slice(0, 120) : "no PATCH to eng_jobs");

const before = requests.length;
const rerun = await handler.run({ ...payload, sentMessageId: "msg_proof_1" }, job(9101));
check("a re-run of a stamped job is done", rerun.kind === "done", JSON.stringify(rerun));
check("and sends nothing", requests.slice(before).every((r) => !r.url.includes("api.resend.com")), String(requests.length - before));

/* B ------------------------------------------------------------------------ */
const mine = "11111111-2222-4333-8444-555555555555";
const theirs = "99999999-8888-4777-8666-555555555555";
const ok = (p) => uploads.isApplicantDocumentPath(p, mine);
check("the applicant's own resume is theirs", ok(uploads.uploadPath(mine, "resume", "My CV.pdf")));
check("and their license and certifications", ok(uploads.uploadPath(mine, "license", "lic.png")) && ok(uploads.uploadPath(mine, "certifications", "c.pdf")));
check("another applicant's resume is not", !ok(uploads.uploadPath(theirs, "resume", "cv.pdf")));
check("a traversal out of the prefix is not", !ok(`${SITE_KEY}/${mine}/../${theirs}/resume-cv.pdf`));
check("an unknown kind is not", !ok(`${SITE_KEY}/${mine}/payroll-w4.pdf`));
check("a nested key is not", !ok(`${SITE_KEY}/${mine}/resume-x/cv.pdf`));
check("another site's prefix is not", !ok(`other/${mine}/resume-cv.pdf`));
check("a non-string is not", !ok({ path: "x" }) && !ok(undefined));

/* C ------------------------------------------------------------------------ */
const code = (path) => readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const apply = code("src/app/api/apply/route.ts");
const check422 = apply.indexOf("isApplicantDocumentPath(");
check("/api/apply checks every document path", check422 > 0 && /\["resume", "certifications", "licenseDocument"\]/.test(apply.slice(check422 - 300, check422)));
check("and refuses with 422 before it writes", check422 < apply.indexOf("insertStructuredApplication(") && /status: 422/.test(apply.slice(check422, check422 + 600)));
const screen = code("src/app/portal/(app)/applications/page.tsx");
check("the applications screen signs only the applicant's own paths", /isApplicantDocumentPath\(file\.path, r\.id\)/.test(screen));
check("for ten minutes", /signedDownloadUrl\(file\.path, APPLICATIONS_SCREEN_LINK_SECONDS\)/.test(screen) && uploads.APPLICATIONS_SCREEN_LINK_SECONDS === 600);
const uploadsSrc = code("src/lib/uploads.ts");
check("and the operator email keeps seven days", /signedDownloadUrl\(path: string, expiresInSeconds = 60 \* 60 \* 24 \* 7\)/.test(uploadsSrc));

console.log(
  wrong === 0
    ? "PASS: an email job sends once with its own key and stamps what it sent, and an applicant can name only their own uploads, signed for ten minutes on the screen."
    : `FAIL: ${wrong} check(s).`,
);
process.exitCode = wrong === 0 ? 0 : 1;
