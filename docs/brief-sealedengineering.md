# Brief: sealedengineering

**Written 2026-09-07 from `254engineering`, for a session opening cold in
`~/projects/sealedengineering`. Nothing in this document was executed from here.
Standing operator instruction: that repository is not to be touched from this
one, so everything below is written to be executed there, by a session that has
read it first.**

This brief exists because three tasks for that repository were found while
working here, and one of them is a live regulatory exposure that the site cannot
currently detect. It is written to be executable without rediscovering anything:
every file to copy is named by path, every check to run is named by command, and
the reasoning behind each is included rather than referenced, because a session
that has to reconstruct the reasoning will reconstruct it differently.

What this brief cannot do is describe that repository's own tree. It has not
been read. Where a step depends on what is actually there, the step says what to
verify rather than asserting what is true.

---

## Order of work

1. **The regulatory pattern library.** First, ahead of whatever the session was
   opened for. Operator ruling, 2026-09-05.
2. **The `/order` 307 assertion.** Small, and it guards a change somebody is
   likely to make.
3. **The order flow.** The largest piece.

The environment variable position at the end is not a task. It is a fact that
constrains the timing of a database cutover happening in `254engineering`, and
it has to be read before anyone changes deployment variables on either side.

---

## 1. Sync `scripts/lib/regulatory.mjs`, then run the gate and read what it says

### Why this is first

sealedengineering carries 55 pages written under the same regulatory gate as
this site: a Texas engineering firm whose registration is pending, which may not
state or imply that engineering services are currently offered or performed.

On 2026-09-05 three patterns were added to the library here, and the first run
after adding them found a live breach on this site: `/government` had been
serving "254 Engineering Services delivers inspections, sealed engineering
letters, certifications, and design" to procurement officers, under a heading
that read "what this firm is built to deliver". It had been live for weeks and
every audit was green, because the library was written for the first person and
the passive voice and had no pattern for a brand writing about itself by name.

sealedengineering's detector is the version without those patterns. The question
is not whether that site is making a third person claim. It is that nobody there
can currently see one.

### What to copy

`~/projects/254engineering/scripts/lib/regulatory.mjs`, **verbatim**, over the
top of the local copy. That file is a synchronized file by design, like
`data/keyword-registry.ts` and `data/catalog.ts`: all three brands are Texas
engineering firms under the same board with the same regulated vocabulary and
the same pending gate, so the detector is one file copied three times rather
than three files that drift.

Do not merge selectively. If the local copy has diverged in the other
direction, stop and report the divergence rather than resolving it by hand: two
sites disagreeing about what counts as a regulated claim is the condition this
file exists to prevent.

### What is in it that was not before

Four things. The first is a guard, and the other three are patterns.

**`CONDITIONAL_GUARD`.** A lookbehind that refuses a match when the sentence is
conditional: "when the firm delivers", "once the registration issues", "if the
firm performs". Without it the new patterns fire on sentences that are careful
rather than careless, and the guard covers an optional determiner because "when
**the** engineering work is completed" is the same sentence with an article in
it. A detector that flags the compliant phrasing teaches whoever runs it to
delete the honest sentence to get a green board, which is worse than not having
the detector.

**The third person brand claim.** `254 Engineering Services|Sealed
Engineering|StampMyPlans|the firm` followed by `performs|provides|delivers|
issues|seals|stamps|inspects|certifies`. This is the pattern that found the live
one. Note that it names all three brands, so **sealedengineering's own name is
in it**, and running it there is the point.

**"performs and seals".** Its own pattern, because that exact phrase was written
onto three partner screens here in Phase 9 Section 4 and nothing in the suite
saw it.

**A passive pattern with an agent lookahead.** "inspections are performed",
"sealed work is carried out". The lookahead exempts the form that names an
agent who is not the firm, so `/terms` saying "performed by independent
contractors" stays legal while "inspections are performed" does not. That
exemption was added because the first version failed a correct sentence.

### What to run, and what to do with the result

```
npm run voice-audit
npm run launch-audit
```

Both, in that order, **before changing any copy**. The launch audit runs the
site in both gate modes and asserts what each must say, so a page corrected in
prelaunch that becomes wrong at launch is caught in the same pass.

Expect hits. 55 pages written before the detector existed is 55 pages nobody has
checked for this class. **Report what it catches before fixing it.** A page that
has been serving a claim for a month is a page whose fix belongs in a commit
that says so: what it said, how long it said it, and what it says now. That
record is worth more than a tidy diff, because it is the answer if the board
ever asks.

If the count is large, fix in one pass and one commit per page group rather than
one commit per sentence, and put the audit output in the commit body.

### Verifying the detector rather than trusting it

Before believing a green board, inject a violation and watch it fail. Put
`Sealed Engineering delivers sealed inspections` into any page, run
`voice-audit`, confirm it fails, and remove it. An audit that has never failed
has never been tested, and this one has just changed shape.

---

## 2. Assert that `/order` returns 307 and never 308

### The reasoning, which is the part worth carrying

In prelaunch, `/order` calls `redirect("/waitlist")`, because a form that cannot
be submitted is worse than a page that sends somebody somewhere useful. That
redirect is **temporary**. At launch, `/order` stops redirecting and becomes the
order flow.

Next's `redirect()` issues a 307 by default. A 308 is a permanent redirect:
browsers cache it hard, and so do crawlers. Every client that saw a 308 would go
on sending itself to `/waitlist` after launch, without asking the server, and
the highest intent page on the site would be unreachable for exactly the people
who had visited before. The server would be serving the right thing and the
client would never ask for it, which is close to undiagnosable from the outside.

**Why an assertion and not a comment.** The operator's first ruling on this was
to make the redirect permanent, and it was withdrawn only because the gate was
read first. A permanent redirect looks more correct to a reader who does not
know the page is gated. A comment did not stop that near miss. A check would
have.

### What to write

An assertion in that repository's own harness that a request to `/order` in
prelaunch answers **307**, and specifically not 308, with the reasoning above in
the check rather than only in a commit message.

Put it beside the existing assertion about `/order/page.tsx` carrying
`export const dynamic = "force-dynamic"`, which guards a related trap: when the
page was prerendered, `/order` served a build time redirect to `/waitlist` while
`/waitlist` evaluated the launch flag at runtime and redirected back, producing
`ERR_TOO_MANY_REDIRECTS` and an unreachable order flow. That was found by a
forms audit running a live server against a prelaunch build, which is the state
a deployment is in between an environment change and the next build.

**Not a defect today.** `/order` currently returns 307. This is a guard against
a plausible future edit.

---

## 3. The order flow

### What "the order flow" means here

A visitor picks a service, answers what that service needs to be quoted and
performed, pays, and receives a reference. In `254engineering` it is:

```
data/catalog.ts            what can be ordered, at what price, needing what
/order/start/[slug]        the flow, one step at a time
/api/order-flow            the write, then Stripe Checkout
/order/[reference]         what they see afterwards
```

`data/catalog.ts` is the same class of file as `regulatory.mjs`: **synchronized,
copied verbatim, never rewritten locally.** Copy it from
`~/projects/254engineering/data/catalog.ts`. Every price in it was given by the
operator on 2026-09-03; none was derived, estimated, or carried from another
firm's rates. A second catalog is a second set of prices, and the first time one
is updated and the other is not, a customer is quoted one number on a service
page and charged another at checkout. `order-audit` in this repository compares
all three live sites and fails on a price that disagrees, so a divergence
becomes a red board here rather than a complaint from a customer.

### What is copied and what is written fresh

**Copied verbatim:** `data/catalog.ts`, and `scripts/lib/regulatory.mjs` from
task 1.

**Written fresh, without exception:** every rendered sentence. The doorway rule
is absolute and it is in this repository's standing law: no page may share
substantial copy, structure, headings or paraphrase with a sibling page on the
same subject, and the test is that any page which could be find and replaced
into a sibling page fails and is rewritten. Sealed Engineering sells to a
different buyer than 254 does. The catalog is the same; the words are not.

**Engineering patterns may be shared.** The step machine, the validation shape,
the checkout call, the reference format: those are architecture, not sentences.

### The gate applies to the whole flow

The order flow must not become a way around the regulatory gate. While
registration is pending, a checkout that takes money for engineering services
states by its existence that the firm performs them. In `254engineering` the
flow is gated by `isPrelaunch()` and `/order/start/[slug]` reads it directly.
Whatever the shape there, the equivalent has to be true, and `launch-audit`
has to assert it in both modes.

### What it needs from the environment

Stripe, in test mode until the firm is open: `STRIPE_SECRET_KEY` and
`STRIPE_WEBHOOK_SECRET`. One warning worth carrying across, because it happened
here on 2026-09-03: a preview was configured with an `sk_live` key by mistake
and the first order placed against it produced a real checkout page for 675
dollars on a probe order for a property that does not exist. Nothing was
charged, because a Checkout Session is only a page until somebody pays, but the
plan for that test was to put a card through it. `254engineering` now refuses to
build a Stripe client when a live key is present off production. Build the same
refusal there before the first key is set, not after.

---

## The environment variable position, and why it has a deadline

**State this plainly to the operator before touching anything here.**

sealedengineering writes `eng_leads` and `eng_orders` in the **shared** Supabase
project that `254engineering` currently calls production
(`fsaryeciduszuahgjbly`). Its deployed `SUPABASE_URL` lives in its own Vercel
project and was not readable from here, so **confirm it first** rather than
assuming.

254's portal is deliberately the shared inbox for all three brands: it reads
leads and applications with **no site filter**. That is verified by reading the
queries in this repository, not by grepping around them.

`254engineering` is in the middle of a database cutover to a new Supabase
project (`docs/production-cutover-plan.md`). The consequence for this repository
is exact:

> If 254 cuts over and sealedengineering does not, sealedengineering keeps
> writing leads into the old project while the only screen anybody opens reads
> the new one. There is no error, no gap in a sequence, and nothing to notice.
> It surfaces as a customer who was never called back.

There is no data to move: every row in the shared tables carries `site = '254'`,
and the sisters have written none to date. The cost is future writes going to
the wrong place.

**The position today:** the two variables (`SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`) move in the same window as 254's cutover, followed
by a redeploy. That window is the operator's to schedule and the cutover plan
stops before the step that would make the divergence live.

**The position that is being built:** an intake API on `254engineering`, so the
sisters POST a lead rather than writing Supabase directly. It removes the shared
table coupling permanently, and it means this repository stops holding a service
role key for somebody else's database. It is being built here before the cutover
completes, and this brief will be wrong about the variables the day it ships, so
**check the cross repo section of `254engineering/BACKLOG.md` before acting on
this paragraph.**

---

## What not to do

- Do not edit `scripts/lib/regulatory.mjs` or `data/catalog.ts` locally. They
  are copies. An edit there is a divergence, and the divergence is invisible
  until somebody finds a live breach, which is how this brief came to exist.
- Do not copy rendered sentences from `254engineering`. Templates yes, prose
  never.
- Do not invent a price, a turnaround, a project count, or a credential. Every
  number is the operator's or it is not published.
- Do not reach into `254engineering` to change anything. Read it, copy the
  synchronized files, and leave it alone.
