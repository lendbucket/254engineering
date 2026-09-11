# Brief for the next Sealed Engineering session

This file lives in the 254 Engineering Services repository and describes work
that belongs to a DIFFERENT one. It exists because a finding was made here, on
the live deployment, and there was nowhere in that repository to put it.

**Nothing in this file may be acted on from this repository.** Operator ruling,
2026-09-10: the sibling sites are not touched from here, ever. Carry the item
across by hand, into that repository, in that session.

---

## 0. THE FIRM REGISTRATION ISSUED, AND IT DOES NOT OPEN YOUR GATE EITHER

Recorded 2026-09-10. Read this before item 1.

TBPELS issued a firm registration:

| | |
| --- | --- |
| Number | **F-29811** |
| Issued to | **254 Services LLC** |
| Status | active |
| Expires | **2027-07-31** |

**The compliance gate stays shut on all three sites, and the reason is the
name.** The registration is in the name *254 Services LLC*. This site holds out
under a different name. A registration in one name does not authorise holding
out under another, and Texas regulates the use of "engineer" and "engineering"
in how a firm names itself and presents itself.

So the gate does not open until the board HAS the operating name, either by the
entity being renamed or by an assumed name being filed and recorded. Until then
nothing changes on any of the three sites.

### What this means for this repository, in order

1. **Do not print F-29811 anywhere yet.** While the gate is shut the number must
   not render. Printing it beside a trading name the board has no record of is
   the misstatement the gate exists to prevent, and it would be worse than
   printing nothing because it looks like a verified fact.

2. **When the gate does open, the number must appear in this site's public
   footer.** That is an operator ruling, not a preference: the requirement is
   the number in the public footer of ALL THREE sites, in every email footer,
   and on the sealed document upload record.

3. **Print the name the registration was ISSUED TO beside the number, not the
   name the site trades under.** In the 254 Engineering Services repository this
   was a live defect: `registrationLine()` printed a module constant reading
   "254 Engineering Services LLC", so the moment the gate opened it would have
   put the board's number next to a name the board's record does not carry. It
   now reads the name off the registration record, so the two cannot disagree.

4. **Keep the number in ONE place**, a configuration file, and have the footer
   read it from there. Not an environment variable: a variable can differ
   between a build and a deployment, and this is a regulatory statement. Pin it
   as a literal in whatever audit covers it, so changing it costs two edits made
   on purpose.

5. **Check the expiry.** A registration is not evidence of anything after
   2027-07-31. A site that goes on printing a lapsed number is making a claim it
   cannot support, so the check is `status active AND expires >= today` rather
   than "a number exists".

### Why you are being told rather than sent a patch

The sibling sites are not touched from the 254 Engineering Services repository,
ever, by the operator's ruling of 2026-09-10. This brief is how the requirement
crosses.

---

## 1. THE COMPLIANCE GATE: two sentences on the live site, and this is the first item

Found 2026-09-10 by the overnight sweep's Round 2, which reads the three live
deployments signed out and matches the rendered text against
`scripts/lib/regulatory.mjs`, the declaration both gates are stated in.

The gate outranks every other consideration. CLAUDE.md section 1: the firm's
TBPELS registration is pending and no licensed PE is on staff, and until both
are real, nothing on any of these sites may state or imply that engineering
services are currently offered or performed.

### 1.1 sealedengineering.com/ (the home page)

The sentence, quoted exactly, with the two paragraphs above it for context:

> A professional engineer's seal is a statement that a licensed individual
> reviewed the evidence and reached the stated conclusion, and that their
> license stands behind it. It is not a formality, it is not a rubber stamp, and
> it is not available on request.
>
> That is why nobody here will tell you in advance what a letter will conclude,
> and why a document that does not support certification comes back with the
> reason and the remedy rather than with a signature. It is also exactly why the
> seal is worth anything to the permit office or the underwriter receiving it.
>
> **Engineering work is performed under the license and registration of 254
> Engineering Services LLC.**

Matched by `PRESENT_TENSE_SEALING`, whose stated reason is "states the
engineering is being carried out now, passive".

**What is wrong with it**, precisely, because the surrounding copy is good and
should not be rewritten wholesale. The sentence asserts two things the gate
covers at once: that engineering work IS being performed, and that a firm
registration EXISTS to perform it under. The registration is pending.

The page does carry a pending disclosure somewhere, verified by reading the
whole rendered text, but **not adjacent to this sentence**. A reader meets the
claim eight paragraphs before they meet the qualifier.

### 1.2 sealedengineering.com/contact

> LEGAL ENTITY
>
> Sealed Engineering is a brand of 254 Engineering Services LLC. **All
> engineering work is performed under that entity's license and registration.**
>
> Firm registration pending with the Texas Board of Professional Engineers and
> Land Surveyors.

Same pattern, same sentence in substance. **This one is materially better and
that is why both are quoted with their context rather than listed as two
identical hits**: the pending disclosure is on the very next line. A reader
meets the claim and the qualifier together.

### 1.3 The recommendation, which is a recommendation and not a ruling

The operator has not ruled on the wording. What this sweep can say:

- **The home page one should move or be qualified in place.** A claim about a
  registration, with the fact that the registration is pending eight paragraphs
  away, is the shape the gate exists to prevent.
- **The contact page one is arguably already honest.** Its qualifier is adjacent
  and unambiguous. It still matches the declared pattern, which is worth knowing
  rather than silencing.
- **Neither should be fixed by deleting the honest sentence.** `regulatory.mjs`
  records at length why a check that matches a claim and its denial identically
  teaches whoever runs it to delete the honest sentence to get a green board.
  The fix is to make the claim true or to qualify it, not to remove the
  disclosure that sits near it.

### 1.4 How to find these again in that repository

`voice-audit` in this repository reads `scripts/lib/regulatory.mjs` and runs
against a sitemap. If the sibling has an equivalent, point it at the live host.
If it does not, the smallest useful thing is to copy `regulatory.mjs` across,
because the two gates are the same two gates: the firm registration and the
engineer of record. They are properties of the FIRM, and all three brands are
one firm.

---

## 2. What this sweep did NOT check on that site

Stated so the next session does not read a green where none was measured.

- **Only the compliance patterns, the routes, the links and the images** were
  checked. 55 routes from the live sitemap, all answering 200, all same origin
  links resolving, all images loading.
- **No form was submitted**, in either direction. The accept path was
  deliberately not pressed on any live site, because an accepted form is a real
  enquiry in a real inbox.
- **No signed in surface was opened.** If that site has one, nothing here has
  ever looked at it.
- **Nothing was checked for the doorway rule.** `registry-audit` scores
  similarity across all three live sitemaps and is the tool for that; it was not
  part of this sweep.
