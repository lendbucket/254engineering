// @runtime react-server
//
// Declared because it imports src/lib/letter-seal.ts, which carries server-only.

/**
 * A SEAL IS VOIDED ONLY BY HIM, WITH A REASON AND A FRESH CODE; A REISSUE IS
 * TOLD TO THE CUSTOMER AND NOT SETTLED AGAIN; AND STAFF OPEN A SEALED DOCUMENT
 * ONLY THROUGH THE CUSTOMER PATH'S CHECK.
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/a-void-is-his-and-a-reissue-is-told.mjs
 *
 * Robert's addendum of 2026-10-25, 22:46 Central, item 2. The database half
 * (the void door refuses anyone but the licensed role; a replacement records
 * the act it replaces, named by the database) is exercised in migration-audit's
 * replayed database, because only a database can prove a trigger. This proof
 * holds the application half: the refusals voidSealedLetter makes before it
 * reads anything, the order of its checks, the reissue path, the email, and the
 * staff document path. No database is reached: the URL below does not resolve.
 */
process.env.SUPABASE_URL = "http://void-reissue-proof.supabase.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY = "void-reissue-proof-not-a-key";
delete process.env.VERCEL_ENV;

import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const { voidSealedLetter } = await import("../../src/lib/letter-seal.ts");
const ACT = "00000000-0000-4000-8000-00000000a001";
const REASON = "The property address on the letter was wrong.";

/* 1. Who may void, asked before anything is read. */
for (const role of ["admin", "operations_manager", "field_tech", "read_only"]) {
  const r = await voidSealedLetter({ id: "p", role, status: "active" }, { sealActId: ACT, code: "123456", reason: REASON });
  check(`a ${role} cannot void a seal`, !r.ok && /Only the engineer of record voids/.test(r.error), r.ok ? "voided" : r.error);
}
const suspended = await voidSealedLetter({ id: "p", role: "engineer", status: "suspended" }, { sealActId: ACT, code: "123456", reason: REASON });
check("nor a suspended engineer", !suspended.ok && /Only the engineer of record voids/.test(suspended.error), suspended.ok ? "voided" : suspended.error);
const nobody = await voidSealedLetter(null, { sealActId: ACT, code: "123456", reason: REASON });
check("nor nobody", !nobody.ok);

/* 2. A reason is required, said before anything is read. */
for (const reason of ["", "   ", "wrong"]) {
  const r = await voidSealedLetter({ id: "p", role: "engineer", status: "active" }, { sealActId: ACT, code: "123456", reason });
  check(`a reason of ${JSON.stringify(reason)} is refused`, !r.ok && /Say why the seal is voided/.test(r.error), r.ok ? "voided" : r.error);
}
/* With a reason and the licence, the next step is the read; it fails here, and says nothing was voided. */
const reaches = await voidSealedLetter({ id: "p", role: "engineer", status: "active" }, { sealActId: ACT, code: "123456", reason: REASON });
check("with the licence and a reason it goes on to read the seal, and a failed read voids nothing", !reaches.ok && /Nothing was voided/.test(reaches.error), reaches.ok ? "voided" : reaches.error);

/* 3. The order of the checks, read from the source, because the database reads cannot run here. */
const seal = readFileSync("src/lib/letter-seal.ts", "utf8");
const voidBody = seal.slice(seal.indexOf("export async function voidSealedLetter("), seal.indexOf("export type LiveLetter"));
const at = (s) => voidBody.indexOf(s);
const licenceAt = at('holdsLicence(actor, "documents.seal")');
const reasonAt = at("reason.length < 10");
const ownAt = at("act.sealed_by !== actor!.id");
const letterAt = at('act.kind !== "letter"');
const codeAt = at('verifyFreshCode(actor!.id, input.code, "Voiding a seal")');
const rpcAt = at('db.rpc("eng_void_seal_act"');
check("voiding asks for a fresh code, the same verifier sealing uses", codeAt > 0);
check("only a letter is voided here", letterAt > 0 && letterAt < codeAt);
check("only by the engineer who sealed it", ownAt > 0 && ownAt < codeAt);
check("and every refusal comes before the code is spent", licenceAt > 0 && reasonAt > licenceAt && ownAt < codeAt);
check("the voiding goes through eng_void_seal_act, after the code", rpcAt > codeAt);
check("with his id as the voider and the reason he gave", /p_voided_by: actor!\.id, p_because: reason/.test(voidBody));

/* 4. The reissue: told, and never delivered or settled a second time. */
const sealBody = seal.slice(seal.indexOf("export async function sealLetter("), seal.indexOf("export async function replacementNotice("));
const noticeAt = sealBody.indexOf('replacementNotice(sealActId, det.file_id, "letter")');
const deliverAt = sealBody.indexOf("deliverSealedFile(actor!, det");
check("a sealed letter asks whether it replaces one before it delivers", noticeAt > 0 && deliverAt > noticeAt);
check("and a replacement returns before the delivery and the settlement", /if \(reissue\) return \{ ok: true, documentId, sha256, \.\.\.reissue \};/.test(sealBody));
const own = readFileSync("src/lib/own-document-seal.ts", "utf8");
const ownNotice = own.indexOf('replacementNotice(sealActId, det.file_id, "specification")');
const ownDeliver = own.indexOf("deliverSealedFile(actor!, det");
check("so does the engineer's own document", ownNotice > 0 && ownDeliver > ownNotice && /if \(reissue\) return/.test(own));
const noticeBody = seal.slice(seal.indexOf("export async function replacementNotice("), seal.indexOf("export async function voidSealedLetter("));
check("the replacement is read off the act the database recorded", /select\("replaces_seal_act_id"\)/.test(noticeBody) && /\.eq\("id", sealActId\)/.test(noticeBody));
check("and a failed read of it is not taken as a first letter", /if \(error \|\| !act\) \{\s*return \{\s*delivered: false,/.test(noticeBody));
check("and the replacement notice never settles", !/settleDecision|deliverSealedFile|transitionFile/.test(noticeBody));
check("the customer is emailed through sendLetterReplaced", /sendLetterReplaced\(order\.id as string\)/.test(noticeBody));

/* 5. The email. */
const { orderLetterReplaced, isMarketing, allTemplatesForAudit } = await import("../../src/lib/email-templates.ts");
const email = orderLetterReplaced({
  customerName: "Proof Customer",
  customerEmail: "proof@audit-probe.invalid",
  reference: "254-O2026-PROOF1",
  propertyAddress: "1 Proof Way",
  sealedAt: "27 October 2026 at 10:00",
  statusUrl: "https://254engineering.com/order/254-O2026-PROOF1?token=proof",
});
check("the replacement email has its own id", email.id === "order.letter_replaced", email.id);
check("it goes to the customer", email.to === "proof@audit-probe.invalid");
check("it is order correspondence, not marketing", !isMarketing(email.id));
check("it links to the order page by the signed link, absolute", (email.html ?? "").includes("https://254engineering.com/order/254-O2026-PROOF1?token=proof"));
check("it says the earlier letter is withdrawn and the replacement is on the order page", /withdrawn the earlier sealed letter/.test(email.text) && /replacement is on your order page/.test(email.text));
check("and that the earlier seal is void", /seal is void/.test(email.text));
/* The four long dash characters, built from their code points so this file carries none of them. */
const LONG_DASHES = [0x2012, 0x2013, 0x2014, 0x2015].map((c) => String.fromCharCode(c));
const rendered = `${email.subject}${email.text}${email.html ?? ""}`;
check("it carries no long dash", !LONG_DASHES.some((d) => rendered.includes(d)));
check("email-audit sees it", allTemplatesForAudit().some((t) => t.id === "order.letter_replaced"));
const payments = readFileSync("src/lib/ops-payments.ts", "utf8");
const sendBody = payments.slice(payments.indexOf("export async function sendLetterReplaced("), payments.indexOf("export async function sendLetterReplaced(") + 2400);
check("sending it writes the outcome to the order's timeline", /event\(\s*orderId,\s*queued\.ok \? "email\.queued" : "email\.not_sent"/.test(sendBody));

/* 6. Staff open a sealed document only through the customer path's check. */
const docs = readFileSync("src/lib/ops-docs.ts", "utf8");
const urlBody = docs.slice(docs.indexOf("export async function documentUrl("), docs.indexOf("// -------------------------------------------------------------- the binder"));
const sealedAt = urlBody.indexOf("if (data.sealed_at) {");
const bytesAt = urlBody.indexOf("await sealedLetterBytes(documentId)");
const signAt = urlBody.indexOf("createSignedUrl(");
check("a sealed document is checked by sealedLetterBytes itself, not a copy", bytesAt > sealedAt && sealedAt > 0 && /from "\.\/letter-seal"/.test(docs));
check("before any signed link could be made for it", bytesAt > 0 && signAt > bytesAt);
check("and a refusal is returned as a refusal", /\{ kind: "refused", error: read\.error \}/.test(urlBody));
const route = readFileSync("src/app/api/portal/documents/route.ts", "utf8");
check("the staff route refuses what the check refused", /if \(opened\.kind === "refused"\)/.test(route));
check("and serves a sealed document's checked bytes rather than redirecting to the object", /if \(opened\.kind === "sealed"\) \{\s*return new NextResponse\(Buffer\.from\(opened\.bytes\)/.test(route));
const letterBytes = seal.slice(seal.indexOf("export async function sealedLetterBytes("));
check("the shared check reads a LIVE seal act and re-hashes the bytes", /\.is\("voided_at", null\)/.test(letterBytes) && /sha !== act\.content_sha256/.test(letterBytes));

/* 7. The screen and the route. */
const lettersRoute = readFileSync("src/app/api/portal/letters/route.ts", "utf8");
check("the letters route has a void action calling voidSealedLetter", /body\.action === "void"/.test(lettersRoute) && /voidSealedLetter\(actor,/.test(lettersRoute));
check("which passes the reason and the code he typed", /reason: typeof body\.reason === "string"/.test(lettersRoute) && /code: typeof body\.code === "string"/.test(lettersRoute));
const panel = readFileSync("src/app/portal/(app)/review/VoidSealPanel.tsx", "utf8");
check("the panel asks for a reason and a code before it will send", /reason\.trim\(\)\.length < 10/.test(panel) && /code\.trim\(\)\.length < 6/.test(panel));
const review = readFileSync("src/app/portal/(app)/review/page.tsx", "utf8");
check("the review screen offers his own live letters, and says when they could not be read", /liveLettersOf\(actor\)/.test(review) && /could not be read, so none is offered for voiding/.test(review));

console.log("");
if (wrong === 0) {
  console.log("PASS: a void is his, with a reason and a fresh code; a reissue is told and not settled again; staff open a sealed document through the customer's check.");
  process.exitCode = 0;
} else {
  console.log(`FAIL: ${wrong} check(s).`);
  process.exitCode = 1;
}
