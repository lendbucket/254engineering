# The overnight sweep

**Branch:** `feat/phase-12-section-3`. Not merged, not pushed.
**Started:** 2026-09-10, unattended.
**Status:** IN PROGRESS. This file is written as the run goes, so that a run
that dies leaves a true record rather than none. Every section below that has
not been reached says so in those words. Nothing here is written ahead of the
thing it describes.

---

## 0. The guard, before anything opened a connection

`db-guard-audit` ran first, as the limits require, and it asserts the target by
name rather than by trust.

```
configured target: development (ythzaiqeoijlrdibnieo)
```

`.env.local` carries the development ref and only the development ref. The
production service role key is not in the working tree. The run was allowed to
proceed.

Everything in Round 3 and Round 4 additionally goes through `neverProduction`
in `scripts/lib/db-target.mjs`, which is checked before `ALLOW_PRODUCTION_DB` is
even read, so no environment variable could have redirected them.

---

## 1. The limits, and what was refused under them

| Limit | Held |
| --- | --- |
| Never merge, never push | Held. Nothing was pushed and no merge was attempted. |
| Never apply a migration to production | Held. No `apply_migration` call was made. |
| Never run retention in execute mode | Held. |
| Never delete a row on any database | Held, with one exception that is not one: `destroyProbes` removes the probe accounts Round 3 creates, which is the teardown those probes exist with. |
| Never send anything outward | Held. queue-audit's refusal stays on. |
| Never work around a refused permission | Nothing was refused. |
| Never change behaviour a person would see, except a proven defect | Held. Every commit so far changes an AUDIT, not the platform. |
| Never touch anything needing a ruling | Held. Three compliance findings on sibling repositories are RECORDED for the operator in section 3 and were not acted on. |

---

## 2. Round 1: the board

Run under its own invocation, `npm run audit`, which builds first and starts its
own server.

**46 of 47 audits pass. One is red: `queue-audit`, on exactly one check of 106.**

| | |
| --- | --- |
| Before this run | 45 of 47 |
| After | **46 of 47** |
| Fixed | `security-audit`: `/portal/files/dispatch` was outside the perimeter list |
| Still red | `queue-audit`, one check, and it is the machine rather than the check or the code |

### The one red mark, and why nothing in this repository was changed for it

```
FAIL: this machine and the database agree on the time to within a minute
      (this machine is 85s ahead of the database (round trip 124ms, so that
      figure is good to about that). Every run_after and every leased_until
      this application writes is stamped here and compared there. A job
      enqueued to run now can be ineligible for that long, and a lease can
      look expired here while it is live there.)
```

The round's instruction is to decide whether the check or the code is wrong and
prove it by injection. **Neither is wrong**, and this run settled which one is,
which the check itself cannot do: it holds only the two clocks that disagree.

A third source was asked. Three independent NTP disciplined HTTP servers, at the
same moment as the local clock:

```
local clock: 2026-09-10T05:29:39.771Z
  https://www.cloudflare.com/   says Thu, 10 Sep 2026 05:28:15 GMT  => +85s (round trip 368ms)
  https://www.google.com/       says Thu, 10 Sep 2026 05:28:15 GMT  => +85s (round trip 187ms)
  https://254engineering.com/   says Thu, 10 Sep 2026 05:28:15 GMT  => +86s (round trip 473ms)
```

**The machine is wrong, and the database is right.** All three agree with the
database to within a round trip, including the firm's own deployment. The
disagreement is not a database misconfiguration and not an artefact of
PostgREST: this Windows machine's clock has drifted 85 seconds ahead.

That is a system setting on the operator's machine, not code, and resyncing it
unattended is outside this run's authority. The command is
`w32tm /resync` from an elevated prompt. Until it is run, `queue-audit` is red
and is right to be, and every other audit on the board is measuring correctly,
because `DB_NOW` already moved 68 timestamps off the process clock precisely so
that this drift cannot reach a stored value.

### The check was not loosened, and that is the point

The tempting fix is to widen "to within a minute" to "to within two minutes" and
take the board green. That would convert a check that just correctly identified
a real 85 second fault into a check that would pass through it, and would keep
passing as the drift grew. CLAUDE.md section 6 states this as a rule: a red
board when something genuinely changed is the harness asking whether you meant
it, and the answer is never to loosen the pattern.

---

## 3. Round 2: the deployment

Three live sites, read only, signed out, through Playwright. curl is answered by
Vercel's checkpoint with a 403 and a JavaScript challenge, and there is no
bypass secret in this repository.

**19 checks, 0 failed, 3 findings.**

| Site | Routes from its live sitemap | Every route 200 | Same origin links | Images |
| --- | --- | --- | --- | --- |
| 254engineering.com | 46 | 46 of 46 | all resolve | all load |
| sealedengineering.com | 55 | 55 of 55 | all resolve | all load |
| stampmyplans.com | 9 | 9 of 9 | all resolve | all load |

The two doors that must refuse, both exercised without writing anything:

- **A dead order token.** The page answers 200, which is the trap CLAUDE.md
  section 6 records, and it refuses in words. Read as a person:

  > This link does not open an order
  >
  > The link may have been mistyped, or it may have been replaced by a newer
  > one. The firm emails a link when an order is paid for, and the most recent
  > email is always the one that works. If you cannot find it, reply to any
  > email from the firm quoting status and a new one will be sent.

  That is a good refusal. It says what happened, why, and what to do.

- **The unsubscribe route on a token that means nothing.** It fails closed: no
  confirmation sentence, so nobody who clicked it is left believing they are
  unsubscribed when they are not.

- **The contact form, submitted empty.** Three fields marked invalid, no
  success message. The accept path was deliberately NOT pressed, because on
  production an accepted contact form is a real lead in the firm's own intake.
  That gap is stated rather than skipped.

### 3a. THREE COMPLIANCE FINDINGS ON SIBLING SITES, FOR THE OPERATOR

These are on **separate repositories** and were not changed. The compliance gate
outranks everything, and acting on another repository's copy overnight and
unattended is not this run's to do. Each is quoted exactly, with its context.

**1. sealedengineering.com/ (the home page)**

> A professional engineer's seal is a statement that a licensed individual
> reviewed the evidence and reached the stated conclusion, and that their
> license stands behind it. [...]
>
> **Engineering work is performed under the license and registration of 254
> Engineering Services LLC.**

Matched by `PRESENT_TENSE_SEALING`, "states the engineering is being carried out
now, passive". The sentence asserts two things the gate covers: that engineering
work is being performed, and that a firm registration exists. The registration
is pending. The page does state "registration pending" elsewhere, but not
adjacent to this sentence.

**2. sealedengineering.com/contact**

> LEGAL ENTITY
> Sealed Engineering is a brand of 254 Engineering Services LLC. **All
> engineering work is performed under that entity's license and registration.**
> Firm registration pending with the Texas Board of Professional Engineers and
> Land Surveyors.

Same pattern. Here the pending disclosure sits on the very next line, which is
materially better than the home page and is why both are quoted with their
context rather than listed as two identical hits.

**3. stampmyplans.com/terms**

> We may decline any job. In particular we decline work outside the competence
> of **our engineers**, because accepting it would itself be a violation of
> professional practice rules.

Matched by `PRESENT_TENSE_OFFER`, "plural engineer fiction". No licensed PE is
on staff.

**The decision I would make, recorded rather than taken:** all three are worth
rewording, and the third is the sharpest, because "our engineers" states a fact
about staffing rather than about an entity. The second is arguably already
honest given the adjacent disclosure. None of them is mine to change from this
repository.

### 3b. What Round 2 got wrong about itself, and what that cost

Round 2's first run reported **15 checks, no differences**, and it was measuring
almost nothing. Four defects in this repository's own new audit were found and
fixed, one per commit:

| Defect | What it did | Commit |
| --- | --- | --- |
| `routesOf("public", {include:"pages"})` | Passed a string where a surface object goes. Returned `[]`. Reported `PASS: every declared route answers 200 (0 of 0)` on the primary site. | `ea2d0ac` |
| Images judged by DOM state at 250ms | Called six correctly-loading `loading="lazy"` footer logos broken. | `f02a4f3` |
| Seven hand written claim patterns | A second copy of `scripts/lib/regulatory.mjs`, which has 22 and carries the negation and conditional guards. It missed findings 1 and 2 above entirely. | `0c4a898` |
| One route floor for three sites | Called a nine page sibling broken for publishing nine pages. | `2af961f` (prior) |
| The dead token check's evidence | Recorded `Skip to content`, the page's skip link, as proof that the page refuses. | `2af961f` |

The first of those is the reason this section is worth reading. **A green over
nothing is what the fix found, and the honest run then produced three compliance
findings the vacuous one could not have.**

---

## 4. Round 3: seven roles, every screen

`scripts/overnight-roles.mjs`, against development, signed in as a fresh probe
per role. **176 screens opened and photographed at 390 and 1280**, into
`screenshots/overnight/<role>/<screen>-<width>.png`, with a transcript of every
one at `screenshots/overnight/transcript.json`. Every probe account was created,
used and removed, verified by sweeping the whole probe domain: `left: 0`.

The list of screens is not a list. It is what the shell actually rendered for
that role, which is the platform's own answer to "what does this role reach",
and asking it that way turns drift into a finding instead of a blind spot.

| Role | Landing path | Opened | Destinations offered |
| --- | --- | --- | --- |
| admin | /portal | yes, "Dashboard" | 26 of 28 |
| engineer | /portal/review | yes, "Review queue" | 12 |
| field_tech | /portal/jobs | yes, "My jobs" | 8 |
| dispatcher | /portal/files | yes, "Files" | 9 |
| sales | /portal/clients | yes, "Clients" | 7 |
| customer_service | /portal/files | yes, "Files" | 7 |
| read_only | /portal | yes, "Dashboard" | 12 |

Every role's declared landing path opens for it. Six of seven refuse a screen
they are not offered, in words, at HTTP 404 with "That page is not here". The
seventh is section 7.2.

### 4a. What Round 3 found, and what happened to each

| Finding | Verdict | Outcome |
| --- | --- | --- |
| 11 dashboard tiles linked where the person clicking could not go | **REAL** | Fixed, `6e2da4d`, with two checks in `5afd232` |
| `/portal/documents` phone card was an `<a>` inside an `<a>` | **REAL** | Fixed, `4608a71`, with a check |
| The Job queue screen was 38,744px of rendered email HTML | **REAL** | Fixed, `23a10ae` |
| An administrator opens `/portal/certification`, which the shell never offers | **REAL, needs a ruling** | Recorded, section 7.2. Not touched. |
| 76 "demonstration data shown and the screen does not say so" | **FALSE POSITIVE** | See below |
| 66 "five digit bare numbers" | **FALSE POSITIVE** | See below |
| 4 "the word null is on the screen" | **FALSE POSITIVE**, and it led to a real one | See below |

### 4b. The three false positives, stated rather than quietly dropped

**Demonstration data, 76 hits over 15 screens.** The heuristic asked whether a
screen carrying anything that looks like a fixture SAYS so in prose. Reading
`/portal/files` as a person answers it: the rows are `254-DEMO-STANDING`,
`254-DEMO-0003`, "1 Standing Demo Way", "312 Demo Harbour Row", "88 Demo
Windward Court". Nobody can mistake those for real work, and that is exactly the
design CLAUDE.md records for `seed-field-demo`: obviously fake names, addresses
that do not exist. The records announce themselves and no banner is needed.
`/portal/profile` hit for all seven roles, and that one was this round's own
probe reading its own `@audit-probe.invalid` address back off the screen.

**Five digit bare numbers, 66 hits.** Written to catch amounts in cents, which
is a real defect Phase 12 Section 2 found in an export. What it actually caught
was millisecond timestamps and row ids: `1789018194875`, `1788447318333`. No
money is printed in cents on any screen.

**The word "null", 4 hits.** Two were the sales dashboard, where the prose
reads "which is the arithmetic a nulls-last sort quietly produces". That
sentence is correct and well written.

**The other two were the Job queue, and they were not prose.** They were
`"replyTo":null` inside a raw job payload the screen was printing in full,
which is how the 38,744 pixel screen was found. A crude heuristic pointed at
the right screen for the wrong reason, and looking is what turned it into a
finding.

### 4c. The artefact, read as a person would read it

`screenshots/overnight/admin/queue-1280.png`, before the fix, is 38,744 pixels
tall. Opened, it is a grey slab: doctype declarations, `<head>`, inline styles,
the entire rendered body of eight emails, wrapped and running down the page with
the actual queue somewhere inside it. Every check that looks at that page was
green. No horizontal scroll, tap targets fine, contrast fine. The screen was
unusable and correct by every measure anybody had asked for, and nothing on the
board measures how tall a portal screen is.

After the fix the same screen is 14,984 pixels, and what remains is dead letter
rows: a header, the error, four hundred characters of payload, and a Retry
button. The rows that remain are real data rather than a rendering fault.

---

## 5. Round 4: the perf gate and the queue

**NOT YET RUN.**

---

## 6. The environment findings, recorded and not fixed

**The machine clock is 85 seconds ahead, and the database is not the one that is
wrong.** Full evidence in section 2. Three independent time sources, including
254engineering.com itself, agree with the database to within a round trip.

Recorded rather than fixed: it is a system setting on the operator's machine and
this run has no authority to change one unattended. `w32tm /resync` from an
elevated prompt is the whole of it, and `queue-audit` goes green the moment it
runs. Nothing stored is affected, because `DB_NOW` already moved 68 timestamps
off the process clock so that every `planned_at`, `sent_at` and `sealed_at` is
the database's own `now()`.

---

## 7. Questions that need a ruling

### 7.1 The three sibling site compliance sentences

In section 3a. On separate repositories, so nothing here can act on them.

### 7.2 The one authorization gate decided by a role NAME rather than a grant

`src/app/portal/(app)/certification/page.tsx:38`

```ts
if (!can(actor, "evidence.capture") && actor?.role !== "admin") notFound();
```

Found by Round 3's "one screen it does not reach" check. The shell offers an
administrator 26 of the 28 destinations in `NAV`, and Certification is one of
the two it does not, because `NAV` gates it on `evidence.capture` and no role
but `field_tech` holds that grant. **The page opens for an administrator
anyway**, at HTTP 200, reading as an ordinary screen, because of the escape
hatch above. It is reachable only by typing the URL.

The whole platform's authorization is grants, and has been since 0018 made
roles data. This is the one place in the portal where whether a screen opens is
decided by comparing a role KEY to a string. Every other role name comparison
found in the sweep is display: which rows to show on your own profile, which
label to print, which panel a dashboard renders. This one is a door.

Three things it costs:

1. **An administrator has an invisible screen.** The capability exists and
   nothing offers it, which is the inverse of the drift `nav.ts` was written
   to prevent and is just as much a disagreement between the two.
2. **Roles are data.** An operator renaming the administrator role on the roles
   screen breaks this comparison silently, and the failure is a screen that
   stops opening rather than an error anybody sees.
3. **It is a second authorization model in one line**, which is exactly what
   `nav.ts`'s own header argues against for the nav.

Line 248 of the same file has `actor?.role === "admin"` as well, which is a
display branch rather than a gate and is only worth naming because it is the
same string in the same file.

**The decision I would make, recorded rather than taken.** Delete the escape
hatch and let the gate be the grant alone. If an administrator should see the
technician certification screen, that is a grant they should hold and a `NAV`
entry they should be offered, not a name the page recognises. It needs a ruling
because `evidence.capture` is capture as well as read, so granting it to
administrators would give them more than the screen: the honest fix may be a
separate read grant, and inventing a grant is not a thing to do unattended at
night.

Nothing was changed.

---

## 8. The state at the end

**NOT YET REACHED.** This section will state the final board result, whether
the tree is clean, and the last commit.
