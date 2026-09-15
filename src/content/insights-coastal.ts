import type { Insight } from "./insights";

/**
 * TEN POSTS ON THE COASTAL WINDSTORM RECORD, READ FROM THE STATUTE.
 *
 * Written 2026-09-15, overnight, on the operator's instruction, and NOT through
 * the content engine's research phase in CLAUDE.md section 8: no Ahrefs pull was
 * made and every primary keyword below is UNMEASURED. That departure is disclosed
 * in docs/overnight-2026-09-15.md, and nothing here merges until the operator has
 * read it.
 *
 * WHY THESE TEN AND NOT OTHERS
 * ----------------------------
 * The site already carries a windstorm hub and eight program pages
 * (src/content/windstorm-program.ts), and Sealed Engineering already publishes
 * homeowner posts on the WPI-8, the certificate lookup, roof certification
 * letters and sealed letters. A post that restated either would fail the
 * find-and-replace test inside this site or across the brands. So every post here
 * is built on material neither site publishes: the Insurance Code's own text.
 * The cluster explains how the program works; these read the sections that make
 * it work, by number, which is this brand's registry stance.
 *
 * SOURCES, ALL READ 2026-09-15, THE STATUTE TEXT VERBATIM FROM THE PAGES CITED
 * ---------------------------------------------------------------------------
 *   Tex. Ins. Code 2210.003   the fourteen first tier coastal counties
 *   Tex. Ins. Code 2210.251   the 1988 line, evidence of prior coverage, and
 *                             "The certificate is evidence of insurability"
 *   Tex. Ins. Code 2210.254   who is a qualified inspector
 *   Tex. Ins. Code 2210.2515  notice before work, ongoing and completed
 *                             improvements, the six month limit, no rescission,
 *                             the referral of an engineer's report to TBPELS
 *   Tex. Ins. Code 2210.258   no association coverage until a certificate issues,
 *                             the private market exception, the 30 day term
 *   TDI, Windstorm Inspection Process and Completed Construction Certificates
 *   22 Tex. Admin. Code 137.33 and Tex. Occ. Code 1001.401, already cited on
 *                             /insights/engineer-of-record-texas
 *
 * A CONFLICT RECORDED, NOT RESOLVED. Section 2210.2515(h) says the department
 * "shall charge a reasonable fee for each inspection of each structure". TDI's
 * inspection process page says "TDI inspectors do not charge an inspection fee".
 * No post states a fee in either direction.
 *
 * LOCAL FACTS. Only those already on record in this repository are used:
 * Corpus Christi is the seat of Nueces County and its limits reach onto Mustang
 * and Padre Islands (src/content/location.ts), Hurricane Harvey came ashore near
 * Rockport in 2017 (src/content/regions.ts), and Corpus Christi, Portland and
 * Rockport run their own building departments (src/content/regions.ts). Ingleside
 * and Aransas Pass are not named, because nothing here sources a fact about them.
 *
 * NO PRESENT TENSE SERVICE CLAIM, AND NO SENTENCE ABOUT THE FIRM'S STATUS. The
 * firm's status is rendered by the gate's own sentences elsewhere on the page.
 */

const SRC = {
  ins2210_003: {
    label: "Tex. Ins. Code § 2210.003, Definitions",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.003",
  },
  ins2210_251: {
    label: "Tex. Ins. Code § 2210.251, Building Standards",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.251",
  },
  ins2210_254: {
    label: "Tex. Ins. Code § 2210.254, Qualified Inspectors",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.254",
  },
  ins2210_2515: {
    label: "Tex. Ins. Code § 2210.2515, Issuance of Certificates of Compliance",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.2515",
  },
  ins2210_258: {
    label: "Tex. Ins. Code § 2210.258, Compliance with Building Codes; Eligibility",
    url: "https://texas.public.law/statutes/tex._ins._code_section_2210.258",
  },
  tdiProcess: {
    label: "Texas Department of Insurance, Windstorm Inspection Process",
    url: "https://www.tdi.texas.gov/wind/inspectionproc.html",
  },
  tdiCompleted: {
    label: "Texas Department of Insurance, Completed Construction Certificates",
    url: "https://www.tdi.texas.gov/wind/completed-construction-certificates.html",
  },
  rule137_33: {
    label: "22 Tex. Admin. Code § 137.33, Sealing Procedures",
    url: "http://txrules.elaws.us/rule/title22_chapter137_sec.137.33",
  },
  occ1001_401: {
    label: "Tex. Occ. Code § 1001.401, Use of Seal",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.401",
  },
} as const;

const cite = (key: keyof typeof SRC, supports: string) => ({ ...SRC[key], supports });

const DATE = "2026-09-15";

export const coastalInsights: Insight[] = [
  // ------------------------------------------------------------------------ 1
  {
    slug: "twia-eligibility-requirements",
    title: "TWIA Eligibility Requirements Explained | 254 Engineering",
    h1: "TWIA eligibility requirements, read from the Insurance Code",
    description:
      "What Texas Insurance Code section 2210.258 requires before TWIA may insure coastal work, and the two exceptions it allows. Read the statute behind binding.",
    summary:
      "Whether coastal work can be insured through the association is not an underwriting preference. It is a sentence in section 2210.258, and it has two exceptions an agent should know by heart.",
    eyebrow: "Windstorm law",
    primaryKeyword: "twia eligibility requirements",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Ask a coastal agent whether a house is eligible for the Texas Windstorm Insurance Association and the usual answer is a question back: has the work been certified? That instinct is right, and it comes from a specific place. Section 2210.258 of the Texas Insurance Code says, in terms, when the association may insure and when it may not.",
      },
      { kind: "h2", text: "The rule in one sentence" },
      {
        kind: "p",
        text: "Subsection (a) requires that construction, alteration, remodeling, enlargement, and repair of, or addition to, any structure in the catastrophe area, begun on or after the effective date of the 2009 legislation it names, be performed in compliance with the applicable building code standards set out in the association's plan of operation.",
      },
      {
        kind: "p",
        text: "Subsection (b) is the sentence that decides binding. Except as subsections (c) and (d) provide, the association may not insure such a structure until a certificate of compliance has been issued for it under section 2210.2515.",
      },
      {
        kind: "p",
        text: "The trigger is the certificate itself. A booked inspection does not meet it, and neither does work that looks finished.",
      },
      { kind: "h2", text: "Which property the rule reaches" },
      {
        kind: "p",
        text: "The rule attaches to the catastrophe area, which section 2210.003 defines as a municipality, county, or part of either designated by the commissioner. The same section names fourteen first tier coastal counties: Aransas, Brazoria, Calhoun, Cameron, Chambers, Galveston, Jefferson, Kenedy, Kleberg, Matagorda, Nueces, Refugio, San Patricio, and Willacy. How the designated area is drawn, including the part of Harris County it takes in, is set out on [the catastrophe area page](/windstorm/catastrophe-area).",
      },
      {
        kind: "p",
        text: "On the Coastal Bend that means the whole of Nueces, San Patricio, and Aransas counties sit on the regulated side of the windstorm eligibility line. Corpus Christi's own city limits run from the bluff downtown out onto Mustang and Padre Islands, so a single building department covers a bayfront renovation and a Gulf front new build, and the same subsection governs both.",
      },
      { kind: "h2", text: "What the certificate is evidence of" },
      {
        kind: "p",
        text: "Section 2210.251(g) says a certificate of compliance issued by the department under section 2210.2515 demonstrates compliance with the applicable building code under the plan of operation, and then adds the sentence underwriters care about: the certificate is evidence of insurability of the structure by the association.",
      },
      {
        kind: "p",
        text: "The issuer is the Texas Department of Insurance, not the contractor and not an engineer. A sealed letter from an engineer is a different document with a different author, and the difference is worked through on [the page comparing an engineer letter with a windstorm certificate](/insights/engineer-letter-vs-windstorm-certificate).",
      },
      { kind: "h2", text: "Exception one: a house the private market dropped" },
      {
        kind: "p",
        text: "Subsection (c) lets the association insure a residential structure built, altered, remodeled, enlarged, repaired, or added to on or after June 19, 2009, that is not in compliance with the applicable standards, provided three things are all true.",
      },
      {
        kind: "ul",
        items: [
          "The structure had been insured on or after June 19, 2009, by an insurer in the private market that canceled or nonrenewed that coverage.",
          "The applicant gives the association proof of that cancellation or nonrenewal, for coverage issued to the applicant or to the previous insured.",
          "No construction, alteration, remodeling, enlargement, or repair of, or addition to, the structure occurred after the cancellation or nonrenewal and before the application to the association.",
        ],
      },
      {
        kind: "p",
        text: "The third condition is the one that quietly fails. A homeowner whose carrier nonrenewed in the spring, who replaced a damaged section of roof over the summer and applied in the autumn, has done work inside the window the subsection closes. The exception is written for a house that stood still between losing private coverage and asking the association for it.",
      },
      { kind: "h2", text: "Exception two: thirty days on an inspection form" },
      {
        kind: "p",
        text: "Subsection (d) allows a policy term of no more than 30 days for a structure that is otherwise insurable, where an inspection verification form or another inspection form adopted by the department has issued, while the applicant seeks the certificate. It is a bridge with a fixed length, and how it fits a real schedule is set out on [the thirty day coverage page](/insights/twia-temporary-coverage-inspection-form).",
      },
      { kind: "h2", text: "What an agent can establish before binding" },
      {
        kind: "ul",
        items: [
          "Whether the address is inside the designated catastrophe area at all.",
          "Whether any work on the structure began after the 2009 legislation took effect, and if so whether a certificate has issued for that work.",
          "If the house was dropped by a private carrier, the date of the cancellation or nonrenewal, the proof of it, and whether anything was built or repaired since.",
          "If a certificate is still pending, whether a department inspection form has issued that would support the 30 day term.",
        ],
      },
      {
        kind: "note",
        title: "What this page does not settle",
        body: [
          "The statute refers to the association's plan of operation for the applicable building code standards, and to department forms for the mechanics. Neither is quoted here. Where a question turns on the plan of operation or on the association's own underwriting procedure, that document governs and should be read directly rather than inferred from the statute.",
        ],
      },
    ],
    sources: [
      cite("ins2210_258", "The rule that the association may not insure until a certificate of compliance has issued, the private market exception and its June 19, 2009 date, and the 30 day term."),
      cite("ins2210_251", "That a department certificate demonstrates compliance and is evidence of insurability of the structure by the association."),
      cite("ins2210_003", "The definition of catastrophe area and the fourteen first tier coastal counties."),
      cite("ins2210_2515", "The section under which the department issues certificates of compliance."),
    ],
    faqs: [
      {
        q: "Can TWIA write a policy before the WPI-8 issues?",
        a: "Only inside the two exceptions in section 2210.258. Subsection (b) bars the association from insuring covered work until a certificate of compliance has issued. Subsection (c) covers a residential structure a private insurer canceled or nonrenewed, on its three conditions, and subsection (d) allows a term of no more than 30 days where a department inspection form has issued.",
      },
      {
        q: "Does the private market exception apply to commercial buildings?",
        a: "Subsection (c) is written for a residential structure. It does not extend that exception to other structures.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 2
  {
    slug: "twia-coverage-homes-built-before-1988",
    title: "TWIA Coverage for Homes Built Before 1988 | 254 Engineering",
    h1: "TWIA coverage for homes built before 1988, and where the date stops helping",
    description:
      "How Insurance Code section 2210.251 treats homes built before 1988, the prior coverage evidence it accepts, and what later work changes. Read the statute.",
    summary:
      "An older coastal house can be eligible for association coverage without any inspection, on the strength of its date. The statute also says exactly what that date does not carry forward.",
    eyebrow: "Windstorm law",
    primaryKeyword: "twia coverage homes built before 1988",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Section 2210.251 of the Texas Insurance Code draws a line at January 1, 1988. Work on a structure on or after that date has to comply with the association's plan of operation to be insurable through it. Work before that date is treated differently, and for an older house that difference can decide whether an application needs a certificate at all.",
      },
      { kind: "h2", text: "The line the statute draws" },
      {
        kind: "p",
        text: "Subsection (a) makes compliance with the plan of operation the condition of eligibility for a structure constructed, altered, remodeled, enlarged, or repaired, or to which additions are made, on or after January 1, 1988. The list of verbs is the point. The date that matters is the date of the work, and a structure can have more than one.",
      },
      { kind: "h2", text: "A house in an area that had a recognized code" },
      {
        kind: "p",
        text: "Subsection (d) takes pre-1988 work in an area that was governed at the time by a building code the association recognizes, and says the structure is eligible without compliance with the inspection or approval requirements of the section or the plan of operation. No inspection, no approval, no certificate, because the code in force when it was built is doing the work.",
      },
      {
        kind: "p",
        text: "The statute does not list which places had a recognized code on which dates. That is a fact about a particular jurisdiction at a particular time, and it has to be established for the address rather than assumed from the county.",
      },
      { kind: "h2", text: "A house in an area with no recognized code" },
      {
        kind: "p",
        text: "Subsection (e) is the harder case and the more useful one to read closely. Pre-1988 work in an area with no recognized code is still eligible without inspection, but only if the structure was previously insured by an insurer authorized to do business in Texas, is in essentially the same condition as when it was insured apart from normal wear and tear, and has no structural change other than a change made according to code.",
      },
      {
        kind: "p",
        text: "The prior coverage has to be for windstorm and hail, and it has to fall within the twelve months immediately before the application to the association. The subsection names what the evidence includes:",
      },
      {
        kind: "ul",
        items: [
          "a copy of a previous insurance policy",
          "copies of canceled checks or agent's records showing payments for previous policies",
          "a copy of the title to the structure, or mortgage company records, showing previous policies",
        ],
      },
      {
        kind: "p",
        text: "A lapse is expensive here. A house that went more than twelve months without windstorm and hail coverage has lost the evidence the subsection asks for, however unchanged the building is.",
      },
      { kind: "h2", text: "Why a later repair does not inherit the house's date" },
      {
        kind: "p",
        text: "The pre-1988 treatment belongs to the pre-1988 work. A roof replaced last year on a house built in 1975 is work done on or after January 1, 1988, and subsection (a) reaches it. Inside the catastrophe area, section 2210.258 goes further for work begun after its 2009 legislation took effect: the association may not insure the structure until a certificate of compliance has issued for that work, subject to that section's own exceptions, which are set out on [the TWIA eligibility requirements page](/insights/twia-eligibility-requirements).",
      },
      {
        kind: "p",
        text: "Hurricane Harvey came ashore near Rockport in 2017. Where a house built before 1988 was repaired after that storm, the age of the house is not the question an application turns on. The question is what was done to them, when, and whether a certificate exists for it, which is checkable through the [certificate history of the building](/windstorm/buying-and-selling).",
      },
      { kind: "h2", text: "Settling it before an application goes in" },
      {
        kind: "ul",
        items: [
          "When the structure was built, and when each later alteration, repair, or addition was made.",
          "Whether the area was governed by a building code the association recognizes at the time of the original work.",
          "If it was not, whether windstorm and hail coverage was in force within the twelve months before the application, and which of the named documents shows it.",
          "Whether any structural change since was made according to code.",
          "For any work on or after 1988 inside the catastrophe area, whether a certificate of compliance has issued.",
        ],
      },
    ],
    sources: [
      cite("ins2210_251", "The January 1, 1988 line, the treatment of earlier work in areas with and without a recognized building code, the twelve month window, and the evidence of prior coverage."),
      cite("ins2210_258", "That work begun after the 2009 legislation inside the catastrophe area needs a certificate of compliance before the association may insure it, subject to its exceptions."),
    ],
    faqs: [
      {
        q: "Does a pre-1988 house need a WPI-8 to get TWIA coverage?",
        a: "Not for the pre-1988 work itself, if it meets section 2210.251(d) or (e). Work done on the structure on or after January 1, 1988 is outside that treatment, and inside the catastrophe area work begun after the 2009 legislation needs a certificate of compliance before the association may insure the structure, subject to the exceptions in section 2210.258.",
      },
      {
        q: "What counts as proof of earlier windstorm coverage?",
        a: "Section 2210.251(e) names a copy of a previous policy, canceled checks or agent's records showing payments, and a copy of the title or mortgage company records showing previous policies. The coverage has to be for windstorm and hail, within the twelve months before the application.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 3
  {
    slug: "twia-temporary-coverage-inspection-form",
    title: "TWIA 30 Day Coverage on an Inspection Form | 254 Engineering",
    h1: "TWIA 30 day coverage while a windstorm certificate is pending",
    description:
      "How Insurance Code section 2210.258(d) allows a TWIA term of no more than 30 days on a department inspection form, and what it cannot bridge. Read the details.",
    summary:
      "Between the last inspection and the certificate there can be a gap a closing cannot wait for. The statute gives the association one narrow way across it, and it is exactly thirty days wide.",
    eyebrow: "Windstorm law",
    primaryKeyword: "twia 30 day temporary coverage",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Section 2210.258(b) of the Insurance Code does not let the Texas Windstorm Insurance Association insure covered coastal work until a certificate of compliance has issued. Subsection (d) is the one door in that wall designed for timing rather than for a category of property.",
      },
      { kind: "h2", text: "What subsection (d) says" },
      {
        kind: "p",
        text: "The association may insure the structure for a policy term not to exceed 30 days if an inspection verification form, or another inspection form adopted by the department, has been issued for the structure. The purpose is written into the sentence: providing temporary coverage while an applicant seeks to secure a certificate of compliance. And there is a condition at the end that is easy to read past. The structure has to be otherwise insurable property.",
      },
      { kind: "h2", text: "Three conditions, each doing work" },
      {
        kind: "p",
        text: "The form has to exist. It is a department form, issued through the inspection process, which means the inspection record has to have reached a point where the department's process produces it.",
      },
      {
        kind: "p",
        text: "The term has a ceiling rather than a target. Thirty days is the most the subsection allows for that term.",
      },
      {
        kind: "p",
        text: "And the coverage is temporary by design, tied to an applicant who is seeking the certificate. It is not a route around one.",
      },
      { kind: "h2", text: "What the form is not" },
      {
        kind: "p",
        text: "An engineer's letter describing the work is not an inspection form adopted by the department, however carefully it is written or sealed. Neither is a contractor's invoice, a permit card from the city, or a set of photographs. The subsection names a department document, and the difference between a professional's statement and a department record is worked through on [the page on engineer letters and windstorm certificates](/insights/engineer-letter-vs-windstorm-certificate).",
      },
      { kind: "h2", text: "Fitting thirty days to a real job" },
      {
        kind: "p",
        text: "On ongoing work the pieces are sequenced. The department's own page says its inspectors try to conduct inspections within 48 hours of the requested date, excluding weekends and holidays, and that where work does not comply the inspector posts a notice at the job describing the problems and returns to reinspect after they are corrected. A deficiency found late in the sequence is time taken from a thirty day term that has already started.",
      },
      {
        kind: "p",
        text: "Completed work is a different shape of problem. Where nobody inspected the work while it was open, the route is a sealed post-construction evaluation report under section 2210.2515(c), and the documentation that report needs may take longer to assemble than a thirty day term allows. The report and what it asks of the engineer are covered on [the post-construction evaluation report page](/insights/post-construction-evaluation-report).",
      },
      { kind: "h2", text: "A closing inside the term" },
      {
        kind: "p",
        text: "For a coastal sale the arithmetic is unforgiving. A buyer in Port Aransas or Rockport whose lender needs wind coverage in place at closing is relying on the certificate arriving inside the term, and the reliable way to avoid that dependence is to look at the [windstorm record during the option period](/windstorm/buying-and-selling) rather than in the last week.",
      },
      {
        kind: "note",
        title: "What the subsection does not say",
        body: [
          "Section 2210.258(d) sets a term of no more than 30 days. It does not say whether a second term may follow the first, and this page does not guess. Whether the association will write another temporary term on the same structure is a question for the association's own procedure.",
        ],
      },
    ],
    sources: [
      cite("ins2210_258", "The rule that the association may not insure until a certificate issues, and the 30 day term on a department inspection form while an applicant seeks the certificate."),
      cite("tdiProcess", "The 48 hour inspection target, the notice posted at the job for non-compliant work, and reinspection after correction."),
      cite("ins2210_2515", "The sealed post-construction evaluation report route for a completed improvement."),
    ],
    faqs: [
      {
        q: "Can TWIA temporary coverage be extended past 30 days?",
        a: "Section 2210.258(d) limits the term to no more than 30 days and is silent on whether another term may follow. That question belongs to the association's own procedure rather than to the statute.",
      },
      {
        q: "Is an engineer's letter enough to get the 30 day term?",
        a: "The subsection requires an inspection verification form or another inspection form adopted by the department. A letter from an engineer is not a department form.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 4
  {
    slug: "windstorm-certificate-of-compliance",
    title: "Windstorm Certificate of Compliance Law | 254 Engineering",
    h1: "Windstorm certificate of compliance: what section 2210.2515 actually requires",
    description:
      "The Insurance Code section behind the WPI-8: notice before work, who may inspect, the six month limit, and why it cannot be rescinded. Read the statute.",
    summary:
      "The WPI-8 is the department's form. The obligations behind it are in section 2210.2515, and two of them, the six month limit and the bar on rescission, are rarely mentioned until they matter.",
    eyebrow: "Windstorm law",
    primaryKeyword: "windstorm certificate of compliance",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Everybody on the coast calls it the WPI-8. The Insurance Code calls it a certificate of compliance, and section 2210.2515 is where the department's authority to issue one is written down. The forms implement the section, and reading the section answers questions the forms never raise.",
      },
      { kind: "h2", text: "Notice comes before the work" },
      {
        kind: "p",
        text: "Subsection (b) requires a person seeking coverage to give written notice, on a form the department prescribes, of the intent to construct, repair, alter, remodel, or enlarge a structure, before beginning. The department's process page identifies that notice as Form WPI-1, the application for a certificate of compliance, submitted before construction begins. How that sequence plays out on site is set out on [the page about filing before work begins](/windstorm/before-work-begins).",
      },
      { kind: "h2", text: "Ongoing work and who may inspect it" },
      {
        kind: "p",
        text: "For an ongoing improvement, subsection (d) directs the department to issue the certificate if a qualified inspector inspects in accordance with commissioner rule and affirms that the improvement either conforms to a design sealed by a licensed professional engineer that complies with the applicable code, or complies with the applicable code.",
      },
      {
        kind: "p",
        text: "Section 2210.254 says who a qualified inspector is. It includes a person the department determines is qualified by training or experience, a licensed professional engineer, and an inspector holding the code body certifications and the buildings and coastal construction inspector certifications that section lists. Two further sentences in it carry the weight: a windstorm inspection may be performed only by a qualified inspector, and before performing inspections a qualified inspector must be approved and appointed or employed by the department. The practical meaning of that appointment is covered on [the page about appointed engineers](/windstorm/appointed-engineers).",
      },
      {
        kind: "p",
        text: "The department's process page adds the observation that governs every schedule: all inspectors must see the work in progress, during and not before or after the construction or repair.",
      },
      { kind: "h2", text: "Completed work goes a different way" },
      {
        kind: "p",
        text: "Subsection (c) covers a completed improvement and gives two routes, both through a licensed professional engineer. Either the engineer designed the improvement, sealed the design, and affirms on the department's form that the design complies and the improvement was built to it, or the engineer submits a sealed post-construction evaluation report with supporting documentation. The distinction between ongoing and completed turns on a definition that surprises builders, and it has [its own page](/insights/ongoing-vs-completed-improvement).",
      },
      { kind: "h2", text: "The six month limit after final inspection" },
      {
        kind: "p",
        text: "Subsection (e) is the clause that catches finished jobs. For an ongoing improvement, the department may not issue the certificate if, within six months after the date of the final inspection, it has not received fully completed forms demonstrating that the improvement meets subsection (d), and payment in full of all inspection fees owed to it, including fees for prior department inspections.",
      },
      {
        kind: "p",
        text: "Read that plainly. A job can pass its final inspection and still never receive a certificate, because the paperwork after the inspection was not finished in time. Nothing about the building has to be wrong.",
      },
      { kind: "h2", text: "Once issued, it stays issued" },
      {
        kind: "p",
        text: "Subsection (k) is short: the department may not rescind a certificate of compliance after issuing it under the section. The statute pairs that with accountability placed on the people rather than the document. Subsection (i) authorizes the department to submit a formal complaint to the Texas Board of Professional Engineers and Land Surveyors about an engineer's work reflected in a sealed post-construction evaluation report or other materials submitted under subsection (c), and subsection (j) lets it penalize a qualified inspector who fails to provide complete and accurate information, including by barring that inspector from applying for certificates.",
      },
      {
        kind: "note",
        title: "Two sources that do not agree about fees",
        body: [
          "Section 2210.2515(h) says the department shall charge a reasonable fee for each inspection of each structure, in an amount set by the commissioner. The department's inspection process page says TDI inspectors do not charge an inspection fee. Both were read on the date of this page. They are recorded here rather than reconciled, and no fee is stated in either direction; the department is the place to confirm what applies to a given job.",
        ],
      },
    ],
    sources: [
      cite("ins2210_2515", "Notice before work, the ongoing and completed routes, the six month limit after final inspection, the fee provision, the referral to the engineering board, inspector penalties, and the bar on rescission."),
      cite("ins2210_254", "Who is a qualified inspector, that only a qualified inspector may perform a windstorm inspection, and that one must be approved and appointed or employed by the department."),
      cite("tdiProcess", "Form WPI-1 submitted before construction, that all inspectors must see the work in progress, and the statement that TDI inspectors do not charge an inspection fee."),
    ],
    faqs: [
      {
        q: "Can TDI take back a WPI-8 after it is issued?",
        a: "Section 2210.2515(k) says the department may not rescind a certificate of compliance after issuing it under that section. The statute addresses errors through the people instead, with a referral of an engineer's work to the engineering board and penalties on qualified inspectors.",
      },
      {
        q: "What happens if the final paperwork is late?",
        a: "Under section 2210.2515(e), for an ongoing improvement the department may not issue the certificate if it has not received the fully completed forms and full payment of inspection fees within six months after the date of the final inspection.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 5
  {
    slug: "ongoing-vs-completed-improvement",
    title: "Ongoing vs Completed Windstorm Improvement | 254 Engineering",
    h1: "Ongoing vs completed improvement, and why a deed decides the windstorm route",
    description:
      "How section 2210.2515 defines ongoing and completed improvements by title transfer, and what that means for builders and first buyers. Read the section.",
    summary:
      "Whether coastal work is ongoing or completed sounds like a question about construction. The statute answers it with a question about title, and that choice changes which certificate route is open.",
    eyebrow: "Windstorm law",
    primaryKeyword: "ongoing vs completed improvement windstorm",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "A certificate of compliance can be sought for an ongoing improvement or for a completed one, and section 2210.2515 of the Insurance Code sends each down a different route. Most people assume the difference is whether the builders have left. The statute defines it another way.",
      },
      { kind: "h2", text: "The definitions, word for word in substance" },
      {
        kind: "p",
        text: "Subsection (a) defines an improvement as the construction of, or repair, alteration, remodeling, or enlargement of, a structure to which the plan of operation applies. A re-roof is a repair or an alteration, so it is an improvement in exactly the same sense as a new house.",
      },
      {
        kind: "p",
        text: "A completed improvement is one in which the original transfer of title from the builder to the initial owner has occurred. If no such transfer is contemplated, it is one that is substantially completed.",
      },
      {
        kind: "p",
        text: "An ongoing improvement is the mirror image: the original transfer of title from the builder to the initial owner has not occurred, or, where no transfer is contemplated, the improvement is not substantially completed.",
      },
      { kind: "h2", text: "Two kinds of project, two tests" },
      {
        kind: "p",
        text: "Where a builder is building to sell, the test is the deed. Until the original transfer of title to the first owner happens, the statute calls the work ongoing, and after it happens the statute calls it completed.",
      },
      {
        kind: "p",
        text: "Where an owner is improving property they already hold, no builder to initial owner transfer is contemplated, so the fallback test applies and the question becomes whether the improvement is substantially completed. A homeowner's addition, a replacement window package, and a storm repair all fall under that second test.",
      },
      { kind: "h2", text: "What the ongoing route requires" },
      {
        kind: "p",
        text: "Subsection (d) issues the certificate for an ongoing improvement on the affirmation of a qualified inspector who inspects in accordance with commissioner rule. The department's own process page is explicit about what inspection means in practice: all inspectors must see the work in progress, during and not before or after the construction or repair.",
      },
      {
        kind: "p",
        text: "So the definition does not rescue concealed work. A spec house that is finished and still unsold may be an ongoing improvement on the statute's definition, but an inspection that has to see the work in progress cannot see framing connections already behind drywall. The label decides which application is available. It does not change what an inspector is able to observe.",
      },
      { kind: "h2", text: "What the completed route requires" },
      {
        kind: "p",
        text: "Subsection (c) issues the certificate for a completed improvement through a licensed professional engineer in one of two ways: an engineer who designed and sealed the improvement affirms on the department's form that the design complies and that the work was built to it, or an engineer submits a sealed post-construction evaluation report with supporting documentation. The department's completed construction page describes the application as a WPI-2E and the resulting certificate as a WPI-8E. What the report demands of the engineer is on [the post-construction evaluation report page](/insights/post-construction-evaluation-report), and the practical difficulty of evidence hidden inside a finished building is on [the completed construction page](/windstorm/completed-construction).",
      },
      { kind: "h2", text: "Why a first buyer should care" },
      {
        kind: "p",
        text: "The moment the deed passes from builder to first owner, the statute's category for any work that was never certified changes from ongoing to completed. A buyer who closes on a new coastal house without a certificate on file has taken title at the moment the statute's category for that uncertified work changed.",
      },
      {
        kind: "p",
        text: "On the Coastal Bend, where Nueces, San Patricio, and Aransas are all first tier coastal counties under section 2210.003, the time to ask for the certificate on new construction is before closing. The windstorm record is searchable, and what to look for in it is set out on [the coastal closing page](/windstorm/buying-and-selling).",
      },
    ],
    sources: [
      cite("ins2210_2515", "The definitions of improvement, completed improvement and ongoing improvement, and the ongoing and completed certificate routes."),
      cite("tdiProcess", "That all inspectors must see the work in progress, during and not before or after the construction or repair."),
      cite("tdiCompleted", "The WPI-2E application and the WPI-8E certificate for completed construction."),
      cite("ins2210_003", "Nueces, San Patricio, and Aransas among the fourteen first tier coastal counties."),
    ],
    faqs: [
      {
        q: "Is an unsold spec house an ongoing improvement?",
        a: "On the definition in section 2210.2515(a), an improvement is ongoing while the original transfer of title from the builder to the initial owner has not occurred. That does not make concealed work inspectable: the department's process requires inspectors to see the work in progress.",
      },
      {
        q: "How does the statute treat a homeowner's own renovation?",
        a: "Where no builder to initial owner transfer is contemplated, the test is whether the improvement is substantially completed. Until it is, it is ongoing. Once it is, it is completed.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 6
  {
    slug: "post-construction-evaluation-report",
    title: "Post-Construction Evaluation Report Rules | 254 Engineering",
    h1: "Post-construction evaluation reports: what the engineer affirms and answers for",
    description:
      "What section 2210.2515 requires in a sealed post-construction evaluation report, when TDI may deny one, and how an engineer answers for it. Read on.",
    summary:
      "When coastal work was finished without inspection, the certificate rests on one engineer's sealed report. The statute says what that report must contain, and who may call the engineer to account for it.",
    eyebrow: "Windstorm law",
    primaryKeyword: "post-construction evaluation report",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Most of the windstorm program runs on inspections: a qualified inspector sees the work while it is open and affirms what was seen. For a completed improvement that nobody inspected, section 2210.2515(c) of the Insurance Code substitutes a document. Anyone relying on that document, or choosing who produces it, should know what the statute asks of it.",
      },
      { kind: "h2", text: "What the report has to be" },
      {
        kind: "p",
        text: "Under subsection (c)(2), a professional engineer licensed by the Texas Board of Professional Engineers and Land Surveyors completes and submits a sealed post-construction evaluation report that confirms the improvement's compliance with the applicable building code under the plan of operation, and includes documentation supporting the report on a department form bearing the engineer's seal.",
      },
      {
        kind: "p",
        text: "Two things in that sentence are sealed, the report and the supporting documentation, and both are the engineer's. The certificate that follows is the department's, but the evidence it rests on carries a named licensee.",
      },
      { kind: "h2", text: "When the department may refuse it" },
      {
        kind: "p",
        text: "Subsection (c-1) allows the department to deny the application if the evaluation report, or the design affirmation form used under the other completed route, is not fully documented as subsection (c) requires.",
      },
      {
        kind: "p",
        text: "The standard is documentation, and a conclusion without the record behind it is the thing the subsection is written to stop.",
      },
      { kind: "h2", text: "What the engineer is not asked to assume" },
      {
        kind: "p",
        text: "Subsection (c-2) says a department form under subsection (c) may not require a professional engineer to assume liability for the construction of an improvement. The engineer answers for the evaluation and the documentation. The builder's work remains the builder's. That line is worth knowing when a party to a transaction treats a sealed report as though it were a warranty of the construction.",
      },
      { kind: "h2", text: "Who can call the engineer to account" },
      {
        kind: "p",
        text: "Subsection (i) authorizes the department to submit a formal complaint under Chapter 1001 of the Occupations Code to the engineering board, related to an engineer's work as reflected in a sealed post-construction evaluation report or other materials submitted under subsection (c). And section 2210.2515(k) bars the department from rescinding a certificate once it has issued. Put together, a certificate that should not have issued stays issued, and the statute's remedy points at the engineer.",
      },
      { kind: "p", text: "The engineering board's own rule already points the same way." },
      {
        kind: "p",
        text: "It is consistent with what the seal means in the first place. Rule 137.33 of the engineering board's rules states that the purpose of the seal is to assure the user that the work was performed or directly supervised by the engineer named, and that on sealing, the engineer takes full professional responsibility for that work. Section 1001.401 of the Occupations Code requires the seal on a report issued for a Texas project.",
      },
      { kind: "h2", text: "What that means for anyone choosing who produces one" },
      {
        kind: "ul",
        items: [
          "Ask what the documentation will consist of, because subsection (c-1) makes an under-documented report refusable.",
          "Ask what happens when a connection or attachment cannot be verified from the record, because the seal is full professional responsibility for what is stated.",
          "Expect the report to address the improvement, not to warrant the builder's work, because subsection (c-2) keeps the two apart.",
          "Confirm the engineer's license with the board, and treat an appointment as a separate fact, needed for ongoing work and not, on the department's own page, for completed construction.",
        ],
      },
      {
        kind: "p",
        text: "The last point needs care. Subsection (c) names a professional engineer licensed by the engineering board, and does not use the qualified inspector language of subsection (d). The department's completed construction page says the same thing in its own words: any professional engineer licensed by the board can perform inspections on completed construction, while appointed qualified inspectors can inspect both completed and ongoing work. The practical difficulty of that route is covered on [the completed construction page](/windstorm/completed-construction).",
      },
      {
        kind: "p",
        text: "The report route is also the reason the [certificate of compliance section](/insights/windstorm-certificate-of-compliance) puts so much weight on notice before work. Inspection while the work is open records the evidence. A report after the fact has to reconstruct it.",
      },
    ],
    sources: [
      cite("ins2210_2515", "The contents of a sealed post-construction evaluation report, denial for incomplete documentation, the bar on requiring an engineer to assume construction liability, the referral to the engineering board, and the bar on rescission."),
      cite("rule137_33", "The stated purpose of the seal and that on sealing the engineer takes full professional responsibility for the work."),
      cite("occ1001_401", "The requirement that a report issued for a Texas project carry the license holder's seal."),
      cite("tdiCompleted", "That any professional engineer licensed by the board can perform inspections on completed construction, and that appointed qualified inspectors can inspect completed and ongoing work."),
    ],
    faqs: [
      {
        q: "Does a sealed post-construction evaluation report make the engineer liable for the construction?",
        a: "Section 2210.2515(c-2) says a department form under subsection (c) may not require a professional engineer to assume liability for the construction of an improvement. The engineer answers for the evaluation and its documentation.",
      },
      {
        q: "Can TDI refuse a post-construction evaluation report?",
        a: "Subsection (c-1) allows the department to deny the application if the report or the design affirmation form is not fully documented as subsection (c) requires.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 7
  {
    slug: "engineer-letter-vs-windstorm-certificate",
    title: "Engineer Letter vs Windstorm Certificate | 254 Engineering",
    h1: "Engineer letter vs windstorm certificate: which one the association may rely on",
    description:
      "Why a sealed engineer letter cannot stand in for a TDI windstorm certificate, and where an engineer's sealed work does count. Read the sections that decide it.",
    summary:
      "An engineer's sealed letter and a windstorm certificate both look official and both concern the same building. Only one is a document the association's statute names.",
    eyebrow: "Windstorm law",
    primaryKeyword: "engineer letter vs windstorm certificate",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "It happens late in coastal jobs and later still in coastal closings. A certificate is missing, somebody produces a letter from an engineer saying the work was done right, and everyone hopes the letter will do. The Insurance Code has already decided whether it will.",
      },
      { kind: "h2", text: "What a sealed letter is" },
      {
        kind: "p",
        text: "A letter or report issued by a Texas professional engineer for a Texas project carries the engineer's seal under section 1001.401 of the Occupations Code. Rule 137.33 of the engineering board's rules states what the seal is for: to assure the user that the work was performed or directly supervised by the engineer named, and on sealing, the engineer takes full professional responsibility for it. How that responsibility is scoped when more than one engineer is involved is covered on [the engineer of record page](/insights/engineer-of-record-texas).",
      },
      {
        kind: "p",
        text: "That is a serious document. It is also a statement by one professional, addressed to whoever it was written for.",
      },
      { kind: "h2", text: "What a windstorm certificate is" },
      {
        kind: "p",
        text: "A certificate of compliance is issued by the Texas Department of Insurance under section 2210.2515 of the Insurance Code. Section 2210.251(g) says it demonstrates compliance with the applicable building code under the plan of operation and is evidence of insurability of the structure by the association. Section 2210.258(b) says the association may not insure covered work until one has issued, subject to that section's exceptions.",
      },
      {
        kind: "p",
        text: "Nothing in those sections gives the same effect to a letter. The statute names a department document, and a letter is not one.",
      },
      { kind: "h2", text: "Where an engineer's sealed work does count" },
      {
        kind: "p",
        text: "Engineers are written into the statute, just not by way of a letter. For a completed improvement, section 2210.2515(c) routes the certificate through a licensed professional engineer who either designed and sealed the improvement and affirms on the department's form that it was built to the design, or submits a sealed post-construction evaluation report with supporting documentation on the department's form. For ongoing work, a licensed professional engineer is one of the kinds of qualified inspector in section 2210.254, and a qualified inspector must be approved and appointed or employed by the department before inspecting.",
      },
      {
        kind: "p",
        text: "In every one of those routes the engineer's work goes to the department on the department's forms, and the department issues the certificate. The engineer is an input to the record. The certificate is the record.",
      },
      { kind: "h2", text: "The thirty day term does not take a letter either" },
      {
        kind: "p",
        text: "Section 2210.258(d) allows association coverage for no more than 30 days where an inspection verification form or another inspection form adopted by the department has issued. The subsection is specific about the kind of document. How that bridge works is on [the page about 30 day coverage on an inspection form](/insights/twia-temporary-coverage-inspection-form).",
      },
      { kind: "h2", text: "Where letters still matter" },
      {
        kind: "p",
        text: "Outside the association's statute, a sealed letter can be exactly what a building department, a lender, or a private carrier asks for. Those are that party's requirements, not the Insurance Code's, and what satisfies them is read from their own requirement rather than assumed. What a plans examiner is looking for in one is on [the structural letters page](/services/structural-letters).",
      },
      {
        kind: "note",
        title: "The short test",
        body: [
          "Ask who issued the document. If the answer is the Texas Department of Insurance, it may be the certificate the association's statute refers to. If the answer is an engineer, it is that engineer's professional statement, which may be part of how a certificate is obtained but is not the certificate.",
        ],
      },
    ],
    sources: [
      cite("ins2210_258", "That the association may not insure covered work until a certificate of compliance has issued, and the 30 day term on a department inspection form."),
      cite("ins2210_251", "That a department certificate demonstrates compliance and is evidence of insurability of the structure by the association."),
      cite("ins2210_2515", "The completed improvement routes through a licensed engineer's sealed design affirmation or post-construction evaluation report on department forms."),
      cite("ins2210_254", "That a licensed professional engineer is a kind of qualified inspector, who must be approved and appointed or employed by the department."),
      cite("rule137_33", "What the seal is for, and that on sealing the engineer takes full professional responsibility."),
      cite("occ1001_401", "That a report issued for a Texas project carries the license holder's seal."),
    ],
    faqs: [
      {
        q: "Will TWIA accept an engineer's letter instead of a WPI-8?",
        a: "Section 2210.258(b) bars the association from insuring covered work until a certificate of compliance has issued, subject to its exceptions, and the certificate is issued by the Texas Department of Insurance. A letter from an engineer is not that certificate.",
      },
      {
        q: "Then why do engineers get involved in windstorm certification at all?",
        a: "Because the statute routes some certificates through them. A licensed engineer can be a qualified inspector for ongoing work once approved and appointed or employed by the department, and for completed work an engineer's sealed design affirmation or post-construction evaluation report goes to the department on its forms.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 8
  {
    slug: "windstorm-inspection-for-roofers",
    title: "Windstorm Inspection for Coastal Roofers | 254 Engineering",
    h1: "Windstorm inspection for roofers: the paperwork that has to exist before tear off",
    description:
      "What a roofer needs for a windstorm certificate: notice before work, an inspection that sees the deck, deficiency notices, and the six month limit. Read it.",
    summary:
      "For a roofer on the coast the certificate is decided by paperwork on either side of the job and by one inspection in the middle of it. Here is what the statute and the department say about each.",
    eyebrow: "Windstorm law",
    primaryKeyword: "windstorm inspection for roofers",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "Roofers inside the catastrophe area learn the windstorm program one bad week at a time: a crew held off a roof, a homeowner who cannot get coverage bound, a certificate that never comes. The rules behind each of those outcomes are written down, in section 2210.2515 of the Insurance Code and on the department's inspection process page, and they are worth reading before the tear off rather than after.",
      },
      { kind: "h2", text: "A re-roof is an improvement" },
      {
        kind: "p",
        text: "Section 2210.2515(a) defines an improvement as the construction of, or repair, alteration, remodeling, or enlargement of, a structure to which the plan of operation applies. Replacing a roof is a repair or an alteration. It sits inside the same certificate section as a new house, which is why [a coastal re-roof needs a certificate at all](/windstorm/re-roofs-and-repairs).",
      },
      { kind: "h2", text: "Before anyone climbs a ladder" },
      {
        kind: "p",
        text: "Subsection (b) requires written notice to the department, on its prescribed form, of the intent to repair or alter the structure before beginning. The department's process page identifies that form as WPI-1, the application for a certificate of compliance, and says it is submitted to notify the department before construction begins. The obligation is stated for the person seeking coverage, which is why an owner who assumes the roofer filed it and a roofer who assumes the owner did end up in the same place.",
      },
      {
        kind: "p",
        text: "The city permit is a separate track. Corpus Christi, Portland, and Rockport each run their own building department, and satisfying one of those does nothing for the windstorm program, or the other way around.",
      },
      { kind: "h2", text: "Who comes out, and when" },
      {
        kind: "p",
        text: "The department's page says a TDI inspector or an appointed Texas licensed professional engineer must inspect construction and repair work, and that TDI inspectors can inspect all non-structural work including most repairs, alterations, and re-roofs. Section 2210.254 says a windstorm inspection may be performed only by a qualified inspector who has been approved and appointed or employed by the department.",
      },
      {
        kind: "p",
        text: "Timing is the part crews feel. TDI inspectors try to conduct inspections within 48 hours of the requested date, excluding weekends and holidays, and all inspectors must see the work in progress, during the repair and not before or after it. On a roof, the deck attachment an inspector needs to see can be covered within the same day it is exposed. Requesting the inspection only once the shingles are on asks the inspector to certify something that is no longer visible.",
      },
      { kind: "h2", text: "When the inspector finds a problem" },
      {
        kind: "p",
        text: "If the work does not comply with the applicable construction requirements, the department's page says the TDI inspector will post a notice at the job describing the problems, and will return for a reinspection after they have been corrected. The notice is the list to work from. Correcting something that was not on it, or covering an item before the reinspection, restarts the argument rather than finishing it.",
      },
      { kind: "h2", text: "After the last inspection" },
      {
        kind: "p",
        text: "Where an appointed engineer inspected, the department's page says the engineer provides the WPI-1 and the WPI-2-BC-1 series forms upon final inspection, and that although the engineer should submit them to the department, they may also be mailed, faxed, or emailed.",
      },
      {
        kind: "p",
        text: "Then the clock in subsection (e) applies. The department may not issue the certificate for an ongoing improvement if, within six months after the date of the final inspection, it has not received fully completed forms and payment in full of all inspection fees owed to it, including fees for earlier inspections. A roof can pass and still never be certified because the paper behind it stopped moving.",
      },
      {
        kind: "p",
        text: "Once the certificate does issue, subsection (k) says the department may not rescind it. The full section is read through on [the certificate of compliance page](/insights/windstorm-certificate-of-compliance).",
      },
      { kind: "h2", text: "A roofer's list for a coastal job" },
      {
        kind: "ul",
        items: [
          "Confirm the WPI-1 has been submitted, and by whom, before the tear off.",
          "Know whether a TDI inspector or an appointed engineer will inspect this roof.",
          "Request the inspection for the day the deck and its attachment are exposed, allowing for the department's 48 hour target and for weekends.",
          "If a notice is posted, correct what it lists and keep it visible for reinspection.",
          "After final inspection, make sure the forms reach the department well inside six months.",
        ],
      },
    ],
    sources: [
      cite("ins2210_2515", "The definition of improvement, notice before work, the six month limit after final inspection, and the bar on rescinding a certificate."),
      cite("ins2210_254", "That a windstorm inspection may be performed only by a qualified inspector approved and appointed or employed by the department."),
      cite("tdiProcess", "Form WPI-1 before construction, who may inspect, re-roofs as non-structural work, the 48 hour target, that inspectors must see the work in progress, the posted notice and reinspection, and the forms an appointed engineer provides at final inspection."),
    ],
    faqs: [
      {
        q: "Does a TDI inspector or an engineer inspect a coastal re-roof?",
        a: "The department's inspection process page says TDI inspectors can inspect all non-structural work including most repairs, alterations, and re-roofs, and that a TDI inspector or an appointed Texas licensed professional engineer must inspect construction and repair work.",
      },
      {
        q: "What happens if a roof fails its windstorm inspection?",
        a: "According to the department, the TDI inspector posts a notice at the job describing the problems and returns for a reinspection after they are corrected.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 9
  {
    slug: "roof-certification-vs-wpi-8",
    title: "Roof Certification vs a WPI-8 Certificate | 254 Engineering",
    h1: "Roof certification vs a WPI-8 certificate when a coastal house is bound or sold",
    description:
      "A roof certification and a WPI-8 share a word and little else. See who issues each, what each proves, and why neither replaces the other at binding or sale.",
    summary:
      "On a coastal sale somebody asks for the roof certification, and somebody else hands over a WPI-8, and both think the question is answered. They are answers to two different questions.",
    eyebrow: "Windstorm law",
    primaryKeyword: "roof certification vs wpi-8",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "The word certification is doing too much work on the coast. It is used for a professional opinion about the condition of a roof, and it is used for the department's certificate of compliance for the work that put the roof there. An agent binding coverage and a title file being assembled can each end up holding the wrong one.",
      },
      { kind: "h2", text: "The roof certification: an opinion about condition" },
      {
        kind: "p",
        text: "A roof certification is a professional's written opinion about a roof as it stands: its condition, and often its remaining service life, for somebody who has to rely on it. When it is an engineer's, it carries a seal under section 1001.401 of the Occupations Code, and rule 137.33 makes the engineer fully responsible for what it states. What such an opinion properly rests on is set out on [the roof inspections page](/services/roof-inspections).",
      },
      {
        kind: "p",
        text: "No statute makes a roof certification a condition of association coverage. Its requirements are set by whoever asked for it, whether a lender, a buyer, or a carrier's own underwriting, and it answers their question and nobody else's.",
      },
      { kind: "h2", text: "The WPI-8: the department's certificate for the work" },
      {
        kind: "p",
        text: "A certificate of compliance is issued by the Texas Department of Insurance under section 2210.2515 of the Insurance Code for an improvement, which that section defines to include repair and alteration. A re-roof inside the catastrophe area is that kind of improvement. Section 2210.251(g) says the certificate is evidence of insurability of the structure by the association, section 2210.258(b) bars the association from insuring covered work until it has issued, and section 2210.2515(k) says the department may not rescind it once issued.",
      },
      {
        kind: "p",
        text: "It says the work complied when it was inspected. It says nothing about how that roof looks now, fifteen years and several storms later.",
      },
      { kind: "h2", text: "Why neither substitutes for the other" },
      {
        kind: "p",
        text: "A roof in excellent condition with no certificate for its installation is still work the association's statute says it may not insure without one, subject to that section's exceptions. A roof with a valid certificate from years ago may be in poor condition today, and the certificate is not a statement about that.",
      },
      {
        kind: "p",
        text: "One asks whether the work was inspected and found compliant. The other asks what state the roof is in. A coastal transaction usually needs to know both.",
      },
      { kind: "h2", text: "At binding" },
      {
        kind: "p",
        text: "For association coverage the question to settle first is the certificate, because the statute makes it the gate. Whether a certificate has issued for the roof's installation, or whether one of the exceptions in section 2210.258 applies, is covered on [the TWIA eligibility requirements page](/insights/twia-eligibility-requirements). A condition report, however favorable, does not open that gate.",
      },
      { kind: "h2", text: "At sale" },
      {
        kind: "p",
        text: "On a sale, the windstorm record for the structure is searchable, and the useful check is whether the certificates on file account for the roof actually on the house. A roof visibly newer than the house with nothing on file behind it is the classic finding, and [the coastal closing page](/windstorm/buying-and-selling) sets out how to look.",
      },
      {
        kind: "p",
        text: "On the Coastal Bend there is a wrinkle tied to dates. Hurricane Harvey came ashore near Rockport in 2017, and the department's completed construction page says the Texas Windstorm Insurance Association issued completed construction certificates, the WPI-8C, between January 1, 2017 and May 31, 2020. Those came from the association, not the department. A search of department records alone will not show one, and its absence there is not proof the roof was never certified.",
      },
    ],
    sources: [
      cite("ins2210_2515", "That an improvement includes repair and alteration, that the department issues the certificate, and that it may not be rescinded."),
      cite("ins2210_251", "That the certificate is evidence of insurability of the structure by the association."),
      cite("ins2210_258", "That the association may not insure covered work until a certificate of compliance has issued, subject to its exceptions."),
      cite("tdiCompleted", "That TWIA issued completed construction certificates, the WPI-8C, between January 1, 2017 and May 31, 2020."),
      cite("occ1001_401", "That an engineer's report for a Texas project carries the license holder's seal."),
      cite("rule137_33", "That on sealing, the engineer takes full professional responsibility for the work."),
    ],
    faqs: [
      {
        q: "Can a roof certification replace a WPI-8 for TWIA?",
        a: "No. Section 2210.258(b) bars the association from insuring covered work until a certificate of compliance has issued under section 2210.2515, subject to that section's exceptions. A roof certification is an opinion about condition, not that certificate.",
      },
      {
        q: "Does a WPI-8 mean the roof is in good condition?",
        a: "It records that the work was inspected and found compliant under the program. It is not a statement about the roof's condition later.",
      },
    ],
  },

  // ----------------------------------------------------------------------- 10
  {
    slug: "inspection-vs-forensic-report",
    title: "Inspection vs Forensic Report on the Coast | 254 Engineering",
    h1: "Inspection vs forensic report vs certificate, three different coastal documents",
    description:
      "After a coastal storm, an inspection, a certificate, and a forensic report answer different questions. See who produces each and what each can prove.",
    summary:
      "An adjuster, an agent, and an owner can all say inspection after a storm and mean three different documents. Each has a different author, a different question, and a different weight.",
    eyebrow: "Windstorm law",
    primaryKeyword: "inspection vs forensic report",
    datePublished: DATE,
    dateModified: DATE,
    body: [
      {
        kind: "p",
        text: "After wind reaches the Coastal Bend, the same few words get used for very different paper. The windstorm inspection, the certificate of compliance, and a forensic engineering report can all concern the same roof in the same month, and treating one as another leads to a repair nobody can insure or a conclusion nobody can defend.",
      },
      { kind: "h2", text: "The windstorm inspection: observation of work in progress" },
      {
        kind: "p",
        text: "Under the Insurance Code, a windstorm inspection may be performed only by a qualified inspector, and section 2210.254 requires that inspector to be approved and appointed or employed by the Texas Department of Insurance before inspecting. The department's process page says all inspectors must see the work in progress, during the construction or repair and not before or after it.",
      },
      {
        kind: "p",
        text: "Its question is narrow: does this work, as it is being done, comply with the applicable requirements? It is not an opinion about why a building failed, and it is not performed on a building nobody is working on.",
      },
      { kind: "h2", text: "The certificate: the department's record of compliance" },
      {
        kind: "p",
        text: "The certificate of compliance is issued by the department under section 2210.2515. Section 2210.251(g) says it demonstrates compliance with the applicable building code under the plan of operation and is evidence of insurability of the structure by the association, and section 2210.2515(k) says the department may not rescind it once issued. What it records, and what it leaves out, is set out on [the certificate of compliance page](/insights/windstorm-certificate-of-compliance).",
      },
      {
        kind: "p",
        text: "It is not an account of storm damage. A building can hold a certificate for its roof and still have lost that roof.",
      },
      { kind: "h2", text: "The forensic report: an engineer's opinion on cause" },
      {
        kind: "p",
        text: "A forensic engineering report asks a question neither of the others does: what happened to this building, and why. When a Texas professional engineer issues one for a Texas project, section 1001.401 of the Occupations Code requires the seal, and rule 137.33 states that on sealing the engineer takes full professional responsibility for the work. That responsibility does not change with who is paying for the report. The approach to investigation behind it is described on [the forensic engineering page](/services/forensic-engineering).",
      },
      {
        kind: "p",
        text: "A forensic report can be decisive evidence about cause and extent. It is not a windstorm certificate and it does not make later repair work certifiable.",
      },
      { kind: "h2", text: "How the three meet after a storm" },
      {
        kind: "p",
        text: "The sequence usually runs like this. The damage is assessed, and a forensic report may be commissioned to establish cause. The repair is then an improvement under section 2210.2515(a), which defines improvement to include repair, so subsection (b) requires written notice to the department before the repair begins. The repair is inspected while it is being done. The department issues a certificate for it.",
      },
      {
        kind: "p",
        text: "Skipping the notice because a forensic report already exists is the expensive mistake, and it is common after a large storm, when everyone wants the roof back on. A report on why the old roof failed is not notice of intent to build the new one. What the repair route requires of a roofer is on [the windstorm inspection for roofers page](/insights/windstorm-inspection-for-roofers).",
      },
      { kind: "h2", text: "Reading the three side by side" },
      {
        kind: "ul",
        items: [
          "Inspection: a qualified inspector approved and appointed or employed by the department, observing work in progress. It answers whether the work complies.",
          "Certificate: the Texas Department of Insurance. It records compliance and is evidence of insurability through the association.",
          "Forensic report: a licensed engineer, sealed. It answers what happened and why, and the engineer carries full professional responsibility for the conclusions.",
        ],
      },
      {
        kind: "note",
        title: "Hurricane Harvey as the local example",
        body: [
          "Harvey came ashore near Rockport in 2017. The department's completed construction page says the Texas Windstorm Insurance Association issued completed construction certificates, the WPI-8C, between January 1, 2017 and May 31, 2020, so a certificate for work certified that way in that window came from the association rather than the department. A forensic report written about Harvey damage in that period is a separate document again, and none of the three stands in for another.",
        ],
      },
    ],
    sources: [
      cite("ins2210_254", "That only a qualified inspector may perform a windstorm inspection, approved and appointed or employed by the department."),
      cite("ins2210_2515", "That the department issues the certificate, that a repair is an improvement requiring notice before work, and that a certificate may not be rescinded."),
      cite("ins2210_251", "That the certificate demonstrates compliance and is evidence of insurability by the association."),
      cite("tdiProcess", "That all inspectors must see the work in progress, during and not before or after the construction or repair."),
      cite("tdiCompleted", "That TWIA issued completed construction certificates, the WPI-8C, between January 1, 2017 and May 31, 2020."),
      cite("occ1001_401", "That a report issued for a Texas project carries the license holder's seal."),
      cite("rule137_33", "That on sealing, the engineer takes full professional responsibility for the work."),
    ],
    faqs: [
      {
        q: "Is a forensic engineering report the same as a windstorm inspection?",
        a: "No. A windstorm inspection is performed by a qualified inspector approved and appointed or employed by the department, on work in progress. A forensic report is an engineer's sealed opinion about what happened to a building and why.",
      },
      {
        q: "After storm damage, does a forensic report replace the WPI-1?",
        a: "No. A repair is an improvement under section 2210.2515(a), and subsection (b) requires written notice to the department before the repair begins, whatever reports already exist about the damage.",
      },
    ],
  },
];
