# Bulk table actions: the drawing read against the code

Phase 12 Section 4, Section 1. **This document is the reconciliation CLAUDE.md
section 2c requires, and it comes before anything is styled.**

> A design is drawn against a DESCRIPTION of the platform, and every claim it
> makes about money, contact or capability is wrong until it has been read
> against the code. Operator ruling, 2026-09-08.

The approved prototype, `design-reference/portal/254 Portal v2.dc.html`, models a
selection toolbar on the Files screen: a count reading `{{ fileSelCount }}
selected` and three buttons. Their handlers are:

```js
bulkExport:   () => fireToast(fileSelCount + ' files exported to CSV'),
bulkAssign:   () => fireToast(fileSelCount + ' files assigned — pick an owner in the dialog'),
bulkDispatch: () => fireToast('Dispatch offers queued for ' + fileSelCount + ' files'),
```

Three toasts. Read against the code, they describe three different situations,
and only one of them is a feature waiting to be built.

**The rule is not that the design is wrong.** It got the SELECTION right, and
selection is the part this platform genuinely lacks and genuinely needs. What
follows is a verdict per artifact, which is the order section 2c fixes.

---

## 1. Export — a capability the platform does not have, and can have

**Drawn:** "N files exported to CSV."

**In the code:** `REPORTS` in `src/lib/ops-reports.ts` carries four exports:
revenue, production, pipeline, partner. Every one is keyed on a PERIOD and a
SCOPE, carries a manifest, and produces a `report.export` job recording that the
firm handed a statement about itself to somebody. There is no files export, and
a selection of rows is not a report: it has no period, and a manifest that said
it did would be inventing one.

**Verdict: build it, as a different thing from a report.** A CSV of the rows a
person is looking at is an ordinary and useful operation, and calling it a
report would put it into a module whose whole shape is about periods.

**What Section 2 of Phase 12 taught, and this must not repeat.** Four defects
came out of reading exports rather than reading code, and every one of them
applies here:

- an export whose manifest said "Real records only" above eighteen
  demonstration rows;
- amounts written in cents, so a $675.00 refund would have reached an
  accountant as `67500`;
- figures counting a seeded client;
- a coverage claim the data did not support.

So a bulk export states what it is, names how many of its rows are
demonstration rows rather than filtering them silently, and writes money in
dollars.

---

## 2. Assign — an operation this platform deliberately does not have

**Drawn:** "N files assigned — pick an owner in the dialog."

**In the code:** a file has two people on it and NEITHER is assigned by anybody.

| Column | Written where | By what act |
| --- | --- | --- |
| `assigned_engineer_id` | `ops-engineer.ts:300`, one place | An engineer TAKES a file into review, setting it to themselves |
| `assigned_tech_id` | `ops-field.ts:782`, one place | A technician ACCEPTS an offer |

Both are consequences of somebody accepting work. Nothing in this platform gives
a file to a person, and that is not an omission: an offer that can be declined
is the whole shape of dispatch, and a review somebody chose to take is the whole
shape of responsible charge.

**And the engineer half is regulated.** `assigned_engineer_id` is the record of
who is in responsible charge. Migration 0039 has just made it a foreign key with
`ON DELETE RESTRICT` precisely because that record must always name an engineer
the database can find. A bulk assign puts one engineer's id onto up to three
hundred files in a single press, performed by an administrator who is not that
engineer, and there is no Texas reading in which somebody else's click places a
PE in responsible charge of work they have not seen.

**Verdict: REFUSED unless the operator rules otherwise, and the refusal belongs
in Section 2 as a thing bulk must not do.** If some form of it is wanted, the
question to answer first is which of two different features it is: bulk OFFER to
a technician, which is item 3, or a bulk request that an engineer take files
into review, which is an invitation and not an assignment.

---

## 3. Dispatch — half real, and the missing half is a decision about money

**Drawn:** "Dispatch offers queued for N files."

**In the code:** `sendOffers(actor, fileId, techIds, options, context)` sends
offers for ONE file to a CHOSEN set of technicians. Which technicians is not
incidental: `dispatchContext` computes it from coverage, certification and
distance, and the dispatcher looks at that plan and picks.

The drawing's toast names no technicians. For it to mean anything, bulk dispatch
would have to choose them, file by file, without a person looking.

**That is a decision about who gets paid.** Offers are how field technicians get
work, the plan ranks them, and a bulk action that always takes the top of the
rank is a bulk action that routes the firm's field spend by an algorithm nobody
has ruled on. It is also the shape most likely to look fine for a month.

**Verdict: buildable, and not without a ruling on the selection rule.** The
honest version sends offers to the technicians the existing plan proposes for
each file and says so plainly, per file, before anything is sent, so the bulk
action is a review of N plans rather than a press that fans work out invisibly.

### Built, and then PROVED, 2026-09-10

The ruling is a statement about two computed answers being the same answer, and
for a while it was enforced only by checks that read source: that the panel
preselects nothing, that bulk calls `sendOffers`, that no offer-to-everyone
shortcut exists. Every one of those is worth having and not one of them can see
what the ruling says.

`bulk-audit` now computes both and compares them, field by field, in order:

| | |
| --- | --- |
| the SINGLE path | `dispatchContext(actor, file).plan.offers` |
| the BULK path | `dispatchPlans(actor, [id]).plans[0].offers` |

compared on `techId`, `rank`, `miles`, `openJobs` and `amountCents`. And then
the part that makes it **N plans** rather than one plan applied N times: every
file is planned again as part of a batch, and each plan in the batch must equal
that file's plan alone.

**The subject is built rather than filtered for.** Development holds one file in
`needs_dispatch`, in Aransas, where no certified technician covers the service
line, so its plan is empty. Two empty lists are equal and prove nothing. Three
files are created in Nueces on `windstorm-wpi-8`, which two certified
technicians cover, and removed at the end.

**Three injections, and each catches something the others cannot:**

1. **the bulk path reverses the plan's order.** Both comparisons go red, naming
   the two technicians and their swapped ranks.
2. **the batch never offers the same technician twice**, which is a plausible
   and entirely wrong idea about spreading work. Only the BATCH comparison goes
   red: with one file there is nothing to spread across, so a check that
   compared files one at a time would have shipped it.
3. **the bulk path redacts the amount for an actor without `pricing.read`.**
   Only the DISPATCHER comparison goes red. An administrator holds
   `pricing.read` and cannot see a redaction that is not applied to them, which
   is why the comparison is run twice: once as an administrator and once as a
   dispatcher, the one role on this platform that plans dispatch without being
   allowed to see money.

What is deliberately not asserted is that a dispatcher cannot see the offer
amount. They can, and should: sending an offer without knowing what it is worth
is not a decision. The refusal is that the two paths AGREE.


---

---

## The two that were missed, and why

**These two were named in the Section 1 brief and were not reconciled at gate 1.**
That is not a judgment I made; it is one I did not know I was making. The session
was compacted before Section 1 began, and the compaction reduced the brief to one
line, "bulk operations, then what bulk must not do". Section 1's scope was then
reconstructed from BACKLOG's own entry about bulk table actions and from the
approved prototype, which is a reasonable reconstruction and was not the brief.

The gate 1 report described Section 1 as reconciled when it had reconciled three
of five drawn items. Operator ruling, gate 1: state the verdict for each of the
two the same way. Here they are.

---

## 4. Bulk messaging — refused, and it is the same refusal as Assign

**What it would mean:** one message posted into many threads, or one message to
many people, from a selection.

**In the code:** `postMessage` writes the message and then calls `raise()` for
every participant who is not the author, which writes a notification row and
queues an email. So a bulk post of one message into fifty threads is fifty
notifications and up to fifty emails, from one press.

**Why that is not merely a bigger version of the single path.** Two reasons and
the second is the one that decides it.

The first is volume, and volume alone would be manageable: the queue exists for
exactly this and `effect_mode` now says per job what each is allowed to do.

The second is what a message IS on this platform. A thread hangs off a FILE, and
the messages in it are the record of what the firm told a client about that
client's job. A message written once and posted into fifty of them is a sentence
about fifty different pieces of work, written by somebody looking at none of
them. It reads to each recipient as a statement about their property.

That is the Assign failure in a different column. Assign would have put one
engineer's name on three hundred files nobody looked at; bulk messaging would put
one sentence in fifty conversations nobody read. In both cases the bulk action is
not doing the single action many times, it is doing a DIFFERENT thing that
resembles it.

**Verdict: REFUSED, on the same ground as Assign.** What is genuinely wanted here
is almost certainly an ANNOUNCEMENT: one thing said once, to a named audience,
recorded once, and read as an announcement rather than as fifty personal replies.
`src/lib/ops-announce.ts` already exists and is that shape. If the operator wants
a message to reach many people, it should go through the thing built for saying
one thing to many people, not through the thing built for a conversation about
one property.

---

## 5. B2B CSV import — half built, and the half that exists has a live money defect

**What the brief asks for:** a B2B account uploading many properties as a file.

**In the code:** most of it is already there and has been since Phase 8.
`/account/order` carries a paste box, `BulkOrderClient.parse()` turns each line
into a property, and `splitBatch` prices and qualifies each one. What is missing
is a FILE, a header row and a column mapping. The parsing, the per property
qualification, the partial failure reporting and the checkout all exist.

**And the parser has the defect I had just fixed in my own audit an hour
earlier**, which is why it was found at all.

```
line.split(",")
```

An address with a comma in it shifts every field after it. Pasting

```
1200 Ocean Drive, Suite 4, Corpus Christi, Nueces, 78404
```

gives address `1200 Ocean Drive`, city `Suite 4`, **county `Corpus Christi`**,
postcode `Nueces`.

**That is money and it is not caught anywhere.** `splitBatch` checks the county
is PRESENT and never checks it is a real county:

- `isCoastal` asks `twiaCounties.has(county)`. "Corpus Christi" is a city, so the
  answer is false and **the coastal surcharge is not applied** to a property on
  the coast. The firm undercharges.
- The county also decides the protocol, so the property is dispatched under the
  wrong inspection.

The property is accepted, priced, charged and dispatched, and nothing anywhere
says a word. A suite number is not an exotic address.

**Verdict: the defect is fixed in Section 1 and the file upload is deferred.**

The defect, because it is live, it is money, and it is on the customer facing
path. Two things: the parser handles quoted fields the way `src/lib/csv.ts`
already does for output, and `splitBatch` rejects a county that is not one of the
254 rather than pricing it.

The upload is deferred because a file brings its own questions that deserve their
own gate: which encodings, what happens to a header row somebody did or did not
include, whether a column mapping screen is needed, and what a 5,000 row file
does to a request. None of that is required to close the defect, and the defect
should not wait behind it.

## The five verdicts, and what the operator ruled

| # | Drawn | Verdict | Ruled at gate 1 |
| --- | --- | --- | --- |
| 1 | Export | Build it, not as a report | Built |
| 2 | Assign | Refused | **Refused outright.** `files.assign` comes out of the authz matrix in 0040 |
| 3 | Dispatch | Needs a selection rule | **Build it as N plans**, reproducing the single path exactly |
| 4 | Bulk messaging | Refused, same ground as Assign | Reconciled at gate 1's ruling |
| 5 | B2B CSV import | Half built, with a live money defect | Defect fixed, upload deferred |

**Assign, ruled 2026-09-09:** refused outright. Nothing assigns a file to an
engineer; an engineer accepts it, and that acceptance IS the responsible charge
entry. `files.assign` is removed from the matrix in 0040, because a declared
capability nothing uses is a door waiting for somebody to build on it, and this
one leads somewhere the firm cannot go.

**Dispatch, ruled 2026-09-09:** bulk dispatch reproduces the single file rule
exactly and introduces no selection rule of its own. Whatever the single path
does for a file, bulk does N times, and the operator reviews N plans before any
offer goes out. **No technician is chosen by a bulk path that the single path
would not have chosen for that file.** If the single path has no default and the
operator picks by hand, bulk dispatch is a review screen with N picks and no
shortcut, and that is fine.
