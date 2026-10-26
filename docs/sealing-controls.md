# Sealing in the portal: every control, mapped to 22 TAC 137.33 and 137.35

CLAUDE.md section 1 (operator ruling, 2026-10-06): "Each control is mapped to 22
TAC 137.33 and 137.35 before code is written." This is that map, written on
2026-10-07 before sealing piece two was built on `release/2026-10-20`. One
mechanism serves a letter and a protocol, by ruling 2a of the same day.

## The rule text, and how far it can be trusted

Read on 2026-10-07 from the Legal Information Institute's copy of the Texas
Administrative Code, because the source this repository cites,
`txrules.elaws.us`, answered 503 that day.

**22 TAC 137.35, quoted in full as returned:**

> (a) Licensed professional engineers shall maintain the security of their
> electronic seals and electronic signatures. The following methods are allowed:
> (1) "Licensed professional engineers may electronically copy their original
> hard copy work that bears their seal, original signature, and date and transmit
> this work in a secure electronic format." (2) "An engineer may create an
> electronic seal and electronic signature for use in transmitting electronically
> formatted engineering work, regardless of whether the work was originally in
> hard copy or electronic format." (b) As an alternative to electronic sealing and
> electronic signatures, engineers shall affix their original seals and
> signatures and date to their engineering work as specified in § 137.33(f).

**22 TAC 137.33 came back partly quoted and partly SUMMARISED by the fetch
tool.** Only the sentences below in quotation marks are the rule's own words.
Everything else in this section is a summary, and it is read against the
official text before the integration audit, which is an item in that audit's
list rather than a hope.

- (a) "The purpose of the engineer's seal is to assure the user of the
  engineering product that the work has been performed or directly supervised by
  the professional engineer named and to delineate the scope of the engineer's
  work."
- (b) Summary: a license holder may seal only work they performed or directly
  supervised, and on sealing accepts full professional responsibility.
- (d) Summary: license holders take reasonable steps to secure physical or
  electronic seals and signatures; on discovering a loss, written notice to the
  board "as soon as possible, but within 30 days."
- (f) Summary: final engineering work bears the seal with an original or
  electronic signature and date before release, and the signature and date must
  not obscure the engineer's name or license number in the seal.
- (f)(3) Summary: other engineering work, including opinions and evaluations,
  bears the engineer's printed name, date, signature and the "P.E."
  designation; a seal may be added.
- (l) Summary: final engineering work may be transmitted electronically if it
  bears the seal using the techniques in 137.35, with reasonable security
  measures that make the document unalterable.
- (n) "the firm name and registration number of the engineering firm by which
  the engineer is employed" must be clearly indicated on engineering documents.

## The controls

| # | Control, as built | Rule it answers | Proved by |
| --- | --- | --- | --- |
| 1 | The seal and signature images are uploaded by the engineer himself, from his own session with a fresh second factor, into the private `eng-seals` bucket (0061, piece one). | 137.35(a)(2), 137.33(d) | `a-seal-image-is-read-only-by-sealing.mjs` (piece one) |
| 2 | **The images are read by one function only, called by the sealing steps alone, server side**: a letter's, and since 2026-10-26 the engineer's own document's (control 16). No route serves them, no screen shows them, no export carries them, and no preview carries them. The profile page shows a fingerprint, never the image. | 137.33(d), 137.35(a) | A proof that greps every route and lib for the bucket and finds one reader, called by exactly the two sealing steps |
| 3 | **Only the engineer named on the determination can seal the letter for it**, and only while he holds the licence. The route compares the signed-in profile with `eng_determinations.engineer_id`; there is no role, grant or administrator that substitutes. | 137.33(a), 137.33(b) | An injection proof: an administrator, another engineer, and the right engineer without a fresh code are each refused |
| 4 | **A fresh TOTP code, spent atomically, for every seal act** (`verifyFreshCode`). A session that signed in an hour ago cannot seal on its old second factor. | 137.33(d) | The same proof: a replayed code is refused |
| 5 | **Rendered once, at sealing.** The letter is drafted from the fixed sentence for the recorded determination and the facts on the file; the engineer reviews the draft; sealing renders the PDF with his seal image, signature image, printed name, "P.E.", licence number and the date, placed so the signature and date sit beside the seal and never over it. | 137.33(f), 137.33(f)(3) | A proof that renders a letter and reads the text layer for the name, "P.E.", the licence number and the date |
| 6 | **The firm's name and registration number on every letter**, from `registrationLine()`, never typed. | 137.33(n) | The same proof reads the registrant line |
| 7 | **Hashed and locked.** The SHA-256 of the exact bytes stored is recorded with the seal act. The document row and the seal act refuse any change but a voiding, at the database. Every download recomputes the hash and refuses to serve bytes that do not match. | 137.33(l) | Injection: change one byte of the stored object, and the download refuses; update a sealed row, and the database refuses |
| 8 | **Any change voids the seal.** A correction is a new document and a new seal act; the old one is voided with a reason and stays. | 137.33(l) | The guard trigger's own refusal, proved in migration-audit's replay |
| 9 | **Every seal act and every voiding writes to the append-only audit log**, by trigger in the same transaction, so there is no seal without its record. | 137.33(d) | migration-audit's replay |
| 10 | **No customer sees anything before sealing.** Only a sealed, unvoided deliverable is visible to the client. | 137.33(f): "before release" | The delivery proof |
| 11 | **A protocol is signed by the same act.** The text the engineer reads in the portal is the transcription's own `text`; its SHA-256 is what the signature attaches to; any change to the transcription after signing makes the hashes disagree, and the signature reads as void. | Ruling 2a; 137.33(a) | Injection: change one word of a signed transcription, and the gate reads the protocol as unsigned |

## The engineer's own document: the repair specification

Robert's ruling of 2026-10-25, 23:51 Central, item C. A repair specification
is a document the engineer writes himself, so the platform drafts nothing. He
uploads his PDF, previews it exactly as it will be sealed, and seals it from
his own session with a fresh code. The platform adds the seal block, the
firm's name and F-29811, hashes the result, records the seal act with the name
and licence it prints, and delivers it as it delivers a letter. 254-RS-001
section 11: "On a pass determination, the engineer issues a sealed repair
specification addressed to the customer recorded at intake."

Mapped here on 2026-10-26, before any of it was written.

| # | Control, as built | Rule it answers | Proved by |
| --- | --- | --- | --- |
| 12 | **Only the engineer who recorded the pass determination on the file can upload, preview or seal its specification**, holding `documents.seal`. Every check of control 3 applies, unchanged, and nothing an administrator holds stands in. RS-001 joins the protocols whose review records a determination, so there is a determination to bind the seal to. | 137.33(a), 137.33(b) | A proof: an administrator, another engineer, a determination other than pass, and a protocol other than RS-001 are each refused at upload and at sealing |
| 13 | **The uploaded draft is his alone and is never a deliverable.** It goes by a signed URL straight to a private bucket that holds only these drafts, PDF only, 25 MB at the bucket. It is not in `eng-documents`, it has no `eng_documents` row, no customer route can reach it, and it is removed once the sealed copy is stored. | 137.33(f): "before release"; control 10 | The proof: the draft key is outside the deliverable store, and no customer or client read names the bucket |
| 14 | **The preview is the sealed document without the two images.** His pages unchanged, and one added final page carrying the letterhead (the brand, the mark, and the registrant with F-29811 from `registrationLine()`), the document's title, and the seal block text (his name, "P.E.", licence number, role and date), with boxes where the seal and signature will go. Its digest covers the draft's own SHA-256 and that frame. | 137.33(f), (f)(3), (n); L2d | The proof renders a preview and reads its text layer and page count |
| 15 | **Sealing seals only what he previewed.** The draft is read again at sealing, and its digest with the frame must equal the one he was shown, before any code is spent. A replaced upload or a changed frame refuses and says why. | 137.33(l); L2d | Injection: replace the draft after the preview, and sealing refuses |
| 16 | **Rendered once, at sealing, with nothing drawn over his pages.** The seal block, with his seal and signature images read here and only here, goes on the added final page, so no stamp can cover a line he wrote. The page is part of the one PDF whose bytes are hashed, so it cannot be separated from what it seals unnoticed. | 137.33(f), 137.33(l), 137.35(a) | The proof: page count is his plus one, his pages' content streams are byte identical, the seal page's text names him |
| 17 | **Recorded and delivered exactly as a letter.** Through 0089's seventeen argument door: the seal act names his determination, the printed name and licence, the letterhead hash, and the SHA-256 of the stored bytes. The file moves to sealed and delivered and the order settles and completes, by the same step a pass letter takes. Controls 7, 8 and 9 apply unchanged. | 137.33(l), 137.33(d) | The same proof, and migration-audit's replay for the door |

**What the platform does not do, said rather than implied.** It does not read,
check or alter what his specification says. Whether it identifies the
property, each location and the work, as section 11 requires, is his
professional act, and the platform has no way to know. It adds only what the
board's rules require on every engineering document, and only on a page of its
own.

## What is not a control, said rather than implied

- **Loss of a seal.** 137.33(d) asks for written notice to the board within 30
  days of discovering a loss. The platform can supersede an image at once, and
  does, and the audit log records it; the notice to the board is the engineer's
  act and nothing here sends it.
- **Whether the work was in fact performed or directly supervised** by the
  engineer is a fact about the world. Control 3 binds the seal to the engineer
  who recorded the determination on the evidence; it cannot see who stood on
  the roof, which is what the field record, the photographs and the technician's
  identity are for.
