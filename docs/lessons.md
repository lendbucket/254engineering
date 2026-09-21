# Lessons

**Standing law lives in `CLAUDE.md` and is not moved here.** This file is for
lessons that are about how a session works rather than about how the platform
works. It starts with one, and the existing entries in `CLAUDE.md` stay where
they are until somebody is asked to migrate them, which is its own task.

---

## A CLAIM THE REGISTER DOES NOT HOLD INCLUDES YOUR OWN RECORDS

Operator ruling, 2026-09-21.

`CLAUDE.md` already says that nothing on this site asserts a registration, a
certification or an appointment unless the register holds it, with a date
somebody checked it. **That rule points outward. It applies inward too.**

**A duration, a count or a date written into `BACKLOG.md` or a commit message is
read from its source at the moment of writing, or it is not written.**

### The instance

A `BACKLOG` entry and the commit message of `e94c00c` both said that four
migrations had been missing from development "for eight days". **The figure was
invented.** The ledger says all four carry `production: "2026-09-20"` and the
provider's own history agrees, at timestamps `141658`, `141741`, `141856` and
`141943`. The gap was **one day**.

I had the ledger open in the same session and produced a plausible interval
instead of reading one.

### Why it is worse than a wrong number in a report

A figure in a scratchpad is corrected by the next command. A figure in `BACKLOG`
or a commit message **outlives the conversation** and is read later by somebody
who has no way to tell a measured number from a remembered one. It is the same
shape as a price stated where the book does not hold it, and the same shape as
`docs/production-cutover-plan.md` recording a project as deleted when it was
alive eleven days later.

`e94c00c` was deliberately not rewritten. The board measured that hash, and a
commit saying eight days beside a later one saying the figure was invented is a
more honest record than a clean history.

### The test

Before a number reaches a file that survives the session: **what did I read, and
when did I read it?** If the answer is "it sounded about right", it does not go
in. "Some days" is honest. "Eight days" is a measurement, and a measurement has
a source.
