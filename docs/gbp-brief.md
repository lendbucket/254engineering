# Google Business Profile brief

Prepared 2026-08-31 for 254 Engineering Services LLC. This is a brief, not a
submission. It states exactly what should be entered, what must not be entered,
and what has to be true before the profile is created at all.

Read the gate in section 1 before anything else. Creating this profile early is
one of the few mistakes on this build that is genuinely hard to undo.

---

## 1. Do not create the profile yet

Two conditions have to be met first, and neither is a formality.

**The TBPELS firm registration has to be issued.** A Google Business Profile in
the Engineer category is a public, permanent, indexed statement that a firm
offers engineering services. Texas regulates the practice and the title. A live
profile categorized as an engineering firm, while the registration is pending and
no Professional Engineer is in responsible charge, is the same claim the entire
site is built to avoid making, published on the surface Google trusts most.

**A verifiable address has to exist.** Verification is by postcard to a physical
address, or by video showing the location and signage. Both require the address
to be real and associated with the business. There is no version of this that
works from a placeholder.

Everything below is ready to execute on the day both are true.

---

## 2. What is not known yet, and must come from the operator

Nothing in this section may be guessed, including by a future session reading
this file. Every one of these values is read from the environment through
`src/config/contact.ts`, defaults to null, and is absent from the site until set.

| Field | Environment variable | Status |
| --- | --- | --- |
| Street address | `FIRM_STREET`, `FIRM_STREET_2` | Not supplied |
| City | `FIRM_CITY` | Not supplied |
| Postal code | `FIRM_POSTAL_CODE` | Not supplied |
| Latitude, longitude | `FIRM_LATITUDE`, `FIRM_LONGITUDE` | Not supplied |
| Telephone | `FIRM_PHONE` | Not supplied |
| Opening hours | `FIRM_HOURS` | Not supplied |

Setting these requires a rebuild, because the pages are statically prerendered.
That is deliberate. Publishing an address is a deployment with an audit trail.

Two decisions come with them:

**Is the address one the public may have?** If the firm operates from a
residence, Google's service area business model is the right shape: the address
is given to Google for verification and then hidden, and the profile shows a
service area instead. That choice also determines whether the address should be
published on the site at all. The site and the profile must agree, and the
mechanism that keeps them agreeing is that both read the same config.

**Will the phone be answered during the hours published beside it?** A number on
a profile is a commitment. An unanswered one produces the calls-that-go-nowhere
signal, and it invites the review that says nobody picks up.

---

## 3. Entry by entry

**Business name.** `254 Engineering Services`

Exactly that. Not the legal name, not with a city or a keyword appended. Adding
words that are not on the signage is the most common cause of a suspended
profile, and keyword stuffing the name is specifically enumerated as a violation.
The legal name `254 Engineering Services LLC` belongs on the SAM registration and
in schema `legalName`, not here.

**Primary category.** `Structural engineer`

Chosen over `Engineer` because it is more specific and specificity is how the
category system works. Both are gated on section 1.

**Secondary categories.** Add only those the firm genuinely performs once
registered, and add them one at a time rather than as a block. Candidates, in
order of fit:

- `Engineering consultant`
- `Home inspector`, only if the firm actually performs inspections as its own
  service line rather than as part of engineering work

Do not add categories to reach for volume. A category the firm cannot fulfil is
a review problem later, and it dilutes the primary signal now.

**Service area.** Texas.

This is the one place the brand's whole premise is directly expressible. If the
service area business model is used, set the area to the state rather than
enumerating cities. If a storefront address is shown, the service area still
reads Texas.

**Website.** `https://254engineering.com/corpus-christi`

Not the homepage. The location page is the surface that states where the firm is,
carries the same name, address, and phone the profile does, and resolves to the
same entity through the `ProfessionalService` node. Pointing a local profile at a
homepage that does not mention the city is a weaker match than pointing it at the
page that does.

**Description.** 750 characters maximum. Use the text in section 5, unchanged.

**Opening date.** The date of formation, once confirmed. Leave blank rather than
approximate it.

**Attributes.** Set `Veteran owned` when offered. It is true, it is stated at
entity level on the site, and it is one of the few attributes procurement
actually filters on.

---

## 4. What must never appear on this profile

- Any statement that engineering services are currently offered or performed,
  until the registration is issued. This is the same gate as the site.
- Any turnaround promise for sealed work.
- Any PE name, license number, or firm registration number that is not in
  `src/config/credentials.ts`.
- Any review the firm solicited in exchange for anything, or any review not from
  a real client. There is no review markup on the site for the same reason, and
  a fabricated review on a profile is worse: it is attached to a named person.
- Any photograph that is not of this firm's own work, premises, or people. Stock
  imagery presented as the firm's own is a fabrication with a picture on it.

---

## 5. Description, ready to paste

> 254 Engineering Services is a veteran owned Texas engineering firm named for
> the 254 counties of Texas. Based in Corpus Christi, inside the windstorm
> catastrophe area designated by the Texas Department of Insurance, the firm is
> built to deliver windstorm certification, roof condition and certification
> work, foundation evaluation, forensic investigation, and repair
> specifications, under a licensed Texas Professional Engineer in responsible
> charge. Coverage is statewide across all 254 counties.

That is 517 characters. It states capability rather than current service, which
keeps it inside the gate, and it can stay word for word after the registration
issues because nothing in it becomes false.

---

## 6. After the profile is live

**Check the name, address, and phone against the site.** They must match
character for character, including the format of the phone number and the way the
street is abbreviated. The site renders both from `src/config/contact.ts`, so the
comparison is against that file. A mismatch here is the single most common local
ranking problem and it is entirely self inflicted.

**Add the profile URL to `business.brands` sameAs.** The entity node in
`src/lib/schema.tsx` publishes `sameAs`, and the profile belongs in it. That is
what lets a crawler join the profile to the site to the sister brands as one
entity rather than three unrelated ones.

**Do not chase reviews before there is work to review.** The first real client
review is worth more than ten early ones, and the site cannot publish review
markup until genuine third party reviews exist.

**Posts are optional and mostly not worth it here.** The audience for this firm
is lenders, procurement, and contractors, who do not browse profile posts. The
analysis corpus on the site is where that effort belongs.
