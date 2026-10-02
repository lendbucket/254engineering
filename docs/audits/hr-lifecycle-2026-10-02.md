# The HR lifecycle, read against the code

**Report only. Nothing in this file has been built, and nothing in it is a ruling.**

Operator order, 2026-10-02: Part A, walk the full path a technician and an
engineer take and mark each step EXISTS, PARTIAL or MISSING with the route or
file. Part B, flag anything that breaks the compliance rules, cite each rule to
its source, and mark VERIFY where I am not certain the rule is current.

## How to read this

Every verdict below was established by opening the file named beside it. Where I
could not establish something I say so rather than inferring it, because the
whole purpose of this pass is to replace assumptions with readings before a
migration is written.

**The rulings this is written under**, which change several verdicts from what
they would otherwise be. Technicians are 1099 independent contractors. Engineers
are 1099 or W-2, chosen per person. **Gusto holds SSN, EIN, bank details, W-9,
W-4, I-9 and all tax filings, and the platform holds none of them.** Pay rates
are entered per person with effective dates and no defaults. The contractor
agreement and handbook carry placeholder text marked "Awaiting attorney review"
until the operator uploads the real documents.

---

# PART A: the eleven steps

| # | Step | Verdict | Where |
| --- | --- | --- | --- |
| 1 | Hears about 254 | **PARTIAL** | `src/app/(site)/careers/page.tsx`, `src/app/(site)/careers/[slug]/page.tsx`, `src/content/careers.ts`, `data/positions.ts` |
| 2 | Applies | **EXISTS** | `src/components/careers/ApplicationFlow.tsx`, `eng_applications` (migration 0000) |
| 3 | Screening | **PARTIAL** | `src/app/portal/(app)/applications/page.tsx`, `eng_applications.status`, `.payload` |
| 4 | Interview scheduling | **MISSING** | described only, `src/content/careers.ts` |
| 5 | Conditional offer | **MISSING** | nothing found |
| 6 | Background check, Checkr, FCRA | **MISSING** | nothing found, anywhere |
| 7 | PE licence verification | **PARTIAL** | `src/content/onboarding-checklists.ts` key `pe_license_card`, `src/config/credentials.ts` |
| 8 | Onboarding | **PARTIAL, and it collects what Gusto must hold** | `src/content/onboarding-checklists.ts`, `eng_onboardings`, `eng_onboarding_items` |
| 9 | Training and qualification | **EXISTS** | `eng_certifications` (migration 0001), `src/lib/ops-certification.ts`, `src/lib/ops-dispatch.ts` |
| 10 | Active employment, admin configuration | **MISSING for pay, PARTIAL for the rest** | `eng_profiles`, `eng_files.tech_cost_cents` / `.engineer_cost_cents` |
| 11 | Separation | **PARTIAL** | `eng_profiles.status`, `src/lib/ops-auth.ts` |

## 1. Hears about 254: PARTIAL

A careers hub and a per position page exist, with the copy in `src/content/careers.ts`
and the roles in `data/positions.ts`. The hiring stages are written out as prose,
including "Phone interview" and "Video interview and identity".

**No pay range is shown on any position.** That is a deliberate consequence of
the rate ruling rather than an omission: there are no rates anywhere to show, and
inventing one for a job advert would be a fabricated figure. It is listed as
PARTIAL rather than EXISTS because the step as the operator described it includes
"pay range shown or not", and the honest answer is not shown.

## 2. Applies: EXISTS

`ApplicationFlow.tsx` is a multi step form, and its own header records that the
two applications, engineer and technician, ask different questions and share the
machinery. It writes `eng_applications`.

**What it asks**, read off the table rather than off the form: name, email,
phone, city, message, licence number, disciplines, TDI appointed, availability,
counties, experience, drone licence, reliable vehicle, plus a `payload` jsonb and
the usual attribution columns.

A confirmation to the applicant: **I did not establish this.** `email-templates.ts`
has a large template set and I did not find an applicant acknowledgement while
searching for the rejection template. It is marked as an open question below
rather than as present or absent.

## 3. Screening: PARTIAL

`/portal/applications` exists as a screen, and `eng_applications` carries
`status` defaulting to `new`. So a queue exists and a status can be set.

**What I could not find: a notes field, a status vocabulary, or a rejection
message.** `eng_applications` has `message` (the applicant's own) and no
reviewer notes column. Searching the email templates for a declination or
unsuccessful applicant template returned nothing. A respectful rejection with a
real sentence is, on this reading, not built.

## 4. Interview scheduling: MISSING

`src/content/careers.ts` names "Phone interview" and "Video interview and
identity" as stages. That is copy describing a process a human runs. There is no
scheduling surface, no availability capture and no interview record.

## 5. Conditional offer: MISSING

No offer letter, no e-signature, no at will statement. Searching for
`offer_letter`, `offerLetter`, `at-will`, `e-signature` and `countersign` across
`src` and the migrations returned only marketing pages using "offer" in its
commercial sense.

The nearest thing that exists is the onboarding checklist item
`employment_agreement`, described as "the countersigned agreement", which is a
place to upload a document that was executed somewhere else. That is a record of
an offer having happened elsewhere, not an offer made here.

**Under the contractor ruling this step splits in two**: an independent
contractor agreement for technicians and 1099 engineers, and an offer letter for
a W-2 engineer. The checklist already has `ica_signed` for the first.

## 6. Background check, Checkr, FCRA: MISSING

**Zero hits for `checkr`, `Checkr`, `FCRA`, `adverse action` or
`Summary of Rights` across `src`, `docs` and every migration.** None of the
standalone disclosure, the written authorisation, the pre adverse action notice,
the waiting period or the final adverse action notice exists in any form.

This is the largest single gap in the lifecycle and the one with the most law
attached to it.

## 7. PE licence verification: PARTIAL

Two separate things exist and they are not connected.

The onboarding checklist has `pe_license_card`, labelled "Texas PE license
verification", which is a document upload.

`src/config/credentials.ts` holds `verifiedEngineers`, the register the whole
compliance gate reads, with the licence number and an expiry, and
`activeEngineer()` refuses an entry whose expiry is null because an unknown is
not a pass.

**What is missing is the link and the reminder.** Nothing verifies an uploaded
card against TBPELS, nothing moves an onboarding into the register, and nothing
reminds anybody that the firm registration must list the engineer. The register
is filled by hand.

## 8. Onboarding: PARTIAL, and this is the finding that matters

The machinery is real: `eng_onboardings` is invite only with a hashed token,
`eng_onboarding_items` is a per hire checklist driven by
`src/content/onboarding-checklists.ts`, and the table already carries
`identity_verified_at` and `i9_examined_at` as **dates with no document**, which
is exactly the shape the operator's ruling asks for.

**And then the checklist collects seven things the ruling says Gusto holds and
the platform must not.**

| Item key | What it uploads | Against the ruling |
| --- | --- | --- |
| `photo_id_front` | Government issued photo ID, front. **In both checklists.** | identity document |
| `photo_id_back` | Government issued photo ID, back | identity document |
| `drivers_license` | Driver's licence, technician checklist | identity document |
| `w4` | Form W-4, completed and signed | contains an SSN |
| `i9_section1` | Form I-9, Section 1 | contains an SSN and a date of birth |
| `direct_deposit` | A voided check or a bank letter, plus typed `bank_name` and `account_type` | bank details |
| `w9` | Form W-9, technician checklist | contains an SSN or EIN |

`storage_key` on each item points into the private `eng-onboarding` bucket, so
these are stored files rather than ticked boxes.

**THE DECLARATION BESIDE THEM IS TRUE ABOUT A COLUMN AND FALSE ABOUT THE
BUCKET.** The comment on `eng_onboardings` reads, in migration 0000:

> Never stores a social security number.

No column holds one. A W-4 image holds one, an I-9 Section 1 holds one, and a
W-9 holds one or an EIN. The sentence is a correct statement about the schema and
a false statement about the system, and it is the kind that reads as a guarantee.

**One more of the same shape, and it is narrower than it looks.** The help text
on `direct_deposit` says "The account and routing numbers stay inside the
document. This site never asks you to type them." That is true: the form does
not ask for the numbers. It then stores the document containing them.

**Not all of the checklist is in scope.** `vehicle_insurance` and
`general_liability` are insurance certificates, which the operator's ruling
explicitly asks to be collected and tracked with an expiry date and reminders.
`ica_signed`, `employment_agreement`, `eo_acknowledgment` and
`protocol_certification` are agreements and qualifications, which belong here.
`identity_verified_video` and `i9_documents_examined` are records that a process
happened, which is the correct shape.

**What is missing from step 8 as the operator described it:** the Texas new hire
report to the Attorney General within 20 days, tracked as a task. Searching for
`new hire`, `new_hire` and `Attorney General` returned only incidental English.
Handbook and policy acknowledgment exists only as `eo_acknowledgment`. Equipment
issued: nothing found.

## 9. Training and qualification: EXISTS

`eng_certifications` references `eng_protocol_templates` and carries a status of
`in_progress`, `certified`, `failed` or `revoked`. `ops-certification.ts` is the
module, and **a certification is per service line and per protocol version**: its
own header records that a technician certified on version one is certified on
version one, so a reissued protocol does not silently carry a qualification
forward.

`ops-dispatch.ts` blocks an uncertified technician from that service line, and
its header names this as the blocker "that carries real consequence". So a
qualification does open a service line, mechanically, which is the behaviour the
operator described.

**What I did not establish:** whether the engineer of record is the one who sets
`certified`, or whether an administrator can. That is a permissions question and
it is listed as an open question rather than answered.

## 10. Active employment, admin configuration: MISSING for pay

`eng_profiles` holds id, email, name, phone, role in admin, engineer or
field_tech, and status. Later migrations add `base_lat`, `base_lng`,
`onboarding_id`, coverage counties and a base city and county.

**There is no classification, no pay type, no pay rate and no rate history on a
person.** What exists is `tech_cost_cents` and `engineer_cost_cents` on
`eng_files`, which is a cost recorded **per job**, entered after the fact. There
is no way to say what a person is paid, only what a particular file cost.

So of the operator's list for this step: classification MISSING, pay type
MISSING, pay rate with effective date history MISSING, overtime rules MISSING,
start date MISSING, employment status EXISTS as `eng_profiles.status`, emergency
contact MISSING, documents list EXISTS as `eng_onboarding_items`, reports by
person and period MISSING, exportable for payroll MISSING.

`/portal/people` exists as a screen for people, which is where this
configuration would live.

## 11. Separation: PARTIAL

**Access removal works and is immediate.** `eng_profiles.status` includes
`suspended`, and `ops-auth.ts` refuses a suspended account on the next request
rather than trusting the cookie, with its own note that "a suspended account or a
changed role has to take effect on the next request". That is same day removal by
construction rather than by a task somebody remembers.

Missing: final pay timing under the Texas Payday Law, equipment return, and any
record of what is retained and for how long.

---

# PART B: the compliance checks

**Every rule is cited. Where I am not certain the rule is current, or not certain
of its scope, it is marked VERIFY and the uncertainty is named rather than
hidden. I am not a lawyer and none of this is advice; the operator's standing
position is that the agreement and handbook text goes to a Texas employment
attorney before first use, and these citations should go the same way.**

## B1. The application asks for nothing protected: PASSES

**The rule.** No date of birth, age, race, religion, national origin,
disability, genetic information, pregnancy, marital status or photos. Voluntary
EEO self identification only if separate, optional and never visible to
reviewers.

**Source.** Title VII of the Civil Rights Act of 1964, the Age Discrimination in
Employment Act, the Americans with Disabilities Act, the Genetic Information
Nondiscrimination Act, the Pregnancy Discrimination Act, and Chapter 21 of the
Texas Labor Code. **VERIFY:** I am citing these as the statutes that make these
questions hazardous at application stage. The precise question of which are
prohibited outright versus merely strong evidence of intent varies, and the EEOC
guidance position should be confirmed.

**The reading.** `eng_applications` has no column for any of them. Every column
is name, email, phone, city, message, licence number, disciplines, TDI appointed,
availability, counties, experience, drone licence, reliable vehicle, attribution
and a `payload` jsonb.

**One caveat worth stating.** `payload` is jsonb and therefore unconstrained. The
form does not put a protected characteristic in it today, but nothing stops a
future field doing so, and a jsonb column is exactly where that would happen
unnoticed. That is a candidate for a check rather than a finding.

**And there is no EEO self identification at all**, which is compliant with the
rule as stated, since the rule permits it only under conditions and does not
require it.

## B2. Criminal history only after a conditional offer: NOT APPLICABLE YET

**The rule.** Criminal history questions only after the conditional offer,
through Checkr.

**Source.** The FCRA at 15 U.S.C. 1681 and following for the consumer report
mechanics. **VERIFY:** the "after a conditional offer" sequencing is a ban the
box requirement that varies by jurisdiction; Texas has no statewide private
employer ban the box law that I am certain of, and Austin has a local ordinance.
Whether the firm is covered, and by which, needs confirming against the
jurisdictions it hires in.

**The reading.** The application asks nothing about criminal history, so nothing
is currently asked at the wrong time. The rule cannot be breached by a step that
does not exist. It becomes live the moment step 6 is built.

## B3. Overtime at 1.5 times over 40 hours: NOT APPLICABLE TO MOST OF THE FIRM

**The rule.** Non exempt pay computes overtime at 1.5 times the regular rate over
40 hours in a week, including per job pay, and never below federal minimum wage.

**Source.** The Fair Labor Standards Act, 29 U.S.C. 207(a) for the overtime
multiplier and 29 U.S.C. 206 for the minimum wage. The inclusion of per job and
piece rate pay in the regular rate is at 29 C.F.R. 778.111 and following.
**VERIFY:** the federal minimum wage figure and the current salary threshold for
the exempt tests both change; neither is written anywhere in this repository and
neither should be hardcoded without a dated source.

**The reading.** Technicians are 1099 contractors by ruling, so the FLSA does not
reach them and there is no overtime. A W-2 engineer may be exempt or non exempt.
**Nothing in the platform computes pay at all**, so there is nothing to be wrong
today; this becomes live when step 10 is built, and only for a W-2 non exempt
person.

**The hazard to carry into Part C.** The operator's ruling says pay is per job
for contractors. If a W-2 non exempt person is ever paid per job, the regular
rate for overtime must be computed from total earnings divided by hours worked,
not from a notional hourly figure. That is the single easiest thing to get wrong
in the whole of step 10.

## B4. Pay frequency: NOT APPLICABLE YET

**The rule.** At least semimonthly for non exempt employees.

**Source.** Texas Payday Law, Texas Labor Code Chapter 61, specifically section
61.011 for paydays. **VERIFY:** 61.011 is the provision I am citing for the
semimonthly requirement for non exempt employees and monthly for exempt; confirm
the section number and that it is current.

**The reading.** Nothing in the platform has a pay period. Gusto will hold the
schedule. The platform's only obligation is the export, which must be able to
produce a period that matches whatever Gusto is set to.

## B5. Retention: MISSING ENTIRELY

**The rule.** Applications 1 year. Payroll records 3 years. I-9 dates 3 years
after hire or 1 year after separation, whichever is later. Background reports
disposed of securely.

**Source.** Applications: 29 C.F.R. 1602.14 for Title VII records.
Payroll: 29 C.F.R. 516.5 under the FLSA. I-9: 8 C.F.R. 274a.2(b)(2)(i)(A).
**VERIFY:** all three citations, and in particular whether 1602.14 gives one year
or longer for the firm's size and whether a charge being filed extends it.

**The reading, and it is a real finding.** `src/lib/retention-policy.ts` exists
and is one of the operator's pinned rulings in CLAUDE.md section 6c: a thirty day
telemetry floor, and the only tables retention may delete from are
`eng_cron_runs` and `eng_jobs`.

**So `eng_applications`, `eng_onboardings` and `eng_onboarding_items` have no
retention rule at all.** Applications accumulate for ever. That is not a breach
of a maximum, since none of these rules is a maximum, but it means the firm
cannot answer how long it keeps an application, and the one year figure is a
floor the firm is currently exceeding indefinitely without a decision.

## B6. No SSN, date of birth, bank details, identity documents or I-9 images: FAILS

**The rule.** None of those stored in the platform or the repo.

**Source.** This is the operator's own ruling of 2026-10-02 rather than a
statute, and its force comes from Gusto holding those records instead. The
underlying exposure it manages is a data breach notification obligation: Texas
Business and Commerce Code Chapter 521. **VERIFY:** the chapter number and the
notification thresholds.

**The reading: seven checklist items collect exactly what the rule forbids**, set
out in the table in step 8 above. Photo ID front and back, driver's licence, W-4,
I-9 Section 1, direct deposit document, and W-9, all uploaded into the private
`eng-onboarding` bucket.

**The repo itself is clean.** I found no SSN, date of birth or bank detail in any
source file; the violation is what the running platform asks people to upload,
not what is checked in.

**And the schema was built to avoid this.** `identity_verified_at` and
`i9_examined_at` on `eng_onboardings` are dates with no document, which is
precisely the pattern the ruling asks for, and `i9_documents_examined` is a
checklist item recording that examination happened. Two of the right shapes
already exist beside seven of the wrong ones. Whoever designed the dates
understood the rule; the uploads predate it.

## B7. Every rule cited to its source in a file the audit reads

**Not satisfied, and it cannot be satisfied by this document.** The operator's
requirement is that the rules live in a file an audit reads. This is a report; an
audit cannot act on it.

What is needed is a declaration in the shape this repository already uses for
`credential-inventory.ts` and `stripe-console.ts`: one entry per rule, with the
rule, the citation, the date it was last checked against the source, who checked
it, and a VERIFY flag where it is uncertain. Then a check that asserts every
lifecycle step carrying a legal obligation names a rule in that file, so a step
built without one is a red board rather than a gap.

That is Part C work and it is listed below rather than built.

---

# What is owed, in the order it blocks things

1. **The contractor and employee split does not exist in the data.** There is no
   classification on a person, so nothing downstream can branch on it. Everything
   in step 10 waits on this.
2. **Seven checklist items collect what Gusto must hold.** This is the only
   finding that is live today: it is not a gap, it is the platform asking real
   people to upload documents the ruling says it must not keep. It also makes the
   "never stores a social security number" comment false in effect.
3. **Checkr and the whole FCRA flow are absent**, and are the step with the most
   law attached.
4. **No retention rule covers applications or onboarding records.**
5. **The rules file Part B7 describes does not exist**, so none of these rules is
   enforceable by a check.
6. Offer and agreement generation, interview scheduling, the Texas new hire
   report, equipment issue and return, emergency contact, and reports by person
   and period are all missing and none of them blocks another step.

# Open questions, where I could not establish something

These are not findings. They are places where I did not reach an answer and did
not want to imply one.

- Whether an applicant receives any acknowledgement. I searched the email
  templates for a rejection and found none, and did not separately establish
  whether a confirmation exists.
- Whether a reviewer can record notes against an application, and what the status
  vocabulary is beyond the `new` default.
- Whether the engineer of record, as opposed to an administrator, is the
  principal who sets a certification to `certified`.
- Whether the Texas new hire report applies to 1099 contractors. The operator
  already marked this VERIFY and I did not resolve it.
