# Brief for the next StampMyPlans session

This file lives in the 254 Engineering Services repository and describes work
that belongs to a DIFFERENT one. It exists because a finding was made here, on
the live deployment, and there was nowhere in that repository to put it.

**Nothing in this file may be acted on from this repository.** Operator ruling,
2026-09-10: the sibling sites are not touched from here, ever. Carry the item
across by hand, into that repository, in that session.

---

## 1. THE COMPLIANCE GATE: one sentence on the live site, and this is the first item

Found 2026-09-10 by the overnight sweep's Round 2, which reads the three live
deployments signed out and matches the rendered text against
`scripts/lib/regulatory.mjs`, the declaration both gates are stated in.

The gate outranks every other consideration. CLAUDE.md section 1: the firm's
TBPELS registration is pending and no licensed PE is on staff, and until both
are real, nothing on any of these sites may state or imply that engineering
services are currently offered or performed.

### 1.1 stampmyplans.com/terms

The sentence, quoted exactly, with the paragraph above it for context:

> One round of revisions on a set we reviewed is included. Revisions are a
> normal outcome of engineering review. Redesign, a change of scope, or a new
> structure is new work and is quoted separately.
>
> We may decline any job. In particular we decline work outside the competence
> of **our engineers**, because accepting it would itself be a violation of
> professional practice rules.

Matched by `PRESENT_TENSE_OFFER`, declared in `regulatory.mjs` as:

```js
{ pattern: /\bour engineers\b/i, why: "plural engineer fiction" }
```

**This is the sharpest of the three found across the two sibling sites**, and it
is worth being clear why. The other two say engineering work is performed under
a named entity's registration, which is a claim about an ENTITY and sits beside
a pending disclosure. This one states a fact about STAFFING. It says the firm
has engineers, in the plural, whose competence bounds what it will accept.

No licensed Professional Engineer is on staff.

### 1.2 The extra weight this one carries

It is on the **terms** page. That is the document a customer is deemed to have
read and agreed to, and it is the one a regulator or a lawyer reads first. A
staffing claim in a paragraph about professional practice rules is not marketing
copy that overreached; it reads as a representation.

### 1.3 The recommendation, which is a recommendation and not a ruling

The sentence is trying to say something true and worth saying: that the firm
declines work outside its competence, and that accepting such work would itself
be a violation. That is a good clause. The only problem is the possessive
plural.

Rewriting it to describe the standard rather than the staff keeps the clause and
removes the claim. The operator has not ruled on the wording, and this is the
sibling's session to write.

**Do not fix it by deleting the clause.** `regulatory.mjs` records at length why
a check that matches a claim and its denial identically teaches whoever runs it
to delete the honest sentence to get a green board. The clause about declining
work is the honest part.

### 1.4 How to find these again in that repository

`voice-audit` in this repository reads `scripts/lib/regulatory.mjs` and runs
against a sitemap. If the sibling has an equivalent, point it at the live host.
If it does not, the smallest useful thing is to copy `regulatory.mjs` across,
because the two gates are the same two gates: the firm registration and the
engineer of record. They are properties of the FIRM, and all three brands are
one firm.

**Worth knowing before you start:** this repository's own hand written attempt
at these patterns found only THIS sentence and missed both of the
sealedengineering ones. The declared list has 22 patterns and carries a negation
guard and a conditional guard, so "we do not seal" and "once the firm is
registered it will perform" are not reported as claims. Writing your own is how
two of the three get missed.

---

## 2. What this sweep did NOT check on that site

Stated so the next session does not read a green where none was measured.

- **Only the compliance patterns, the routes, the links and the images** were
  checked. 9 routes from the live sitemap, all answering 200, all same origin
  links resolving, all images loading.
- **Nine routes is a small site**, and this sweep deliberately does not judge
  that. How many pages a sibling repository publishes is its own decision, and
  the count is reported rather than gated. It is recorded here only so that a
  future run seeing a much smaller number knows what it was on this date.
- **No form was submitted**, in either direction. The accept path was
  deliberately not pressed on any live site, because an accepted form is a real
  enquiry in a real inbox.
- **No signed in surface was opened.** If that site has one, nothing here has
  ever looked at it.
- **Nothing was checked for the doorway rule.** `registry-audit` scores
  similarity across all three live sitemaps and is the tool for that; it was not
  part of this sweep.
