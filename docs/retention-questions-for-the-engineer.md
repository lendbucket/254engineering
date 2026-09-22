# Retention: the questions for the engineer of record

**Operator ruling, 2026-09-22. This is not part of any protocol approval, and it
must never be attached to one.**

Aman's approval of a protocol is a single act with a single subject: whether he
will stand behind that document. Putting a records question in front of him in
the same breath makes his approval carry two answers, and a year from now nobody
can tell which one he was agreeing to. So this leaves separately, it gets its own
reply, and the platform records the reply against this document rather than
against a protocol version.

**Everything below is a QUESTION.** Nothing here states what TBPELS requires,
what a policy covers, or how long anything must be kept. This firm does not know
those answers yet, and writing a plausible one down is how an invented period
becomes a policy nobody can trace.

---

## Why this is being asked now

The platform refuses to delete a business record. That is the safe direction and
it is not a decision: it is the absence of one.

Read from `src/lib/retention-policy.ts` on 2026-09-22, the declaration holds **81
tables**:

| State | Tables | What it means |
| --- | --- | --- |
| `kept_pending_counsel` | **45** | Kept indefinitely because nobody has ruled. This is the set these questions are about. |
| `kept_forever` | 26 | Ruled, or the database itself refuses DELETE. |
| `not_a_record` | 8 | Holds nothing anybody could be asked to produce. |
| `delete_after` | 2 | `eng_cron_runs` and `eng_jobs`, machine telemetry, 30 day floor. |

Only the last two rows are decisions. The 45 are a question mark with storage
attached, and they include the firm's regulatory memory: the responsible charge
log, evidence items, sealed work records, payments, and the audit trail.

**There is no period anywhere in this repository, and one near miss is worth
naming.** `BACKLOG.md` contains a design rationale mentioning ten years, about
the responsible charge log outliving an engineer's employment. It cites no rule.
It is not evidence of a period and has not been used as one.

---

## The questions

### A. What the board requires

1. Do the TBPELS rules set a minimum period for which a Texas PE, or a
   registered firm, must retain the records behind sealed work? If so, which
   rule, and does the period run from the seal date, from project completion, or
   from something else?
2. Does that obligation sit with **you personally** as the engineer of record,
   with the **firm** as registrant F-29811, or with both independently? The
   platform can keep records under either theory, but it should keep them under
   the right one, because the two come apart the day you are no longer the
   engineer of record.
3. Does any retention duty survive the firm's registration lapsing or the
   engineer leaving? If it does, what is the firm expected to do with the records
   at that point?
4. Is there a category of record the board expects to be **producible on
   request** rather than merely retained? Producible and retained are different
   engineering problems, and the platform currently solves only the second.

### B. What a claims-made policy implies

These are questions about the professional liability cover, and they are asked
because a claims-made policy behaves differently from an occurrence policy in a
way that bears directly on records.

5. Is the firm's professional liability cover **claims-made** or
   **occurrence**? If claims-made, what is the retroactive date, and is there
   extended reporting cover?
6. Under that policy, how long after a sealed deliverable could a claim still be
   reported? Does the insurer state, or expect, a records period, and does it
   differ from whatever the board requires?
7. Does the insurer require any particular **form** of record, for example the
   evidence a determination rested on, the version of the protocol in force on
   the day, or the identity of whoever collected the evidence? The platform
   already stores all three. The question is whether it stores them in a shape an
   insurer would accept.

### C. What this platform should do differently

8. Of the 45 tables, are there any you would want treated **more** strictly than
   "kept indefinitely", for example held where the firm cannot alter them at all?
9. Is there anything in that set you would expect the firm to **dispose of** on
   a schedule, rather than keep? A record kept forever is not free of risk: it is
   also discoverable forever.
10. Should a customer's deletion request ever reach a record behind sealed work?
    The platform records the asking and refuses the deletion today. That is a
    decision made by default rather than by you.

---

## What happens to the answers

Each answer becomes an entry in `src/lib/retention-policy.ts`, replacing a
`kept_pending_counsel` line with a ruled one that names who ruled it and when.
Nothing is deleted on the strength of a conversation. A period only becomes real
when it is written into that declaration, and `retention-audit` pins the
operator's rulings as literals so a period cannot move without two deliberate
edits.

**An answer of "I do not know, ask a lawyer" is a useful answer** and should be
recorded as one. The failure mode this document exists to prevent is a number
somebody guessed becoming the firm's records policy because it was written down
confidently.

---

## Status

**Not sent.** Drafted 2026-09-22 and awaiting the operator's review. No part of
this has been put to the engineer, and it is not attached to any protocol
approval.
