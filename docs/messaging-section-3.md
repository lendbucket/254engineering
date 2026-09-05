# The messaging centre: what is missing, and what is warranted here

Phase 11 Section 3, gate report. Written before anything is built, as the brief
asks. Nothing in this document has been implemented.

## 1. What exists

Phase 5 built more than the screen suggests.

**Three kinds of thread.** `file`, `direct` and `channel`, in `eng_threads`. A
file thread follows the file, a direct thread is between two people, a channel
is opened for a role.

**Unread is real and already computed.** `eng_thread_participants.last_read_at`
exists, `listThreads` derives a per thread unread count from it, and opening a
thread stamps it. This is the capability the brief asks for and it is built.

**Mentions are parsed, stored and notify.** `mentionsIn` resolves an `@firstname`
against the participants, the ids go into `eng_messages.mentions`, and the
notification kind changes to `mention` for those people. The composer says who
will be emailed before you send, which is better than most products manage.

**Notifications go through the queue.** `raise` writes the in-app row and then
enqueues `notification.deliver`. The brief's second constraint is already met and
does not need re-doing.

**An administrator cannot read a direct message.** `canReadThread` returns
participation for `kind === "direct"` with no role override, and the comment
above it says that is the point. The brief's first constraint is already met.

**Notification preferences exist per KIND.** `eng_notification_prefs`, with
`kindsForRole`, `defaultPreference` and `emailIsMandatory`, so some kinds cannot
be switched off.

## 2. What the schema declares and the code never writes

This is the fourth appearance in this phase of one pattern: a value that exists,
is used by nothing, and reads as though it works.

| Column | State |
| --- | --- |
| `eng_messages.attachments` jsonb | **Never written.** `postMessage` inserts `thread_id`, `author_id`, `body` and `mentions` and nothing else. |
| `eng_messages.edited_at` | **Never written.** There is no edit path at all. |

Both were designed in 0001 and neither was wired. The same shape as the
undeclared `--gold-wash`, the `--on-navy` scale the portal never had, and the
`DataTable` no screen used. Worth naming so it is fixed as a class rather than
twice more.

## 3. What is missing entirely

- **Search.** Nothing, anywhere. Not by text, person, file or date.
- **Attachments in the composer.** No upload path, no camera, no bucket write.
- **Edit and delete.** No path. `eng_messages` is **not** append only, so an
  UPDATE would silently rewrite what somebody already read.
- **Read receipts.** Derivable from `last_read_at` and not surfaced.
- **Presence or last seen.** Nothing.
- **Threading inside a conversation.** No parent column.
- **Per thread notification preferences.** Preferences are per kind only.
- **Retention and export.** A file's messages are in no export and not in the
  evidence binder, and there is no retention rule.
- **Pagination.** Threads are capped at 200 and messages at 500, both silently.
  That is the exact defect `TableFooter` exists to prevent: a truncated list that
  looks identical to a complete one.

## 4. The mobile composer today

A `textarea rows=3` with a Send button, in the ordinary flow of the scrolling
region. It is not anchored, so it scrolls away from the conversation. It is not
keyboard aware, so on iOS the keyboard covers it. It has no attachment control.

Its inputs are already 16px, which is the half of point 7 that was met.

## 5. What is warranted at this firm's scale, and what is not

Production holds **one** profile today. Aman makes two. Add a dispatcher and a
salesperson later and the staff roster is perhaps six, with technicians as
contractors who use the portal from a roof.

That number is the whole judgment. A messaging system for six people who mostly
know what each other are doing needs different things from one for six hundred.

### Warranted, in the order I would build them

1. **Attachments, and the camera in one tap.** The highest value item by a
   distance. A technician who cannot send a photograph from the portal sends it
   to somebody's personal phone, and the moment that happens the evidence is
   outside the record the firm would have to produce. Private bucket, same rules
   as evidence, never a public one.

2. **The mobile composer as a first class surface.** Anchored, keyboard aware,
   attachment in one tap, sends without leaving the thread. This is where point
   7 gets exercised, and per the operator's instruction it is treated as
   verification of `KeyboardAwareComposer` rather than as a use of it: the
   component was written without ever running in a browser, and this is the
   first thing that will prove or disprove it.

3. **Search across messages.** Cheap on a table this size, and the operational
   cost of not having it is real: "did we ever tell them about the gate code" is
   a question about a file's record. Text, person, file and date.

4. **Pagination that says what it is not showing.** The 200 and 500 caps are the
   thing `TableFooter` was built against, sitting in the messaging code.

5. **Everything addressed to you.** Mentions already notify; there is no view
   that collects them. Small, and it is what makes a mention worth writing.

6. **Read receipts on file threads only.** Whether the engineer saw the
   technician's question is operational. `last_read_at` already holds it.

7. **Edit and delete, with the record protected.** Warranted, with a condition:
   `eng_messages` is not append only, so an edit today would change what
   somebody already read with no trace. Either the prior body goes to the audit
   trail on every edit, or edits append a revision. A message on a FILE thread
   should not be deletable at all, because it is part of that file's record;
   a direct message should be.

8. **Retention and export.** A file's messages belong in the evidence binder,
   which already assembles fresh from rows. That is the honest place for them
   and it is a smaller change than an export of its own.

### Not warranted here, and I would argue against building them

- **Presence or last seen.** The brief already suspects this and it is right.
  For contractors working outdoors, "last seen three hours ago" invites exactly
  the wrong inference: a technician on a roof with no signal is not ignoring
  anybody. It manufactures a grievance the firm does not have.

- **Threading inside a conversation.** Sub threads solve a problem that starts
  at Slack scale. With one thread per file and six people, another navigation
  level costs more than the crossed wires it prevents. The file IS the thread.

- **Per thread notification preferences.** Muting matters when somebody is in
  fifty threads. At six people it is a setting nobody will find, and the per
  kind preferences already cover the real case. Revisit when a busy file
  actually trains somebody to ignore the badge, which is the condition the brief
  itself names.

## 6. The third constraint, and where it will bite

A technician sees no pricing. Today messages carry free text only and quote no
figures, so the constraint is satisfied by there being nothing to redact:
`ops-threads.ts` contains no reference to `redactFile` and needs none.

That changes the moment anything quotes a file's figures into a thread. Two of
the items above could: an attachment could be a document carrying a price, and a
search result could surface a message somebody wrote a figure into.

The rule to hold, and it should be a check rather than care: nothing in a thread
may render a money field to an actor without `pricing.read`, and a search must
filter by the same visibility as the thread list rather than by its own query.

## 7. What I recommend for this section

Items 1 through 4, plus 6, and stop. That is attachments, the composer, search,
honest pagination and read receipts on file threads.

Items 5, 7 and 8 are real and smaller; they are worth a second pass rather than
padding the first. The three I would not build are argued above and I would
rather be told I am wrong about them now than build them and find out.

---

## 8. The bucket ruling, decided deliberately

Operator instruction: an attachment from a technician's camera on a file thread
is evidence in everything but name, so decide where it lands and record why.

**Ruling: a separate `eng-messages` bucket, beside `eng-evidence`, under exactly
the same rules. Private, service role only, signed URLs, same retention. And the
file thread's attachments appear in the evidence binder as their own section.**

### Why not the evidence bucket

The bucket is the smaller half of the question. The real question is whether a
conversational photograph becomes an `eng_evidence_items` row, and it must not.

1. **Evidence has a grammar it would have to break.** `eng_evidence_items`
   requires `item_key` NOT NULL and points at a `protocol_item_id`. Every row
   answers a specific thing the protocol asked for. A photograph of something
   unexpected in an attic answers nothing the protocol asked, because the
   protocol did not know to ask. Putting it there needs either an invented item
   key or a null protocol item, and both are a lie about what the row is.

2. **It carries a review status that feeds completeness.** Each evidence item is
   `submitted`, `accepted` or `revision_requested`, and package completeness is
   computed from them. A conversational photo entering that set changes whether
   a package reads as complete, which is a decision the protocol is supposed to
   make.

3. **And this is the one that settles it.** If a message photograph silently
   became evidence, an engineer sealing the package would be certifying they had
   reviewed an item that was never presented to them as an evidence item. That
   is the evidence hash finding again: a claim about a review that did not
   happen in the form the claim implies.

This is the same distinction the schema already draws between `eng_order_inputs`
and `eng_file_inputs`, recorded at length in 0016: evidence that can be
superseded is not evidence, which is why they are not one table.

### Why it still reaches the engineer and the record

Both halves of the operator's sentence have to hold. A photograph of something
unexpected in an attic is exactly what an engineer needs, and exactly what the
firm would be asked to produce.

- **The engineer sees it** because a file thread follows the file, and an
  engineer who can see the file can read the thread. It is on the same screen as
  the work.
- **The firm can produce it** because the binder assembles fresh from rows and
  will carry a section for it, labelled as sent in conversation rather than
  captured against a protocol item. Produced, and honestly described.

### What is deliberately not built

**No promotion path from a message attachment to an evidence item.** It is the
obvious next feature and it is wrong here: promotion needs a protocol item to
attach to, and the whole reason this photograph exists is that no protocol item
covers it. A promote button would push somebody to pick the nearest item key,
which is how a record acquires a small untruth.

If the unexpected thing turns out to matter, the correct answer is that the
engineer sends the file back for a site visit or the protocol gains an item, and
both of those already exist.
