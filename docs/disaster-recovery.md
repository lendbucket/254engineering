# Disaster recovery: a report, because it cannot yet be a test

**Phase 12 Section 5. Written 2026-09-07.**

Operator ruling, the same day: this section becomes a report rather than a test
until the database cutover happens, and the report says plainly what the firm's
restore position actually is.

**The headline, stated first because everything below is the reasoning for it:
the firm has no usable restore path today.** Not a weak one, not an untested
one. There is a mechanism, it belongs to somebody else's blast radius, and using
it would damage four other applications.

---

## 1. Why this cannot be tested

Point in time recovery rewinds a **project**. It is not per table, not per
schema, and not per row: it restores the whole database to a moment and
discards everything after it.

This firm's production data lives in `fsaryeciduszuahgjbly`, the project named
`wattsmith`, and that project is shared. Reading `pg_tables` on it on
2026-09-07:

| Prefix | Tables | Whose |
| --- | --- | --- |
| `eng_` | 68 | This firm |
| `os_` | 16 | Another application |
| `pricebook_` | 11 | Another application |
| `job_` | 3 | Another application |
| `craftline_` | 2 | Another application |
| a long tail of singletons | 14 | `offers`, `vendors`, `waitlist`, `estimates`, `subscribers`, and others |

Forty two tables that are not this firm's, in four recognisable application
families plus loose tables older than any of them. Storage tells the same story:
alongside the five `eng-` buckets sit `applications`, `coyoteville-media` with
125 objects, `coyoteville-permits` with 32, `personnel`, `resumes`,
`pricebook-photos` and more. And `auth.users` holds 8 accounts, of which
**2 belong to this firm**; the other 6 sign into applications this repository
has never heard of.

So a restore drill is not a drill. **Testing the restore means restoring, and
restoring means rewinding four other applications to a moment this firm chose,
silently discarding whatever they wrote in between.** There is no rehearsal
form of that action which leaves the other tenants untouched, because the unit
of recovery is the thing they share.

That is the whole reason this section is a report. It is not that the test is
hard, or slow, or waiting on tooling. It is that performing it would be a
destructive act against systems that did not consent to it.

---

## 2. What the firm actually has today

**A mechanism it must not use.** Supabase's backups and point in time recovery
exist on the project, and their exact retention and price were not read from
here: the dashboard is the operator's. Whatever the answer, section 1 applies.
A restore path that cannot be exercised without harming four neighbours is not
a restore path this firm can rely on, and the honest way to say that is that it
does not have one.

**No export of its own.** There is no backup script in `scripts/`, no export
job among the three registered crons (`health-watch`, `jobs`, `daily`), and
nothing writes this firm's rows anywhere outside that project. This was checked
rather than assumed.

**So the concrete position.** If somebody drops `eng_audit_events` tomorrow, or
a bad migration truncates `eng_leads`, the firm's options are:

1. Ask the operator of the shared project to rewind it, damaging the others.
2. Reconstruct from whatever happens to exist elsewhere, which for most tables
   is nothing.

Neither is a recovery procedure. **Option 1 is the only mechanism, and it is
one the firm should not take.**

---

## 3. What makes this smaller than it sounds, and what does not

**Smaller.** The volume at risk today is genuinely tiny: 2 leads, 1
application, 2 profiles, 2 auth users, 2 stored resumes, and 468 audit events.
A total loss would be recoverable by hand from email in an afternoon, for
everything except one table.

**Not smaller, and it is the one that matters.** `eng_audit_events` is the
firm's regulatory memory. It refuses UPDATE and DELETE by design, which
protects it from every ordinary mistake and from none of the ones this section
is about: a project level rewind does not go through the trigger. Those 468
rows cannot be reconstructed from anywhere, because their whole value is that
they were written at the moment the thing happened and never touched again. A
log the firm can partially reconstruct is a log that answers "we think this is
what happened", which is a different sentence from the one an append only table
exists to be able to say.

The same is true, with less at stake today because both are empty on
production, of `eng_partner_acceptances` and `eng_partner_touches`.

**And the asymmetry that should decide the priority.** The cost of the gap
today is one afternoon. The cost of the gap after the platform starts taking
orders is unbounded, and the gap does not close by itself: it closes on the
day the cutover gives this firm a project of its own, and not before.

---

## 4. What closes it, and what the cutover changes

**The cutover is the fix, and this is the clearest argument for it that has
been written down.** A project holding only `eng_` tables can be rewound
without asking anybody, which turns point in time recovery from a mechanism the
firm owns on paper into one it can actually use, and turns this section from a
report into the test it was meant to be.

**Cutover deferred by operator decision on 2026-09-07**, recorded in
`docs/production-cutover-plan.md`. That decision is not disputed here. What is
recorded here is its one consequence: **the firm holds no usable restore path
for as long as the deferral lasts**, and the deferral is the operator's to
weigh against that.

**What the test becomes on the day it can run**, written now so it is not
redesigned later:

1. Read a known figure from production, such as the `eng_audit_events` id set.
2. Write a marker row that must not survive.
3. Restore to a point before the marker.
4. Assert the marker is gone and the id set is intact.
5. Time it, and record the recovery time objective the firm can actually claim
   rather than the one the vendor advertises.

Step 5 is the point of the exercise. An untimed restore proves the button
works; it does not tell the firm how long it is down, which is the only number
anybody asks for afterwards.

**One thing that does not wait for the cutover, and is the honest interim
measure.** A scheduled export of this firm's tables to storage outside the
shared project would give the firm something it controls, today, without
touching a neighbour. It is not built, it is not in scope of this section as
the operator defined it, and it is recorded in `BACKLOG.md` as the one action
that would close the gap before the cutover does.

---

## 5. What this report deliberately does not claim

- It does not claim the backups are absent. They exist; they are unusable by
  this firm without collateral damage, which is a different fault and is stated
  as one.
- It does not state a retention window or a recovery time objective. Neither
  was read, and both are the operator's to read in the dashboard. Writing a
  plausible number here would be exactly the fabricated assurance this platform
  refuses everywhere else.
- It does not claim the restore has ever been attempted. It has not, on any
  project, by anybody, and there is no evidence in this repository that it has.
