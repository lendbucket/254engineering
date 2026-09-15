# Overnight, 2026-09-15

Branch `overnight/2026-09-15`, cut from `main` at `0927714`. Not merged, not
pushed. Written as the run goes, part by part, so a stop leaves an honest record
of where it stopped.

## RULINGS NEEDED

Filled in at the end of the run. Items gathered so far:

1. **Zod on every public page (BACKLOG 1b).** Lazy import the lead form schema
   inside the submit handler, taking about 68KB off every public page and out of
   every prefetch, at the cost of one fetch on first submit. Proposal only.
2. **The italic face is preloaded on every page.** 34KB on every public, order,
   partner and account screen for one portal component. Proposal only.
3. **The cutover dry run** waits for the target key at the keyboard, unchanged.

---

## PART 0. THE CUTOVER, PARKED

**Parked deliberately, with nothing applied and nothing half done.** It resumes
at phase 0 step 0.4, the dry run of `copy-project.mjs`, which is blocked on the
target project's service role key and waits for the operator to supply it at the
keyboard in one command's environment. The copy plan declares all 76 tables,
65 copied and 11 excluded, in computed dependency order, and no table appears
twice. The development job queue was drained to zero with nothing sent, which
is a development condition and not a cutover blocker, because production's
pending queue is empty. 0.7, the restore clone, is deferred rather than skipped.
`254engineering-rehearsal` stays until the operator deletes it. The full state
is at the top of `docs/production-cutover-plan.md`.

**Added tonight, after the park.** The `.limit(20)` queue stop was recorded in
`CLAUDE.md` as its own instance: 20 of 668, a whole job kind invisible because
none of its rows reached the first twenty. Two bounded reads in one file meant
surveying the rest of the file, and the survey found **four more reads answering
the wrong question**, none of them a cap:

| Read | The defect | Proven on development |
| --- | --- | --- |
| auth precondition for `eng_profiles` | Read `eng_profiles` on the destination instead of `auth.users`, under a guard that only fired when that table was empty. `--apply` could never have copied profiles into a fresh project, and said so as a log line rather than a STOP. | 2 real ids: 0 missing. Plus an injected uuid: exactly that one missing. Bad key: throws. |
| completeness probe | A HEAD count on a missing table answers 204, no error, count null, read as 0 rows. The branch commented "not present" was actually the one an unreadable table takes (401), and it dropped that table from the check. | Old: absent 0 rows, bad key skipped. New: absent, 1327, throws. |
| migration table list | One spelling of `create table`. | Old pattern 1 of 3 spellings, new 3 of 3, an uncapturable one throws. 76 on the real migrations either way. |
| `readEveryRow` | `count ?? 0` on its first line: a table missing from the source copied as empty. | Old: 0 rows. New: throws. |

None of the four has run inside the script against two projects, because that
needs the key. Commit `c3eb8be`.

---

## PART 1. PERFORMANCE

All numbers are from the gate on a local production build (`next start`, local
ceiling profile). The deployment was not measured tonight: every change here is
unmerged and unpushed, so the deployment is still serving the old code and a
reading from it would be a reading of the wrong build.

### 1. `/account/login`: FIXED, 431KB to 316KB against 325KB

It imported nothing the staff and partner screens do not. It carried one
`<Link href="/">Back to the site</Link>`, and a Link in the viewport prefetches
its target. `/` renders the lead form, and the lead form validates with the
whole of zod in the browser: a 288KB chunk, 65KB gzipped.

| | Gate total | Script | What the browser fetched |
| --- | --- | --- | --- |
| Before, fresh build | **431KB / 325** | 220KB | 3 RSC prefetches of `/`, the zod chunk, 2 homepage client chunks |
| `prefetch={false}` | **316KB / 325** | 143KB | none of those |
| `/portal/login`, for reference | 319KB / 375 | 145KB | |

The hypothesis was proven before the fix, not after: the request log showed the
prefetches and the chunk, and the chunk was identified by its contents. The link
still navigates; it was clicked and landed on `/`. `KNOWN_OVER_BUDGET` is empty
again, which is what its own comment says an entry is for. Commit `6a48378`.

**`/account/sign-up` paid the same toll through the same link: 433KB to 318KB.**
The gate cannot reach that screen, because it sends a customer session and the
screen redirects a signed in customer; that figure is Lighthouse under the gate's
exact settings, signed out.

**Which other pages carry a Link to the homepage.** Three more in the source:
`/account/sign-up` (fixed above), the onboarding link not found page, and the
logo in `SiteHeader`. The last is the one that matters, because it renders on
every public page and sits beside a Link to `/waitlist`, which carries the same
lead form. The onboarding page is inside the same layout, so unprefetching its
own link would change nothing while the header still prefetches `/`.

### 1b. The homepage's weight, paid by pages that are not it: RECORDED, NOT FIXED

Yes, it deserves its own item, and it is `BACKLOG.md` 1b. Sized with the gate's
Lighthouse settings by blocking the zod chunk and the prefetch payloads, so no
source changed to produce these:

| Page | As shipped | Toll blocked |
| --- | --- | --- |
| `/about` | 438KB | 331KB |
| `/services` | 485KB | 379KB |
| `/coverage` | 522KB | 416KB |
| `/order/start/roof-inspections` | 462KB | 345KB |
| `/order/254-B2026-000000` | 464KB | 335KB |

About **107KB a page: roughly 68KB of zod and homepage client code, 39KB of RSC
payload.** The RSC half is what prefetching the header costs, and it buys instant
navigation. The zod half buys nothing until someone presses submit, since
`LeadForm` validates only inside its submit handler. The proposal is a lazy
import there. It changes when validation code arrives, so it waits for a ruling.

### 2. The order flow, 462 and 463KB against 465KB: COMPOSITION

`/order/start/roof-inspections`, every transfer over 1.5KB:

| KB | What | Could it come out without changing what the customer sees |
| --- | --- | --- |
| 132 | React and the Next.js runtime, six chunks | No. The framework |
| 121 | Three font files: Archivo variable, Open Sans variable, Open Sans italic (44, 42, 34) | Italic, 34KB, see item 3 |
| 65 | zod, via the header prefetch of `/` and `/waitlist` | Yes, item 1b |
| 45 | RSC prefetch payloads for `/`, `/waitlist`, `/services/roof-inspections` | Only by giving up instant navigation |
| 17 | The stylesheet | Not without a design pass |
| 15 | `favicon.ico`: three uncompressed 32bpp bitmaps | Probably most of it, losslessly. Proposal |
| 13 | Homepage client chunks riding the prefetch | Yes, with 1b |
| 23 | Two renditions of the brand mark through `/_next/image` | Unknown without checking whether an SVG renders identically |
| 10 | The order page's own script, which is where Stripe checkout lives | No |
| 10 | The document | No |
| 5 | `apple-icon.png` | No |

**So the order page's own weight is about 10KB of script and 10KB of HTML.**
Everything else is the shell, the fonts, and 117KB it pays for other pages. With
the prefetch toll removed it measures 345KB and the status page 335KB, which
would put both a long way inside 465KB. Nothing was cut.

### 3. The portal shell, 319 to 320KB: COMPOSITION

`/portal/login`:

| KB | What |
| --- | --- |
| 132 | React and the Next.js runtime |
| 121 | The three font files |
| 17 | Stylesheet |
| 15 | `favicon.ico` |
| 12 | The login form's own script |
| 9 | The wordmark through `/_next/image` |
| 6 | The document |
| 5 | `apple-icon.png` |

**The italic is the only discretionary item of any size.** `src/app/layout.tsx`
records why it is loaded: the absent data chip, where a synthesised oblique would
be mush. What that comment does not say is that `next/font` PRELOADS it, so all
three faces are fetched on every public page, every order page, the partner
portal and the customer surface, none of which render the chip. The proposal is
a second `Open_Sans` call for the italic with `preload: false`, so it downloads
only where the chip appears. That changes font arrival timing on the portal, so
it is a proposal.

### 4. Public pages within 10 percent of a ceiling: WARNINGS

Board scope, median of three. Nothing over any ceiling. TBT is under 25ms of
200 everywhere and CLS is 0.000 everywhere.

| Route | Reading | Ceiling | Used |
| --- | --- | --- | --- |
| `/coverage/coastal-bend` | **550KB** | 560KB | **98%** |
| `/careers/professional-engineer` | LCP 3457ms, spread 525ms | 3660ms | 94% |
| `/` | LCP 3395ms | 3600ms | 94% |
| `/coverage` | LCP 3199ms | 3400ms | 94% |
| `/coverage/coastal-bend` | LCP 3165ms | 3400ms | 93% |

`/coverage/coastal-bend` is the tightest thing on the site: 10KB from its byte
budget. It pays the same 107KB prefetch toll as everything else, so 1b would
also be the largest single lever there. The application stepper's 525ms spread
over three runs is wider than any other route's and makes its median the least
trustworthy number in the table.

---

## PART 2. PHASE 14, WHAT COULD RUN UNATTENDED

Ranks 1, 2 and 3 were not attempted, as instructed. Every exercise ran against
development by name, is committed under `scripts/exercises/`, and says in its
own header what it proves and what it does not.

| Rank | Exercise | Result | What it proved | What it did not |
| --- | --- | --- | --- | --- |
| 4 Retention execute | `retention-execute.mjs` | 18 pass | The executor deletes exactly the planned set, by count and id hash, keeps a dead job past the floor, touches none of 1,327 other rows, and refuses a set that moves. A guard refuses to run if the plan holds any row the fixture did not create, injected and caught. | Who may mint the authority. It was constructed, because `executeAuthority` refuses in prelaunch and the gate is not touched. |
| 5 Dead-letter resume | `queue-resume.mjs` | 16 pass | A dead job resumes with attempts reset and its error kept, earns its retries back, completes once, cannot be resumed again, and a completed job cannot be put back. Two injections written into rows. | The POST route, its permission check and its audit row. The two-worker race uses one job, so it cannot tell an atomic claim from ordering. |
| 6 Preview guard | `preview-mispointing.mjs` | 9 pass | The built app under `VERCEL_ENV=preview` with the production URL refuses on the portal and on the cron route, the server log names the guard, the development and production cases are untouched, `true` does not open the hatch, `1` does. | A real Vercel preview. The refusal page answers HTTP 200. |
| 7 `eng_incidents` | none | not run | | No code path writes an incident, and a live insert would leave a permanent fake incident on development. |
| 8 Stripe refund | `stripe-refund-webhook.mjs` | 9 pass | A signed refund in Stripe's delivered shape is verified, parsed and reaches the recorder; a forged one is refused; the parse that swallowed four refunds is distinguishable; no payment row written. | Writing a refund against a charge, the delta, idempotency. A charge row can never be removed. |
| 9 Suspended link | `suspended-account-link.mjs` | 8 pass | A suspended account is issued nothing, an active one is, and lifting the suspension on the fixture issues a link. | The route, which is closed while sign up is not cleared. |
| 10 System task | `system-raises-task.mjs` | **RED** | **The system principal cannot raise a task.** The database refuses the insert on `eng_tasks_created_by_fkey`: its id is not a profile and no migration makes it one. | |
| Storage | `docs/storage-backup-proposal.md` | proposal | See below. | Nothing built or spent. |

### Four things the exercises found that no check did

**1. The refusal that exists because of 55 emails read a different clock from the
claim.** `scripts/lib/queue-drain.mjs` asked this machine's clock whether a job
was eligible; `eng_claim_jobs` asks the database's. The database runs about 85ms
ahead, so a foreign job enqueued a moment ago was invisible to the guard and
claimable by the worker. Measured at this machine's real clock, not only under a
simulated skew. **Fixed** (`2f55f34`) by asking Postgres's clock, and
`queue-audit` gained three checks that go red with the fix reverted, exactly one
of 109.

**2. `customer_account.link_reissued` records contact that may not happen.** The
trail row says a sign up attempt was made and a link was sent. It is written when
the token is issued, before anything is queued, and a failed enqueue does not
throw. The exercise wrote four such rows on development, ids 17809 to 17812,
where neither was true, and they are permanent. **Ruling needed.**

**3. The system principal's only capability cannot run.** Above. **Ruling
needed.**

**4. The storage map was nine places, not six, and production's one referenced
firm file is named from inside a JSON payload.** A production object nothing
references (193 bytes, 2026-08-28), 98 unreferenced objects and 16 dangling
pointers on development. Supabase's docs answer 2b's open question: a database
backup restores the storage rows and not the bytes. Cost from list prices read
tonight: $0 at today's 155,628 bytes. **Rulings needed** on vendor, retention and
the `bucket` migration.

### Two things this run got wrong on the way, and how each was caught

- **The first moved-set injection for retention expected a refusal and the
  product was right to run.** A row appended after planning takes an id above the
  manifest's range. Rewritten to move a row inside the range, and the appended
  case is asserted for what it is.
- **The first resume exercise carried its own copy of the queue guard and was
  committed while `db-guard-audit` was red on exactly that**, because the audit
  and the commit shared a command and `tail` ate the exit code. That is the
  chained command shape CLAUDE.md forbids. Corrected in `75bcd6b`, and every
  audit since has been run on its own with its exit code printed.

### The artefact for this part

The retention manifests, read back from `eng_retention_runs`, and the four
`link_reissued` trail rows. The manifests found that the first abandon reason
read as if a real foreign row had been found; corrected on the rows and in the
script. The trail rows are finding 2.
