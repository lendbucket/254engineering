/**
 * AN OFFER IS ANSWERED ON ITS OWN PAGE. Robert's answer 3 of 2026-11-12 (to
 * 6838484380), from the T3 and T4 phone pass: an offered job opened from a
 * notification or a link showed the checklist and no Accept or Decline, so the
 * technician had to go back to the list to answer.
 *
 *   node scripts/proofs/an-offer-is-answered-on-its-own-page.mjs
 *
 * The job page now carries the list card's own controls, for the reader's own
 * live offer on that file. Read from the source, so the page and the list
 * cannot drift apart on who may answer: the same component, the same live rule.
 */
import { readFileSync } from "node:fs";

let wrong = 0;
const check = (name, ok, note = "") => {
  if (!ok) wrong += 1;
  console.log(`  ${ok ? "PASS" : "FAIL"}: ${name}${note ? ` (${note})` : ""}`);
};

const page = readFileSync("src/app/portal/(app)/jobs/[id]/page.tsx", "utf8");
const list = readFileSync("src/app/portal/(app)/jobs/page.tsx", "utf8");
const LIVE = 'o.state === "offered" && !o.file?.assigned_tech_id';

check("the list's live rule is what it was", list.includes(`offers.filter((o) => ${LIVE})`));
check("the job page uses the list card's own controls", /import \{ OfferControls \} from "\.\.\/JobsClient";/.test(page));
check("it finds the reader's own offer through listOffers, as the list does", /await listOffers\(actor\)/.test(page));
check("only on this file, and only when it is live by the list's own rule", page.includes(`o.file_id === view.file.id && ${LIVE}`));
check("only for a reader who answers offers", /const liveOffer = can\(actor, "offers\.list_own"\)/.test(page));
check(
  "the controls get the offer, the file and whether it has a rate, as on the list",
  /<OfferControls offerId=\{liveOffer\.id\} fileId=\{liveOffer\.file_id\} hasRate=\{isKnown\(liveOffer\.offer_amount_cents\)\} \/>/.test(page),
);
check("and the rate shows above them, never a bare 'not set'", /isKnown\(liveOffer\.offer_amount_cents\) \? money\(liveOffer\.offer_amount_cents\) : "No rate on this offer yet"/.test(page));
check("nothing on the page answers an offer any other way", (page.match(/accept_offer|decline_offer/g) ?? []).length === 0);

console.log(wrong === 0 ? "\nPASS: an offer is answered on its own page, as on the list." : `\nFAIL: ${wrong} check(s).`);
process.exitCode = wrong === 0 ? 0 : 1;
