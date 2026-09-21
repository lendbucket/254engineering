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

### Third instance, same day: a date is read from the register, not recalled

A sitting report said 254-RC-001 v1.1 was signed "two days ago". **It was signed
2026-09-20, which was yesterday**, and the approval page carrying that date had
been on screen in the same session, transcribed by hand, hours earlier.

**Three wrong figures in one day, from one root.** Eight days, five constraints,
two days ago. Each was produced from recollection while the source was open, and
each was caught by somebody or something other than the session that wrote it:
the ledger caught the first, the operator's read-back specification caught the
second, the operator caught the third.

**That the source was open is what makes this a pattern rather than three slips.**
A figure invented with no source available is a guess anybody would flag. A
figure produced from memory when the register is one command away reads as
recalled rather than guessed, which is why it survives the writing.

### Second instance, same day: a count is produced by COUNTING the source

**A count is produced by counting the source, not by describing a list.**

A sitting report given to the operator before a production migration said
0054 had "**Five check constraints:**", then listed five, then added "Plus the
`responded_at`/`responded_by` pairing that 0050 and 0049 carry". **The list is
six.** The sentence undercounted its own contents, and the operator took the
figure from the sentence and wrote it into the read-back he specified.

The read-back returned six. Production, development and the replay all read six
and always had: `asking_as_ck`, `openings_rated_ck`, `response_is_named_ck`,
`will_open_up_ck`, `work_after_building_ck`, `years_are_plausible_ck`. **No
schema difference existed. The only thing that differed was a figure in a
report**, and it stopped a production sequence to establish that.

**Why this is the same lesson and not a smaller one.** The first instance
produced a number from nothing. This one produced a number from a real list by
summarising it instead of counting it, which is harder to catch precisely
because the source was right there and looked consulted. A prose summary that
ends "plus" has already stopped counting.

It also travelled further than the first. A wrong figure in a report becomes the
operator's expectation, and his instruction then encodes it. He is checking your
work against your own arithmetic.

