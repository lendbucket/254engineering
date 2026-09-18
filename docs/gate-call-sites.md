# THE GATE'S CALL SITES, CLASSIFIED BEFORE ANY BEHAVIOUR CHANGED

Operator ruling, 2026-09-17: enumerate and classify every call site before the
boolean becomes three states. His reason, which is the reason this document
exists rather than a commit message:

> A boolean widened to three states silently keeps its old meaning at every site
> nobody reclassified, which is this build's recurring defect wearing a refactor.

## A CORRECTION TO THE FIGURE I GAVE HIM

I reported **41 call sites across 31 files**, from one grep, and flagged it as a
lower bound rather than a survey. The enumeration says the total was right and
the breakdown was not:

| | |
| --- | --- |
| `isPrelaunch()` invocations **outside** the gate | **36**, across **30** files |
| invocations **inside** `src/lib/launch.ts` itself | 5 |
| total | 41 |

The 41 was a count of every invocation including the gate's own internals,
presented as a count of consumers. Same defect as the seventeen registration
sentences that turned out to be forty three: a bounded look reported as the size
of the thing.

## THE THREE STATES

| | Says | Takes |
| --- | --- | --- |
| `prelaunch` | no present tense service claims | nothing |
| `trading` | registered, engineer of record, services in the present tense, prices | enquiries and quotes. No online order, no card |
| `open` | everything | orders per line, where that line's protocol is approved |

## THE CLASSIFICATION

Four categories rather than the three proposed, because the enumeration produced
a category the proposal did not have: sites whose suppression is correct under
`trading` **for a different reason than the one currently gating them**. Those
are the dangerous ones, and there are nine.

### Lifts under trading: copy that was waiting for the firm to be registered (12)

| Site | Suppresses today |
| --- | --- |
| `src/app/(site)/careers/page.tsx:79` | the "Where the firm is today" aside |
| `src/app/(site)/careers/[slug]/page.tsx:100` | the "Building the bench" aside |
| `src/app/(site)/contact/page.tsx:27` | prelaunch contact copy |
| `src/app/(site)/page.tsx:57` | homepage prelaunch framing |
| `src/components/home/HomeHero.tsx:39` | hero prelaunch framing |
| `src/components/site/SiteHeader.tsx:40` | the header status block |
| `src/components/site/SiteFooter.tsx:59` | " Opening soon." |
| `src/components/launch/PrelaunchNotice.tsx:22` | the whole notice, returns null when lifted |
| `src/components/launch/OfferCta.tsx:41` | the waitlist call to action |
| `src/app/(site)/waitlist/page.tsx:47` | the waitlist page's own copy |
| `src/content/careers.ts:53` | future tense engineer sentence |
| `src/content/model-copy.ts:93` | `anyGateDown()` |

### Stays shut under trading, gated on the MONEY path (4)

These move from `isPrelaunch()` to the Stripe condition. `trading` takes no card,
so every one of them is still correct, and each is currently right by accident.

| Site | Suppresses today |
| --- | --- |
| `src/app/portal/(app)/intake/page.tsx:75` | the "cannot be charged for" banner |
| `src/app/portal/(app)/intake/page.tsx:85` | the `prelaunch` prop into the intake form |
| `src/lib/ops-job-billing.ts:253` | payment options for a job |
| `src/lib/ops-job-intake.ts:258` | payment options at intake |

### Stays shut under trading, gated PER LINE on the approved protocol (11)

The discipline gate already built. A line opens when its protocol is approved,
which is the operator's ruling, and none is approved today.

| Site | Suppresses today |
| --- | --- |
| `src/app/(site)/order/start/[slug]/page.tsx:46` | the order start screen |
| `src/app/account/order/page.tsx:28` | bulk ordering |
| `src/app/api/order-flow/route.ts:65` | order creation |
| `src/app/api/orders/route.ts:85` | order creation |
| `src/app/api/v1/orders/route.ts:103` | API order creation |
| `src/lib/ops-bulk.ts:87` | `orderBlockedReason` |
| `src/lib/ops-intake.ts:252` | `orderBlockedReason` |
| `src/lib/ops-intake.ts:583` | `orderBlockedReason`, quote path |
| `src/lib/ops-files.ts:266` | `sealed` and `delivered` file statuses |
| `src/lib/ops-review.ts:173` | the seal action |
| `src/lib/ops-engineer.ts:365` | `canReview` |
| `src/lib/schema.tsx:167` | JSON-LD `offers` availability InStock |

### Stays shut, and NOT because of the gate at all (3)

The category the proposal missed. Each is suppressed by `isPrelaunch()` today
and would lift with it, and each should stay suppressed for a reason that has
nothing to do with whether the firm trades.

**`src/lib/ops-retention.ts:99`** blocks retention execution, dry run only. That
is an operator ruling about destroying records, not about trading. Lifting it
with the gate would arm a deletion path on the day the firm opens for enquiries.
It keeps its own condition and does not move.

**`src/lib/ops-announce.ts:57`** blocks the launch announcement email, whose text
says the firm is open for orders. Under `trading` that is still false, because no
line takes orders. It gates on `open`.

**`src/lib/partner-copy.ts:97`** applies the REGULATED voice patterns to partner
copy only while prelaunch. Those patterns refuse present tense service claims.
Under `trading` the firm may make them, so the check would switch itself off at
exactly the moment the copy starts making claims. It needs rewriting rather than
reclassifying, and it is flagged for a ruling rather than changed tonight.

## `peInResponsibleCharge()`, AND THE THREE SENTENCES THAT MUST NOT SIMPLY FLIP

The operator ruled the circularity out: the question "is a licensed engineer in
responsible charge" is a fact about the register and answers from
`activeEngineer()` alone. He also ruled that the dependants are enumerated first,
and that swapping a right outcome reached by accident for a wrong one reached by
logic is the failure to avoid. **That instruction paid for itself three times.**

Eleven dependants, all copy, in three files. Each picks between a present tense
sentence and a future tense one. Eight are safe to flip. Three are not.

**`turnaroundCopy()` in `src/content/model-copy.ts:86`.** Its future branch
refuses to quote any turnaround. Its present branch returns the service's own
turnaround string. Flipping it publishes a turnaround figure for every service
line, and tonight's limits say never invent a turnaround and leave it as a marked
placeholder the operator owes. **Today the right outcome is reached by the wrong
reason**, and fixing the reason would ship the figures.

**`specialistsCopy()` in `src/content/model-copy.ts:57`.** Its present branch
says the firm holds "engineers appointed by the Texas Department of Insurance for
windstorm inspections". The credential register records that no engineer here
holds a TDI appointment. Flipping this sentence creates a false credential claim
on the same night the SAM claim was removed for being one, and the new credential
check would not catch it, because it does not name TDI in those words.

**`centralReviewCopy()` in `src/content/model-copy.ts:50`.** Its present branch
says "the same engineers see the same protocols". The firm has one engineer.

A fourth, found while reading rather than from the enumeration: the homepage
credibility strip says **"Licensed Texas Professional Engineers in responsible
charge"**, plural, with one engineer on the register. It does not read
`peInResponsibleCharge()` at all, so no classification would have surfaced it.

## WHAT THIS MEANS FOR THE ORDER OF WORK

The gate change cannot ship with the copy change behind it, because three of the
copy sites become false the moment the fact answers honestly. The turnaround
placeholder, the TDI sentence and the plural engineers are fixed in the same
commit as the untangling, not after it.
