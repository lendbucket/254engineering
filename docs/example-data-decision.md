# The example data, and where it should live

Phase 10 Section 3, gate report. Report and stop, for the operator's ruling.
Nothing here is built.

I do not have the Section 3 brief in front of me, so this reconstructs the
question from the instruction: example data, stopping for a ruling on where it
goes. If Section 3 asked for something narrower, this is the wrong document and
saying so now is cheaper than building from it.

## 1. What example data is actually for

Three audiences, and they want different things. Deciding where the data lives
without deciding which audience it serves is how it ends up serving none.

**Screenshots and the verdict walk.** Needs data that looks real and, more
importantly, does not change under it. A screenshot with `Audit Probe engineer`
in the roster is not a screenshot of this product.

**Showing somebody the platform.** A buyer of the business, an insurer asking
what the firm runs on, a customer deciding whether to send work. Needs a
coherent firm: several clients, files spread across the statuses, money that
adds up, a conversation with a photograph in it.

**Training.** Aman's account was created on production today, and a dispatcher
or salesperson follows. Somebody new needs a place to click destructively.

## 2. What exists today

`scripts/seed-field-demo.mjs`, which writes technicians, coverage, a published
protocol, three files and a pay ledger. It is careful: Demo names, example.com
addresses, streets that do not exist, and `neverProduction` so it can only ever
reach development.

It is also the only example data there is. There are no example clients beyond
what it writes, no example orders, no example messages, and nothing sealed,
because nothing can be sealed while registration is pending.

## 3. The finding that decides most of this

**Development is simultaneously the demo environment and the audit target, and
the two have contaminated each other.**

Six files on development:

| File | Address | Origin |
| --- | --- | --- |
| 254-2026-9001 | 1400 Demo Bayfront Lane | seeded demo |
| 254-2026-9002 | 88 Demo Windward Court | seeded demo |
| 254-2026-9003 | 312 Demo Harbour Row | seeded demo |
| 254-2026-0007 | 1788454278 Probe Seawall Drive | probe residue |
| 254-2026-0008 | 1788455237 Probe Seawall Drive | probe residue |
| 254-2026-0009 | 1788455822 Probe Seawall Drive | probe residue |

The seeded files use a deliberate 9000 block. The probe files took **0007, 0008
and 0009 from the real numbering sequence**, so the sequence a demo would show is
already three ahead of the work that exists.

Seven profiles, six of them demo or probe. Twenty four threads. Forty two
messages. Three and a half thousand audit events, almost all of them probe sign
ins that cannot be deleted because that table refuses deletes by design.

Every screenshot in the Phase 11 walk shows some of this. The documents screen
shows a timestamp where a street number belongs. The people screen shows
`Audit Probe field_tech`. Those were true screenshots of a contaminated
database, which is exactly what they should have been, and it is not what
anybody wants to look at.

`portal-probe.mjs` now sweeps its own accounts by domain. Nothing sweeps the
files, threads, messages or evidence that probe runs created before that, and
nothing ever will, because no audit knows which rows are its own.

## 4. Where it could go

### A. Development, as now

Nothing to build. It is also what produced section 3. Every audit run adds to
it, a demo given from it shows probe residue, and the contamination is one way:
audits write into the demo, the demo never cleans up after them.

### B. Production, marked as examples

Nearest to what a demo wants: the real domain, the real deployment, no second
system to keep in step.

**I would argue hard against this and I think it is the one genuinely dangerous
option.** `eng_audit_events` refuses deletes and `eng_files` is append only in
the ways that matter. A demonstration file on production is a permanent row in
the firm's regulatory memory saying a job existed at an address. The day
registration issues, "which of these were real" becomes a question about the
firm's own record, and the answer would be a naming convention rather than a
fact. The whole platform is built so that what is written down is true.

### C. A third project, `254engineering-demo`

Clean separation. Ten dollars a month, a Vercel preview pointed at it, and one
change to `previewPointingAtProduction` so that ref is allowed. Resettable
without touching either the record or the test target.

Costs: a third schema to keep in step, which the fingerprint chain already
handles, and a second deployment to remember at launch.

### D. Nowhere, and let the empty states carry it

The empty states in this portal are unusually good, and they were written to be:
"A file gets a thread the first time somebody writes on it." "Nothing has given
up." "A period appears here once a file is opened in it."

For a customer or an insurer, an honest empty platform that explains itself may
demonstrate more than a populated one. For a buyer looking at margin by period,
it demonstrates nothing.

### E. Reproducible seed and reset on development

Keep development, and make the example data a thing you can restore in thirty
seconds: one script that removes probe residue by its signature, reseeds a
coherent firm, and is idempotent. Plus the missing half of section 3, which is
audits cleaning up the rows they create and not only the accounts.

Does not stop contamination during a demo. Does make it cost nothing to fix.

## 5. What I would recommend

**E now, and C only if you are going to show this to a buyer.**

E is a day of work, no new infrastructure, and it fixes a defect that exists
whether or not anybody ever gives a demo: audits leave rows behind that nothing
removes, and the file numbering sequence is drifting because of it. That is
worth doing on its own terms.

C is right the moment somebody outside the firm is going to look at the screen,
because on that day you want data that is coherent, stable, and cannot be
mistaken for the record. It is not worth its ten dollars and its third schema
before then.

B I would build only if you overrule me, and I would want the reason written
down in this file next to my objection.

## 6. What I would build once ruled

Whichever way it goes, three things:

1. **Probe residue gets a signature and a sweep.** Every row an audit creates
   carries something that identifies it, the same way probe accounts carry a
   domain, and one script removes all of it. The audit trail rows stay, because
   that table refuses deletes and should.

2. **The example firm becomes a described thing rather than a script's side
   effect.** Clients, files across every status, a technician mid capture, an
   engineer's declined decision with its reason, a conversation with a
   photograph in it, and a period with margin in it. Written down so what it
   demonstrates is a decision rather than whatever the script happened to make.

3. **Nothing sealed, and the demo says why.** No example file can be sealed
   while registration is pending, and faking one would be the evidence hash
   finding in a new place. The demo shows a declined decision instead, which is
   real, available today, and arguably the more interesting thing to show.

## 7. One thing that changed while I was writing this

Aman's account was created on production today at 15:08, engineer, invited, on
the firm domain. The invite path worked.

That has a consequence for the BACKLOG entry saying nobody can decline to seal:
the moment he sets his password and the account goes active, the firm can review
again. Worth knowing before any decision here, because a demo that shows a
review queue is now demonstrating something the firm can actually do.
