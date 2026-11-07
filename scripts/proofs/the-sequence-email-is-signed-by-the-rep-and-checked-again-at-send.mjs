// @runtime react-server
/**
 * PROOF: THE SALES SEQUENCE EMAIL IS SIGNED BY THE REP, AND THE SEND JOB ASKS
 * THE MARKETING LIST AGAIN FOR MARKETING TEMPLATES ONLY.
 *
 * Robert, 2026-11-02, issue #1, answers to comment 6592143963:
 *   2 "approved: the rep signature variant '{{rep}}, 254 Engineering,
 *     {{phone}}' above the firm footer, recorded as an email identity ruling."
 *   3 "approved, the second suppression check in the marketing-only branch
 *     with email-audit asserting it."
 *
 *   A  the identity declaration names exactly the CRM sequence template as
 *      rep signed, and the rep line has the ruled shape
 *   B  a rendered sequence email carries the rep line, in both parts, above
 *      the firm footer, and not the signer's block; the footer is unchanged
 *   C  every other human template still carries the signer's block
 *   D  the send job's one call to the suppression gate sits inside the guard
 *      on MARKETING_TEMPLATES
 *
 *   node node_modules/tsx/dist/cli.mjs --conditions=react-server scripts/proofs/the-sequence-email-is-signed-by-the-rep-and-checked-again-at-send.mjs
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`${ok ? "  PASS" : "  FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const identity = await import("../../src/config/email-identity.ts");
const templates = await import("../../src/lib/email-templates.ts");
const { registrationLine } = await import("../../src/lib/launch.ts");

/* A */
const named = Object.keys(identity.REP_SIGNED_TEMPLATES);
check("exactly the CRM sequence template is rep signed", JSON.stringify(named) === JSON.stringify(["marketing.crm_sequence"]), named.join(", "));
check("and it is a marketing template", templates.MARKETING_TEMPLATES.includes("marketing.crm_sequence"));
check("the ruled shape reads as a rep line", identity.isRepSignatureLine("Sam, 254 Engineering, (281) 940-4490"));
check("and the prelaunch shape, without the telephone", identity.isRepSignatureLine("Sam, 254 Engineering"));
check("a line naming another firm does not", !identity.isRepSignatureLine("Sam, Somebody Else, (281) 940-4490"));
check("nor a sentence", !identity.isRepSignatureLine("Thanks for your time today, Sam"));
const idSrc = readFileSync("src/config/email-identity.ts", "utf8");
check("the declaration records the ruling with its date and where it was given", /EMAIL IDENTITY RULING, Robert Reyna, 2026-11-02, issue #1/.test(idSrc) && /6592143963/.test(idSrc));

/* B */
const email = templates.crmSequenceEmail({
  to: "prospect@rep-signed.invalid",
  subject: "Roof certification letters for your customers",
  paragraphs: ["Pat, I called earlier about roof certification letters."],
  signOff: "Sam, 254 Engineering, (281) 940-4490",
  unsubscribeUrl: "https://254engineering.com/unsubscribe?e=prospect%40rep-signed.invalid&t=x",
});
const lines = email.text.split("\n").map((l) => l.trim());
const repAt = lines.indexOf("Sam, 254 Engineering, (281) 940-4490");
const footerAt = lines.indexOf(registrationLine());
check("the plain part carries the rep line", repAt >= 0);
check("above the firm footer", repAt >= 0 && footerAt > repAt, `rep ${repAt}, footer ${footerAt}`);
check("the HTML carries the rep line", email.html.includes("Sam, 254 Engineering, (281) 940-4490"));
check("and not the signer's block, in either part", !email.text.includes(identity.emailIdentity.signer.name) && !email.html.includes(identity.emailIdentity.signer.name));
check("the footer is unchanged: registration line and unsubscribe present", email.text.includes(registrationLine()) && /unsubscribe\?e=/.test(email.text));
check("the rep line is not repeated as a body paragraph", lines.filter((l) => l === "Sam, 254 Engineering, (281) 940-4490").length === 1);

/* C */
const humans = templates.allTemplatesForAudit().filter((t) => t.purpose === "human" && !(t.id in identity.REP_SIGNED_TEMPLATES));
const unsigned = humans.filter((t) => !t.text.includes(identity.emailIdentity.signer.name)).map((t) => t.id);
check(`every other human template still carries the signer's block (${humans.length})`, humans.length > 0 && unsigned.length === 0, unsigned.join(", "));

/* D */
const handlers = readFileSync("src/lib/job-handlers.ts", "utf8");
const calls = handlers.match(/\bisSuppressed\s*\(/g) ?? [];
check("the send job calls the suppression gate exactly once", calls.length === 1, `${calls.length}`);
check(
  "inside the guard on MARKETING_TEMPLATES",
  handlers.includes("if (templateId !== null && MARKETING_TEMPLATES.includes(templateId)) {\n      if (await isSuppressed(to)) {"),
);
const branch = handlers.slice(handlers.indexOf("MARKETING_TEMPLATES.includes(templateId)"), handlers.indexOf("MARKETING_TEMPLATES.includes(templateId)") + 700);
check("and a suppressed address finishes the job with a recorded reason, before the provider", /recordSystemAudit\(\{\s*action: "email\.suppressed_at_send"/.test(branch) && /return \{ kind: "done" \};/.test(branch) && handlers.indexOf("MARKETING_TEMPLATES.includes(templateId)") < handlers.indexOf("await notify("));

console.log(wrong === 0 ? "PASS: the sequence email is signed by the rep above the firm footer, and the send job asks the marketing list again for marketing templates only." : `FAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
