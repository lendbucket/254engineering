# Brief: stampmyplans

**Written 2026-09-07 from `254engineering`, for a session opening cold in
`~/projects/stampmyplans`. Nothing in this document was executed from here.
Standing operator instruction: that repository is not to be touched from this
one, so everything below is written to be executed there, by a session that has
read it first.**

Two of the three tasks below are the same as sealedengineering's and are written
out again rather than cross referenced, because a brief that sends the reader to
another brief is a brief that gets half read. The third is this brand's own
problem and it is the one that decides whether the site is a business or a
placeholder.

What this brief cannot do is describe that repository's own tree. It has not
been read. Where a step depends on what is actually there, the step says what to
verify rather than asserting what is true.

---

## Order of work

1. **The regulatory pattern library.** First, ahead of whatever the session was
   opened for. Operator ruling, 2026-09-05.
2. **The order flow.** This matters more here than anywhere else. The brand's
   entire promise is getting plans stamped, and the site cannot take an order.
3. **The corpus.** Nine indexable pages is not a site competing for anything.

The environment variable position at the end is not a task. It is a fact that
constrains the timing of a database cutover happening in `254engineering`.

---

## 1. Sync `scripts/lib/regulatory.mjs`, then run the gate and read what it says

### Why this is first

stampmyplans carries 9 pages written under the same regulatory gate as the other
two brands: a Texas engineering firm whose registration is pending, which may
not state or imply that engineering services are currently offered or performed.

Nine pages is a smaller exposure than sealedengineering's 55 and it is not a
smaller risk per page. This brand's whole proposition is a regulated act. "We
stamp your plans" is exactly the sentence the gate forbids, and it is the
sentence the domain name promises.

On 2026-09-05 three patterns and one guard were added to the library here, and
the first run after adding them found a live breach on `254engineering`:
`/government` had been serving "254 Engineering Services delivers inspections,
sealed engineering letters, certifications, and design" to procurement officers.
It had been live for weeks with every audit green, because the library was
written for the first person and the passive voice and had no pattern for a
brand writing about itself by name.

stampmyplans' detector is the version without those patterns.

### What to copy

`~/projects/254engineering/scripts/lib/regulatory.mjs`, **verbatim**, over the
top of the local copy. It is a synchronized file by design, like
`data/keyword-registry.ts` and `data/catalog.ts`: one detector copied three
times rather than three detectors that drift.

Do not merge selectively. If the local copy has diverged in the other direction,
stop and report it rather than resolving it by hand.

### What is in it that was not before

**`CONDITIONAL_GUARD`.** A lookbehind that refuses a match when the sentence is
conditional: "when the firm stamps", "once the registration issues". It covers
an optional determiner, because "when **the** engineering work is completed" is
the same sentence with an article in it. A detector that flags the careful
phrasing teaches whoever runs it to delete the honest sentence to get a green
board.

**The third person brand claim.** `254 Engineering Services|Sealed
Engineering|StampMyPlans|the firm` followed by `performs|provides|delivers|
issues|seals|stamps|inspects|certifies`. **`StampMyPlans` and `stamps` are both
in that pattern**, which makes this the brand it is most likely to fire on.
That is not a reason to soften it.

**"performs and seals".** Its own pattern, because that exact phrase was written
onto three screens here in Phase 9 Section 4 and nothing in the suite saw it.

**A passive pattern with an agent lookahead**, so "performed by independent
contractors" stays legal while "plans are stamped" does not.

### What to run, and what to do with the result

```
npm run voice-audit
npm run launch-audit
```

Both, **before changing any copy**. Report what it catches before fixing it: a
page that has been serving a claim for a month is a page whose fix belongs in a
commit that says what it said, how long it said it, and what it says now.

Then inject a violation and watch it fail, before believing the green. Put
`StampMyPlans stamps residential plans` into any page, run `voice-audit`,
confirm it fails, remove it. An audit that has never failed has never been
tested, and this one has just changed shape.

---

## 2. The order flow, which this brand needs most

### Why it ranks above the corpus here

Sealed Engineering and 254 both have other ways to start a relationship: a
contact form, a coverage page, a procurement audience that reads before it buys.
This brand does not. Somebody arrives with a set of drawings and a deadline, and
the site's entire job is to take that job. It currently cannot, which means every
visitor who is ready to buy leaves without a way to.

### What "the order flow" means

A visitor picks a service, answers what that service needs to be quoted and
performed, pays, and receives a reference. In `254engineering` it is:

```
data/catalog.ts            what can be ordered, at what price, needing what
/order/start/[slug]        the flow, one step at a time
/api/order-flow            the write, then Stripe Checkout
/order/[reference]         what they see afterwards
```

`data/catalog.ts` is **synchronized, copied verbatim, never rewritten locally.**
Copy it from `~/projects/254engineering/data/catalog.ts`. Every price in it was
given by the operator on 2026-09-03; none was derived or estimated. A second
catalog is a second set of prices, and the first time one is updated and the
other is not, a customer is quoted one number and charged another. `order-audit`
in `254engineering` compares all three live sites and fails on a price that
disagrees.

### What is copied and what is written fresh

**Copied verbatim:** `data/catalog.ts` and `scripts/lib/regulatory.mjs`.

**Written fresh, without exception:** every rendered sentence. The doorway rule
is absolute: no page may share substantial copy, structure, headings or
paraphrase with a sibling page on the same subject, and any page that could be
find and replaced into a sibling page fails and is rewritten. This brand sells
to a contractor with drawings and a deadline. 254 sells to a procurement officer
and Sealed Engineering to a different buyer again. The catalog is the same; the
words are not.

**Engineering patterns may be shared.** The step machine, the validation shape,
the checkout call, the reference format.

### The gate applies to the flow itself

While registration is pending, a checkout that takes money for a stamped plan
states by its existence that the firm stamps plans. In `254engineering` the flow
is gated by `isPrelaunch()` and the entry page reads it directly; `/order`
redirects to `/waitlist` while the gate is on. Whatever the shape here, the
equivalent has to be true and `launch-audit` has to assert it in both modes.

**And the redirect must be a 307, never a 308.** A permanent redirect is cached
hard by browsers and crawlers, so every client that saw one would go on sending
itself to `/waitlist` after launch without asking the server, and the highest
intent page on the site would be unreachable for exactly the people who visited
before. If this repository redirects `/order` the same way, assert the 307 with
that reasoning in the check.

### What it needs from the environment

`STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`, in test mode until the firm is
open. One warning worth carrying: on 2026-09-03 a preview here was configured
with an `sk_live` key by mistake, and the first order placed against it produced
a real checkout page for 675 dollars on a probe order for a property that does
not exist. Nothing was charged, because a Checkout Session is only a page until
somebody pays, but the plan for that test was to put a card through it.
`254engineering` now refuses to build a Stripe client when a live key is present
off production. Build the same refusal before the first key is set.

---

## 3. Nine indexable pages, and what it would take to compete

Nine against 46 and 55 is not a site competing for anything. It is a brochure
with a domain name that happens to be the best of the three: somebody searching
for how to get plans stamped is searching for this brand's name without knowing
it.

**What is missing is not volume, it is the shape of a corpus.** Volume without
differentiation makes it a doorway, and `registry-audit` in `254engineering`
fetches all three live sitemaps and fails on a similarity score above 0.75. The
work is to write the pages this brand can write that the other two cannot.

What that means concretely, in the order it earns:

**The process pages.** What plan stamping actually is, what a reviewing engineer
looks for, what makes a set of drawings reviewable, what gets a submission
rejected by a plan reviewer, and how long each stage takes. This is the corpus
the domain promises and none of it exists. It is also the corpus the other two
brands should NOT write: 254 is institutional and Sealed Engineering has its own
buyer.

**The jurisdiction pages, carefully.** What a specific city or county building
department requires of a stamped submission is real, specific, and useful, and
it is also the doorway trap if it is minted mechanically. The rule from
`254engineering`'s standing law applies: a page ships only if it contains
substantial information true of that place specifically, which could not be
produced by find and replacing the place name. Two done properly beat forty
minted.

**The document pages.** What a contractor actually receives, what a stamp means
legally in Texas, what responsible charge requires of the engineer signing, and
what a stamped drawing does not certify. That last one is the honest page nobody
writes and the one a careful buyer searches for.

**What must not be done to reach a number.** No service by city combinations, no
thin county pages, no reworded versions of 254's or Sealed Engineering's pages,
and nothing written before `data/keyword-registry.ts` has been read: it is
synchronized across all three repositories and records the angle each brand
takes on each topic, so a writer opens it to find out how this brand's treatment
differs.

**Sequence.** The content engine here is two phases and the first one stops for
operator approval: one batched research pull with the expected cost stated
before the call, delivered as a proposal with volume, difficulty, what ranks
today, why it is beatable, a cannibalization check against the registry and the
other two sites, and the internal link plan. Writing starts after approval, not
before.

---

## The environment variable position, and why it has a deadline

**State this plainly to the operator before touching anything here.**

stampmyplans writes `eng_leads` and `eng_orders` in the **shared** Supabase
project that `254engineering` currently calls production
(`fsaryeciduszuahgjbly`). That was confirmed by reading this repository's
`.env.local` on 2026-09-03. **Re-confirm the deployed value in its Vercel
project** rather than assuming the local file matches it.

254's portal is deliberately the shared inbox for all three brands: it reads
leads and applications with **no site filter**, verified by reading the queries.

`254engineering` is in the middle of a database cutover to a new Supabase
project (`docs/production-cutover-plan.md`). The consequence is exact:

> If 254 cuts over and stampmyplans does not, stampmyplans keeps writing leads
> into the old project while the only screen anybody opens reads the new one.
> There is no error, no gap in a sequence, and nothing to notice. It surfaces as
> a customer who was never called back.

There is no data to move: every row in the shared tables carries `site = '254'`
and the sisters have written none to date. The cost is future writes going to
the wrong place.

**The position today:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` move in
the same window as 254's cutover, followed by a redeploy. That window is the
operator's to schedule, and the cutover plan stops before the step that would
make the divergence live.

**The position that is being built:** an intake API on `254engineering`, so the
sisters POST a lead rather than writing Supabase directly. It removes the shared
table coupling permanently and means this repository stops holding a service
role key for somebody else's database. It is being built there before the
cutover completes, so **check the cross repo section of
`254engineering/BACKLOG.md` before acting on this paragraph.**

---

## What not to do

- Do not edit `scripts/lib/regulatory.mjs` or `data/catalog.ts` locally. They
  are copies, and an edit is an invisible divergence.
- Do not copy rendered sentences from either sibling. Templates yes, prose
  never.
- Do not invent a price, a turnaround, a project count, or a credential.
- Do not write pages to reach a number. Nine honest pages beat forty that make
  the site a doorway network, and the similarity check will say so.
- Do not reach into `254engineering` to change anything. Read it, copy the
  synchronized files, and leave it alone.
