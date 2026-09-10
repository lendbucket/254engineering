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

---

## What is being built in Section 1

1. **The selection itself**, on the Files screen: choosing rows, the count, and
   clearing it. No action attached to it is dangerous, and it is the part the
   design got right.
2. **Bulk export**, with the Section 2 lessons applied.

## What is being asked at gate 1

1. **Assign:** refuse outright, or build one of the two things it might mean?
2. **Dispatch:** build it as a review of N plans, or leave it until the
   selection rule for technicians has been ruled on?
