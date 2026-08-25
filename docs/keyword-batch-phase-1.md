# Keyword batch, phase 1: the institutional corpus

Research artifact for the Section 3 content expansion. This file is the evidence
the keyword registry cites when it records volume or difficulty for a 254 owned
term. It is research only. No post in the proposal below has been written, and
none is written until the operator approves the table.

**Pulled** 2026-08-23, Ahrefs Keywords Explorer overview, country US.
**Columns** keyword, volume, difficulty, traffic_potential, parent_topic, cpc.
**Declared cost** 24 keywords at 30 units each, 720 units.
**Actual cost** 363 units. Thirteen of the twenty four keywords returned no row
at all, and Ahrefs does not bill for a keyword it has no record of.

The workspace stood at 19,023 of 100,000 units before the call.

## The thirteen that do not exist

This is the most consequential result in the batch and it is an absence, so it is
recorded first. These keywords returned no row, meaning Ahrefs has no measurable
search demand for them in the United States:

    how cities procure engineering services
    qualifications based selection engineering
    engineering rfq process
    verify texas engineer license
    tdi windstorm appointment
    texas windstorm engineer appointment
    twia catastrophe area counties
    texas windstorm inspection program
    on call engineering services contract
    veteran owned engineering firm
    statewide engineering coverage
    texas county permitting authority
    who issues building permits in texas

Three of the seven candidate topics the Section 3 brief proposed are killed
outright by this list, and the reason is worth stating rather than burying.

**The windstorm program authority topic has no demand.** All four phrasings
returned nothing. The registry permits 254 to write the program authority angle
at `keyword-registry.ts` lines 340 and 357, so the territory was available. There
is simply nothing there to rank for. The material is still true and still useful,
so it belongs inside the TWIA county pages where the geo term carries the demand,
not in a standalone post that would rank for nothing and dilute the corpus.

**The on call contracting topic has no demand**, and the one phrasing that does
return a row, `on call engineering contract`, measures zero. It would also
cannibalize `/government`, which is already live on `on call engineering services
texas`. Dropped on both counts.

**The veteran owned topic has no demand.** `sdvosb engineering firm texas` is
separately blocked in the registry until certification issues. The positioning
stays where it is, on `/about`, and earns nothing from a post.

**The county permitting angle cannot be validated at the state level.** Neither
`texas county permitting authority` nor `who issues building permits in texas`
exists. That does not mean county permitting has no demand; it means the demand
lives at `{county} county permit requirements`, which is the registry pattern at
line 182 and belongs to the county tiering workstream, not to this one.

## The eleven that returned

| Keyword | Vol | KD | TP | Parent topic |
| --- | --- | --- | --- | --- |
| tbpels | 1700 | 16 | 5700 | tbpels |
| texas board of professional engineers | 800 | 0 | 5700 | tbpels |
| texas pe license lookup | 600 | 55 | 1400 | tbpe roster |
| engineer of record | 300 | 0 | 30 | engineer of record |
| qualifications based selection | 40 | n/a | n/a | n/a |
| texas professional services procurement act | 30 | 0 | 30 | texas government code 2254 |
| what is an engineer of record | 20 | n/a | n/a | n/a |
| texas engineering firm registration | 10 | 20 | 60 | engineering firms in texas |
| engineer of record responsibilities | 10 | n/a | n/a | n/a |
| engineering firm registration texas | 0 | n/a | n/a | n/a |
| on call engineering contract | 0 | n/a | n/a | n/a |

## The trap in this table

`tbpels` at 1700 a month and KD 16, and `texas board of professional engineers`
at 800 a month and KD 0, are the two largest numbers here and both must be left
alone.

Free SERP review returns pels.texas.gov, txls.texas.gov, Wikipedia, the agency
LinkedIn page, and the agency Facebook page. The query is navigational: every
person typing it wants the agency, and a private firm ranking above the regulator
for the name of the regulator would be a bad outcome even if it were achievable.
The traffic potential of 5700 is the traffic of the agency and is not
addressable. KD 0 on the second term measures how few backlinks are needed, which
is a statement about link difficulty and not about whether the searcher will ever
click a firm. Targeting it would produce a page that ranks for a term whose
searchers bounce, which is a negative quality signal aimed at the whole domain.

Recorded here because the number is attractive enough that a later session will
propose it again.

## What is genuinely beatable

**texas professional services procurement act, 30/mo, KD 0, parent Texas
Government Code 2254.** The SERP is statute mirrors and primary sources:
texas.public.law, Justia, a Williamson County procedure page, a TCEL position
statement, a TxDOT manual section, and a 2000 Attorney General opinion. Every one
of them either reproduces the statute or addresses one agency. Nobody has written
the practitioner explainer that tells a city procurement officer what the two
step process actually requires of them. Low volume, but this is the highest value
audience the site has, and the term the registry currently plans for this post,
`how texas cities procure engineering services`, does not exist. The registry
entry should be repointed at the statute term.

**texas engineering firm registration, 10/mo, KD 20, TP 60.** The SERP is Harbor
Compliance, a compliance vendor selling filing services, plus the Texas Society
of Professional Surveyors and three pels.texas.gov PDFs. Harbor Compliance is
beatable on depth by anyone who has actually been through the process. Volume is
small and traffic potential of 60 says the topic is six times the head term.

**engineer of record, 300/mo, KD 0.** The SERP is entirely national and generic:
Knight Piesold, inspectmind.ai, punchlistzero, fveng.com, an Eng-Tips thread, and
a Law Insider dictionary entry. Not one of them is Texas specific. Traffic
potential of 30 against volume of 300 is the honest warning on this one: the
query is definitional, it is answered by a snippet and an AI overview, and the
winning page captures very little of the 300. It is still the strongest post in
the batch, because the Texas specific treatment does not exist and the regulatory
position of this firm is the differentiator.

**texas pe license lookup, 600/mo, KD 55, TP 1400.** The hardest thing in the
batch by a wide margin and the only one with real commercial competition:
PDH Pro and EngineeringID both rank, alongside two parasite pages on university
domains. The real destination is engineers.texas.gov/roster/pesearch.html. KD 55
against a domain with effectively no authority means this does not rank this
year. Proposed anyway, at tier 2, with that expectation stated rather than
discovered later.

## Cannibalization

Against this site, from `data/keyword-registry.ts`:

- `/government` is live on `qualifications based selection texas engineering`,
  `municipal engineering services texas`, and `on call engineering services
  texas`. Any procurement post is subordinate to `/government` and targets the
  statute term, linking up rather than competing.
- `/about` is live on `engineer in responsible charge texas` and `veteran owned
  engineering firm texas`. The engineer of record post explains the concept;
  `/about` states the position of the firm. Different intent, different primary
  term, but this is the one pairing on the list that needs watching after
  publication.
- `/coverage` is live on `engineering firm serving all texas counties`, which is
  why `statewide engineering coverage` was tested. It does not exist.

Against sealedengineering.com, which runs seven insights: the WPI-8 consumer
explainer and both windstorm certificate lookup pages belong to Sealed, recorded
at registry lines 340, 357, and 366. The windstorm topic is dropped for lack of
demand, so no collision survives.

Against stampmyplans.com: no blog or insights corpus exists. No collision.

## What phase 1 did not answer

The county level permitting demand, which is the registry pattern at line 182 and
the largest unmeasured opportunity on this site. It needs its own batch, scoped
to a sample of counties, and it belongs with the county tiering plan rather than
here.
