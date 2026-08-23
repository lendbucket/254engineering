import type { Faq } from "./services";

/**
 * The editorial corpus.
 *
 * WHY THIS SITE HAS ONE AT ALL
 * ----------------------------
 * The keyword registry gives this brand the institutional territory: firm level
 * terms, county geo, government and municipal content, careers. Almost none of
 * that is transactional, which means almost none of it converts on the page it
 * ranks on. It earns its place by being the most accurate document on the
 * internet for a question a procurement officer or a buyer actually asks, and by
 * carrying that reader into the capability pages from inside the prose.
 *
 * Every post here was selected in a research pass that is recorded in
 * docs/keyword-batch-phase-1.md, with the volume, the difficulty, and the reason
 * the current results are beatable. Three candidate topics were dropped in that
 * pass for having no measurable demand. The absence of those three is why this
 * file has four entries rather than eight.
 *
 * THE SOURCING RULE, WHICH IS NOT NEGOTIABLE
 * ------------------------------------------
 * Every technical claim in this file traces to a primary source listed in the
 * post's own `sources` array, and those sources render on the page. Where a
 * claim is widely repeated but could not be traced to a primary source, it is
 * named as unverifiable in a `note` block rather than repeated. That is the
 * playbook's rule and it is also the only reason a page like this outranks a
 * content mill: the mill cannot afford to say "we could not confirm this".
 *
 * A CONSTRAINT ON EVERY SENTENCE HERE
 * -----------------------------------
 * These posts are about engineering, sealing, and licensure while the firm's own
 * TBPELS registration is pending and no engineer of record has been hired. They
 * therefore describe what Texas law requires of a firm, in the third person, and
 * never state or imply that this firm is currently performing engineering work.
 * scripts/voice-audit.mjs enforces that mechanically against the patterns in
 * scripts/lib/regulatory.mjs. Post 2 addresses the firm's own pending status
 * directly, because a page about firm registration that stayed quiet about it
 * would be the least trustworthy page on the site.
 */

/**
 * A block of post body.
 *
 * Paragraph and list text may carry inline links in `[label](/path)` form. That
 * syntax exists rather than a `(string | LinkObject)[]` shape for one reason:
 * these posts are prose, they are edited as prose, and a paragraph split into an
 * array of fragments around its links stops being readable in the file where it
 * is written. See renderInline() in src/components/insights/Body.tsx, which is
 * the only thing that parses it.
 */
export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  /** A bordered aside. Used for the unverifiable-claim pattern, not for emphasis. */
  | { kind: "note"; title: string; body: string[] };

export type Source = {
  label: string;
  url: string;
  /** What this source is cited for. Rendered, so a reader can check one claim. */
  supports: string;
};

export type Insight = {
  slug: string;
  /** 50 to 60 characters including the brand suffix, keyword front loaded. */
  title: string;
  h1: string;
  /** 140 to 160 characters, carrying a call to action verb. */
  description: string;
  /** The card blurb on the hub. One or two sentences. */
  summary: string;
  eyebrow: string;
  /** The registry term this post owns. Cross checked by scripts/registry-audit.mjs. */
  primaryKeyword: string;
  /** Real dates. The sitemap emits lastModified only for these pages. */
  datePublished: string;
  dateModified: string;
  body: Block[];
  sources: Source[];
  faqs: Faq[];
};

export const insights: Insight[] = [
  // ------------------------------------------------------------------------ 1
  {
    slug: "texas-professional-services-procurement-act",
    title: "Texas Professional Services Procurement | 254 Engineering",
    h1: "The Texas Professional Services Procurement Act",
    description:
      "Texas Government Code 2254 bars competitive bidding for engineering and sets a two step selection. Read what the statute requires of a governmental entity.",
    summary:
      "Chapter 2254 of the Texas Government Code prohibits a governmental entity from buying engineering on price. What the statute says, in the order it says it, and what happens to a contract that ignores it.",
    eyebrow: "Government procurement",
    primaryKeyword: "texas professional services procurement act",
    datePublished: "2026-08-23",
    dateModified: "2026-08-23",
    body: [
      {
        kind: "p",
        text: "A Texas city cannot ask three engineering firms for a price and hire the cheapest one. That is not a matter of local policy or professional custom. It is prohibited by statute, and a contract awarded that way is void.",
      },
      {
        kind: "p",
        text: "The statute is Chapter 2254 of the Texas Government Code, titled Professional and Consulting Services and commonly called the Professional Services Procurement Act. It runs to four sections that matter for engineering work, and between them they decide how every county, municipality, school district, state agency, and publicly owned utility in Texas is permitted to select an engineer.",
      },
      {
        kind: "p",
        text: "Most writing about it either reproduces the statute without explaining it or explains one agency's internal procedure without citing the statute. What follows is the statute, in order, with what each section actually constrains.",
      },

      { kind: "h2", text: "Who the act binds" },
      {
        kind: "p",
        text: "Section 2254.002 defines a governmental entity broadly. It covers a state agency or department, a district, authority, county, municipality, or other political subdivision, a local government corporation or an entity created by or for a political subdivision for construction planning, and a publicly owned utility.",
      },
      {
        kind: "p",
        text: "The same section defines professional services by listing the practices it covers. Professional engineering is on that list, alongside accounting, architecture, landscape architecture, land surveying, medicine, optometry, real estate appraising, professional nursing, and forensic science. The services must be provided by a person licensed or registered in the named practice.",
      },
      {
        kind: "p",
        text: "That definition is the reason this statute reaches so much public construction work in Texas. Engineering, architecture, and land surveying are the three practices that touch nearly every capital project, and all three are inside it.",
      },

      { kind: "h2", text: "The prohibition on competitive bidding" },
      {
        kind: "p",
        text: "Section 2254.003 is the operative prohibition and it is short. A governmental entity may not select a provider of professional services on the basis of competitive bids. It shall make the selection on the basis of demonstrated competence and qualifications, and for a fair and reasonable price. Professional fees under the contract may not exceed any maximum provided by law.",
      },
      {
        kind: "p",
        text: "Read carefully, that section does two separate things. It forbids one selection method and it prescribes another. An entity that solicits qualifications and then quietly ranks the respondents by proposed fee has complied with the first half of the sentence and violated the second.",
      },

      { kind: "h2", text: "The two step, in the order the statute sets" },
      {
        kind: "p",
        text: "Section 2254.004 is where engineering, architecture, and land surveying get their own procedure. In procuring those services a governmental entity shall first select the most highly qualified provider on the basis of demonstrated competence and qualifications, and then attempt to negotiate a contract with that provider at a fair and reasonable price.",
      },
      {
        kind: "p",
        text: "The order is the whole mechanism. Qualifications are ranked before any fee is discussed, which is what the industry means by qualifications based selection. Price enters the process only once a single firm has been identified as the most qualified, and it enters as a negotiation with that firm rather than as a comparison across firms.",
      },
      {
        kind: "p",
        text: "Subsection (b) handles the case where that negotiation fails. The entity shall formally end negotiations with that provider, select the next most highly qualified provider, and attempt to negotiate with that one. Subsection (c) requires the entity to continue that process until a contract is entered into.",
      },
      {
        kind: "p",
        text: "The word formally in subsection (b) is doing real work. An entity may not keep a first choice warm while it sounds out a second, because the moment two firms are negotiating at once the process has become a price comparison, which is the thing section 2254.003 forbids.",
      },

      { kind: "h2", text: "What happens when the process is not followed" },
      {
        kind: "p",
        text: "Section 2254.005 states that a contract entered into or an arrangement made in violation of the subchapter is void as against public policy. It is one sentence and it carries the enforcement for the whole scheme.",
      },
      {
        kind: "p",
        text: "That is a stronger remedy than it first appears. Void is not voidable. A contract that is void as against public policy was never a contract, which means the ordinary expectations about performance and payment under it do not apply in the way the parties assumed. For a firm, the practical consequence is that a procurement irregularity on the buyer's side is not purely the buyer's problem.",
      },

      { kind: "h2", text: "What this changes for a firm responding" },
      {
        kind: "p",
        text: "A qualifications based process rewards a different document than a bid does. The entity is required to rank on demonstrated competence and qualifications, so the statement of qualifications is not a covering letter attached to a price. It is the entire basis on which the selection is legally permitted to be made.",
      },
      {
        kind: "p",
        text: "In practice that means the responsive material is the record: relevant project experience, the licensure and registration standing of the firm and the individuals who would perform the work, capacity against the schedule, and the geographic reach to serve the sites in question. This firm publishes its [government and public sector capability](/government) against exactly those headings, and its [coverage of all 254 Texas counties](/coverage) is organised by region because the reach question is usually the one a rural entity asks first.",
      },
      {
        kind: "p",
        text: "The registration question is worth separating out, because it is a threshold rather than a ranking factor. A business entity that is not registered with the state board may not lawfully practice engineering in Texas at all, which is a different kind of problem from being ranked second. What that registration is, and how to check one, is set out in [what a TBPELS firm registration means](/insights/texas-engineering-firm-registration).",
      },

      { kind: "h2", text: "On call contracts and the same statute" },
      {
        kind: "p",
        text: "Entities that need engineering intermittently often run a periodic solicitation and hold a bench of firms for task orders over a term. Nothing in Chapter 2254 exempts that arrangement. The selection of the firms onto the bench is itself a selection of a provider of professional services, so it is made on demonstrated competence and qualifications, and the fee for each task order is negotiated rather than bid.",
      },
      {
        kind: "p",
        text: "The failure mode is a bench selected properly and then used as a price list, with task orders steered to whichever firm on it quotes lowest. That converts a compliant selection into the prohibited one a step later.",
      },

      {
        kind: "note",
        title: "A claim we could not verify",
        body: [
          "It is widely repeated in industry material that qualifications based selection produces lower total project cost than price based selection, usually with a specific percentage attached. The figure traces back through trade association publications rather than to a Texas primary source, and we could not find it in any state audit, legislative analysis, or agency report.",
          "It may well be true. We have not cited it here because we could not check it, and a number a reader cannot follow to its source is worth less than the space it occupies.",
        ],
      },
      {
        kind: "p",
        text: "Chapter 2254 does not rest on that argument in any case. The legislature did not prohibit competitive bidding for engineering because it calculated a saving. It did so because the quality of a professional judgement is not a thing a purchaser can specify precisely enough to buy on price, which is a claim about the nature of the service rather than about its cost.",
      },
    ],
    sources: [
      {
        label: "Tex. Gov't Code § 2254.002, Definitions",
        url: "https://texas.public.law/statutes/tex._gov't_code_section_2254.002",
        supports: "Which entities are bound and which practices count as professional services.",
      },
      {
        label: "Tex. Gov't Code § 2254.003, Selection of Provider; Fees",
        url: "https://texas.public.law/statutes/tex._gov't_code_section_2254.003",
        supports: "The prohibition on competitive bidding and the demonstrated competence standard.",
      },
      {
        label: "Tex. Gov't Code § 2254.004, Contract for Professional Services of Architect, Engineer, or Surveyor",
        url: "https://texas.public.law/statutes/tex._gov't_code_section_2254.004",
        supports: "The two step selection and the procedure when negotiation fails.",
      },
      {
        label: "Tex. Gov't Code § 2254.005, Void Contract",
        url: "https://texas.public.law/statutes/tex._gov't_code_section_2254.005",
        supports: "That a contract made in violation of the subchapter is void as against public policy.",
      },
    ],
    faqs: [
      {
        q: "Can a Texas city ask for a fee proposal at the same time as qualifications?",
        a: "Section 2254.004 sets the order: the most highly qualified provider is selected first, and the fee is negotiated with that provider afterwards. A solicitation that collects fees alongside qualifications puts the entity in the position of holding price information while it ranks on qualifications, which is difficult to reconcile with section 2254.003. Practice varies, and an entity's own procurement counsel is the right authority on its own solicitation.",
      },
      {
        q: "Does the act apply to a small task order or only to large projects?",
        a: "Chapter 2254 sets no dollar threshold for architectural, engineering, or land surveying services. The obligation attaches to the nature of the service rather than to the size of the contract.",
      },
      {
        q: "What is the difference between this and the federal Brooks Act?",
        a: "They are separate laws with the same underlying method. Chapter 2254 governs Texas governmental entities. The federal statute commonly called the Brooks Act governs federal agency procurement of these services. A locally administered project using federal funds can be subject to requirements from both, and which controls is a question for the entity's counsel rather than for its engineer.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 2
  {
    slug: "texas-engineering-firm-registration",
    title: "Texas Engineering Firm Registration | 254 Engineering",
    h1: "What a Texas engineering firm registration is",
    description:
      "A Texas business may not practice or advertise engineering unless the firm is registered with TBPELS. See what the registration covers and how to check one.",
    summary:
      "In Texas the individual licence is only half of it. The business entity has to be registered too, and the statute restricts what an unregistered company may call itself.",
    eyebrow: "Licensure",
    primaryKeyword: "texas engineering firm registration",
    datePublished: "2026-08-23",
    dateModified: "2026-08-23",
    body: [
      {
        kind: "p",
        text: "Texas licenses two different things. It licenses people to practice engineering, and it separately registers the business entities through which engineering is practised. A company whose every employee holds a Texas engineering licence is still prohibited from practising engineering in Texas if the company itself is not registered.",
      },
      {
        kind: "p",
        text: "That second requirement is the one buyers most often miss, and it is also the one with the sharpest teeth, because it restricts what an unregistered business is permitted to call itself.",
      },

      { kind: "h2", text: "The statute" },
      {
        kind: "p",
        text: "Section 1001.405 of the Texas Occupations Code is titled Practice by Business Entity; Registration. Subsection (a) defines business entity to include a sole proprietorship, firm, partnership, corporation, or joint stock association, which is broad enough that the size of the company is not a factor.",
      },
      {
        kind: "p",
        text: "Subsection (b) sets the requirement in two parts. A business entity may not engage in the practice of engineering in this state unless the entity is registered with the board, and unless the practice is carried on only by engineers. Both halves have to hold.",
      },
      {
        kind: "p",
        text: "Subsection (d) makes the registration annual. It expires on the first anniversary of the date it was issued, and it is renewed by filing an updated application. A registration is therefore a statement about the present year rather than a permanent credential, which matters when a buyer is checking one.",
      },

      { kind: "h2", text: "The subsection that governs what a firm may call itself" },
      {
        kind: "p",
        text: "Subsection (e) is the longest part of the section and the part with the widest practical effect. It prohibits a business entity from representing to the public that it is engaged in the practice of engineering under any business name, and from using the terms engineer, engineering, engineering services, engineering company, professional engineers, licensed engineer, registered engineer, licensed professional engineer, registered professional engineer, or engineered.",
      },
      {
        kind: "p",
        text: "The prohibition reaches any abbreviation or variation of those terms, used directly or indirectly, and it lists the surfaces it applies to: a sign, directory, listing, contract, document, pamphlet, stationery, advertisement, signature, or business name.",
      },
      {
        kind: "p",
        text: "Three conditions lift it. The entity must be registered under the section. It must be actively engaged in the practice of engineering. And each service, work, or act it performs that forms part of the practice of engineering must be either personally performed by an engineer, or directly supervised by an engineer who is a regular full time employee of the entity.",
      },
      {
        kind: "p",
        text: "That third condition is stricter than it looks. Direct supervision by a contractor or a part time consultant does not satisfy it. The statute names a regular full time employee.",
      },
      {
        kind: "p",
        text: "Section 1001.301 sits alongside it and does the same job for individuals. A person may not engage in the practice of engineering without a licence, may not use the protected titles, and may not use any abbreviation, word, symbol, slogan, or sign that tends or is likely to create an impression with the public that they are qualified to practise. Subsection (e) of that section provides that a person or entity that offers or attempts to engage in the described conduct is conclusively presumed to be engaged in the practice of engineering.",
      },

      { kind: "h2", text: "Why this site is written the way it is" },
      {
        kind: "p",
        text: "This firm's registration with the Texas Board of Professional Engineers and Land Surveyors is pending, and no engineer of record has been appointed. Under section 1001.405(e) that is not a formality to be worked around with careful phrasing while the paperwork clears.",
      },
      {
        kind: "p",
        text: "So the service pages on this site describe what each document is, what standard governs it, and who ordinarily needs one. They do not say that the firm is performing that work, because the statute reserves that representation for a registered entity that is actively engaged in the practice with a full time licensed engineer supervising it. The whole gate is one function in the codebase and one environment variable, and it moves when the board issues the registration and not before.",
      },
      {
        kind: "p",
        text: "A reader is entitled to weigh that. It is stated on [the page about this firm](/about) as well, and the position is the same in both places: the capability is described, the present tense claim is not made, and the registration number will appear on the site when the board issues one rather than in advance of it.",
      },

      { kind: "h2", text: "How to check a firm registration" },
      {
        kind: "p",
        text: "The board publishes a searchable engineering firm roster and a separate roster for individual licensees, and it also publishes downloadable files of both that are updated daily. The firm search is the one that answers the section 1001.405 question, and it is a different search from the one that answers whether a named individual holds a licence.",
      },
      {
        kind: "p",
        text: "Both checks are worth doing, because they fail independently. A registered firm can employ someone who is not licensed, and a licensed individual can be working through a company that has let its registration lapse. The mechanics of the individual search, including what the roster stopped publishing in 2023, are covered in [how to look up a Texas PE licence](/insights/texas-pe-license-lookup).",
      },
      {
        kind: "ul",
        items: [
          "Search the firm roster for the legal entity name on the contract, not the trading name on the letterhead. They are frequently different.",
          "Check the expiry, because the registration runs for one year from issue and is renewed annually.",
          "Search the engineer roster separately for the individual who would seal the work.",
          "Ask which named licensee would be in responsible charge of your project, which is the question the rosters cannot answer.",
        ],
      },

      {
        kind: "note",
        title: "On the registration fee",
        body: [
          "The board's own firm registration page states an initial registration fee of 25 dollars for sole proprietorships and 150 dollars for all other entities. Fees are set by board rule and change, so the board's page is the authority rather than this one, and any figure quoted second hand should be checked against it before it is relied on.",
        ],
      },

      { kind: "h2", text: "What a registration does not tell you" },
      {
        kind: "p",
        text: "Registration is a threshold, not a ranking. It establishes that an entity is permitted to practise and to describe itself as an engineering firm. It says nothing about whether the firm has done work resembling yours, whether the individual who would seal your document practises in the relevant discipline, or whether anyone there has stood on a roof in the county your property is in.",
      },
      {
        kind: "p",
        text: "For public sector buyers, that distinction maps onto the statute governing the purchase: registration is the eligibility question, and demonstrated competence is the selection question that [the Professional Services Procurement Act](/insights/texas-professional-services-procurement-act) requires an entity to rank on.",
      },
    ],
    sources: [
      {
        label: "Tex. Occ. Code § 1001.405, Practice by Business Entity; Registration",
        url: "https://texas.public.law/statutes/tex._occ._code_section_1001.405",
        supports: "The registration requirement, the annual expiry, and the restriction on business naming and advertising.",
      },
      {
        label: "Tex. Occ. Code § 1001.301, License Required",
        url: "https://texas.public.law/statutes/tex._occ._code_section_1001.301",
        supports: "The individual licence requirement and the conclusive presumption in subsection (e).",
      },
      {
        label: "TBPELS, Engineering Firm Registration",
        url: "https://pels.texas.gov/firms.htm",
        supports: "Who must register, the entity types covered, and the stated initial registration fees.",
      },
      {
        label: "TBPELS, engineer and firm rosters",
        url: "https://pels.texas.gov/roster/eng_rosters.html",
        supports: "That searchable rosters exist for both licensees and firms, with daily downloadable files.",
      },
    ],
    faqs: [
      {
        q: "Does a sole practitioner have to register the business as well as hold a licence?",
        a: "Section 1001.405(a) includes a sole proprietorship in the definition of business entity, so the registration requirement reaches a one person practice. The board's firm registration page states a separate, lower initial fee for sole proprietorships, which reflects that they are inside the scheme rather than outside it.",
      },
      {
        q: "Can an out of state firm practise engineering in Texas?",
        a: "The registration requirement in section 1001.405(b) is written about the practice of engineering in this state rather than about where the entity is organised, and the individual licence requirement in section 1001.301 applies to the person doing the work. Both have to be satisfied. The board is the authority on how it treats a particular out of state entity.",
      },
      {
        q: "What happens to a firm that practises before it is registered?",
        a: "Subsection (g) allows the board to provide by rule that a previously unregistered entity is not subject to disciplinary action if it registers within 30 days of written notice from the board. That grace does not extend to an entity whose registration has expired.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 3
  {
    slug: "engineer-of-record-texas",
    title: "Engineer of Record in Texas Explained | 254 Engineering",
    h1: "The engineer of record in Texas, and what actually governs it",
    description:
      "Engineer of record is not a defined term in Texas law. See what the Occupations Code and the board rules actually say about seals and responsible charge.",
    summary:
      "The phrase is used constantly on Texas projects and appears nowhere in the statute or the board rules. What Texas actually regulates is the seal, and the concept behind it is responsible charge.",
    eyebrow: "Licensure",
    primaryKeyword: "engineer of record texas",
    datePublished: "2026-08-23",
    dateModified: "2026-08-23",
    body: [
      {
        kind: "p",
        text: "Ask who the engineer of record is on a Texas project and everyone in the room will understand the question. Then look for the term in the Texas Engineering Practice Act or in the board's rules and it is not there.",
      },
      {
        kind: "p",
        text: "That is not a technicality. The industry phrase and the regulated concept do not map onto each other exactly, and the gap between them is where most of the confusion about responsibility on a Texas project lives.",
      },

      { kind: "h2", text: "What Texas actually defines" },
      {
        kind: "p",
        text: "Rule 131.2 of the board's rules, in Title 22 Part 6 of the Texas Administrative Code, is the definitions rule. It defines direct supervision as the control over and detailed professional knowledge of the work prepared under the engineer's supervision. It then defines responsible charge as synonymous with direct supervision, and the two terms are used interchangeably.",
      },
      {
        kind: "p",
        text: "Engineer of record is not among the defined terms. What Texas regulates instead is the seal, and responsible charge is the standard that governs when a licensee may apply one.",
      },

      { kind: "h2", text: "The seal is the mechanism" },
      {
        kind: "p",
        text: "Section 1001.401 of the Occupations Code requires that a plan, specification, plat, or report issued by a license holder for a project to be constructed or used in this state include the license holder's seal on the document. The section also prohibits use of a seal where the licence has expired, been suspended, or been revoked.",
      },
      {
        kind: "p",
        text: "Rule 137.33 sets out what the seal means. Its stated purpose is to assure the user of the engineering product that the work has been performed or directly supervised by the professional engineer named, and to delineate the scope of that engineer's work. A licensee may seal only work done by them, work performed under their direct supervision, or standards and general guideline specifications they have reviewed and selected. On sealing, the engineer takes full professional responsibility for that work.",
      },
      {
        kind: "p",
        text: "Read those two clauses together and the answer to the question everyone is really asking appears. In Texas, the engineer of record on a document is the licensee whose seal is on it, and the extent of that responsibility is the scope the seal delineates.",
      },

      { kind: "h2", text: "More than one engineer on one project" },
      {
        kind: "p",
        text: "Rule 137.33 addresses the common case directly. Work performed by more than one license holder is to be sealed in a manner such that all engineering can be clearly attributed to the responsible license holder or holders. Where two or more licensees have worked on a plan or document, the seal and signature of each is placed on it, with a notation describing the work done under each licensee's responsible charge.",
      },
      {
        kind: "p",
        text: "So a Texas project does not necessarily have one engineer of record. It has a set of seals, each carrying a stated scope, and the responsibility follows the scope rather than the project.",
      },
      {
        kind: "p",
        text: "The rule also handles the case of a second engineer altering an earlier engineer's work. The second licensee is required to give written notification of the engagement immediately on accepting it, and becomes responsible for the alterations and for their consequences.",
      },

      { kind: "h2", text: "What responsible charge requires in practice" },
      {
        kind: "p",
        text: "The definition sets two elements and both are demanding. Control over the work, and detailed professional knowledge of it. Neither is satisfied by a licensee who received a finished document and formed a general impression that it looked reasonable.",
      },
      {
        kind: "p",
        text: "This is the reason a properly run field inspection service separates the two roles rather than blurring them. A technician documents conditions and produces a photographic record keyed to locations. The licensee forms the opinion. The separation is what allows the licensee to have detailed professional knowledge of the evidence rather than of a conclusion someone else reached, and it is the arrangement described on [this firm's structural letters page](/services/structural-letters) and across the rest of the [service lines](/services).",
      },
      {
        kind: "p",
        text: "It is also why the firm treats the appointment of a licensed engineer in responsible charge as a gate rather than a hire. The position and its current status are set out on [the page about the firm](/about).",
      },

      { kind: "h2", text: "Questions worth asking on a real project" },
      {
        kind: "ul",
        items: [
          "Whose seal will be on the document, and what scope will the notation beside it state?",
          "If more than one licensee is sealing, which scope belongs to which seal?",
          "Is the sealing engineer in responsible charge as rule 131.2 defines it, meaning control over the work and detailed knowledge of it, rather than a reviewer of a finished product?",
          "If an earlier engineer's work is being altered, has that engineer been notified in writing as rule 137.33 requires?",
        ],
      },

      {
        kind: "note",
        title: "Where the phrase does have force",
        body: [
          "Engineer of record is absent from the Texas definitions rule, but it appears constantly in contracts, in municipal design manuals, and in the submittal requirements of authorities having jurisdiction. In those documents it is a defined term because the document defines it, and what it means is whatever that document says it means.",
          "The practical consequence is that the phrase is a contract question rather than a licensure question. When it appears in a scope of work, the definition that governs is the one in that scope of work, and it should be read rather than assumed.",
        ],
      },
    ],
    sources: [
      {
        label: "22 Tex. Admin. Code § 131.2, Definitions",
        url: "http://txrules.elaws.us/rule/title22_chapter131_sec.131.2",
        supports: "The definitions of direct supervision and responsible charge, and the absence of any definition of engineer of record.",
      },
      {
        label: "22 Tex. Admin. Code § 137.33, Sealing Procedures",
        url: "http://txrules.elaws.us/rule/title22_chapter137_sec.137.33",
        supports: "The stated purpose of the seal, the limits on what may be sealed, the treatment of multiple licensees, and the notification duty on altering another engineer's work.",
      },
      {
        label: "Tex. Occ. Code § 1001.401, Use of Seal",
        url: "https://texas.public.law/statutes/tex._occ._code_section_1001.401",
        supports: "The requirement that a plan, specification, plat, or report for a Texas project carry the license holder's seal.",
      },
      {
        label: "TBPELS, Acts and Rules",
        url: "https://pels.texas.gov/downloads/lawrules.pdf",
        supports: "The board's consolidated statute and rule text, which is the authority if a citation here has since been amended.",
      },
    ],
    faqs: [
      {
        q: "Is the engineer of record the same as the engineer in responsible charge?",
        a: "They usually refer to the same person and they are not the same kind of term. Responsible charge is defined in rule 131.2 and is the licensure standard that governs sealing. Engineer of record is an industry and contract phrase that Texas rules do not define. On most projects the licensee in responsible charge for a given scope is the person a contract would call the engineer of record for it.",
      },
      {
        q: "Can an engineer seal work prepared by someone else?",
        a: "Only where it was performed under their direct supervision as rule 131.2 defines it, or where it consists of standards or general guideline specifications they have reviewed and selected. Rule 137.33 states that on sealing the engineer takes full professional responsibility for the work.",
      },
      {
        q: "Does every engineering document in Texas need a seal?",
        a: "Section 1001.401 requires the seal on a plan, specification, plat, or report issued by a license holder for a project to be constructed or used in Texas. It also states that a seal is not needed for projects in other states or countries, or for projects exempt under the relevant subchapter. Whether a particular exemption applies is a question for the licensee and the authority having jurisdiction.",
      },
    ],
  },

  // ------------------------------------------------------------------------ 4
  {
    slug: "texas-pe-license-lookup",
    title: "Texas PE License Lookup and Verification | 254 Engineering",
    h1: "How to look up a Texas PE licence, and what the roster leaves out",
    description:
      "The TBPELS roster and an official verification are two different things. See which one answers your question, and what the roster stopped publishing in 2023.",
    summary:
      "The board publishes a searchable roster and, separately, issues official verifications between licensing boards. They answer different questions and are frequently confused.",
    eyebrow: "Licensure",
    primaryKeyword: "texas pe license lookup",
    datePublished: "2026-08-23",
    dateModified: "2026-08-23",
    body: [
      {
        kind: "p",
        text: "Most people who need to check a Texas Professional Engineer are doing one of two very different things. They are confirming that the person about to seal a document holds a current licence, or they are moving a licence between states and need the board to certify its standing to another board. Texas serves those two needs through separate systems, and using the wrong one is the usual reason a check takes a month.",
      },

      { kind: "h2", text: "The roster answers the first question" },
      {
        kind: "p",
        text: "The Texas Board of Professional Engineers and Land Surveyors publishes searchable rosters at pels.texas.gov. There is a roster of engineering licensees and certificates, and a separate roster of registered engineering firms. The board also publishes downloadable files of the PE, engineer in training, and engineering firm rosters, updated daily.",
      },
      {
        kind: "p",
        text: "It is free, it is immediate, and it is the right tool for confirming that a named individual currently holds a Texas licence. It is also the tool most people mean when they search for a Texas PE licence lookup.",
      },

      { kind: "h2", text: "What the roster stopped publishing in 2023" },
      {
        kind: "p",
        text: "The board's roster page records a change that catches people who used the roster before it. In compliance with Senate Bill 510, from 1 September 2023 the mailing addresses and phone numbers of individual professional engineer licensees and engineers in training were removed from the published roster. Email addresses are excluded as well.",
      },
      {
        kind: "p",
        text: "The consequence is narrow but real. The roster is now a licensure status tool and no longer a directory. Contact details for a licensee have to come from the licensee, from the firm that employs them, or from a source other than the board.",
      },

      { kind: "h2", text: "Verification is a different service" },
      {
        kind: "p",
        text: "An official verification is a document the board issues about a licensee's standing, and it is generally sent from one licensing board to another rather than to the licensee or to a member of the public. Texas routes most of these through NCEES, the National Council of Examiners for Engineering and Surveying, and licensees request them through a MyNCEES account. Where the receiving state does not use NCEES, the board accepts requests by mail or email on its own forms.",
      },
      {
        kind: "p",
        text: "Two details from the board's own verification page are worth knowing before starting. Texas does not charge for verification requests, although some other state boards do. And the board states a normal processing time of up to 30 business days from receipt, that verifications are processed in order of receipt, and that it does not offer expediting.",
      },
      {
        kind: "p",
        text: "Thirty business days is roughly six calendar weeks. Anyone planning a multi state licensure move around a project schedule should treat that as the governing constraint rather than an outer bound.",
      },

      { kind: "h2", text: "Check the firm as well as the person" },
      {
        kind: "p",
        text: "A licence check on an individual is only half of the question a buyer usually has. Texas separately requires the business entity practising engineering to be registered, and it restricts what an unregistered company may call itself. Those two checks fail independently, so passing one says nothing about the other.",
      },
      {
        kind: "p",
        text: "The firm roster is on the same site as the engineer roster. What the registration means, why it is annual, and which statute restricts an unregistered company's use of the word engineering are covered in [what a Texas engineering firm registration is](/insights/texas-engineering-firm-registration).",
      },
      {
        kind: "p",
        text: "Neither roster answers the question that matters most on a specific document, which is who will be in responsible charge of it and what scope their seal will cover. That is a question for the firm, and the standard behind it is set out in [the engineer of record in Texas](/insights/engineer-of-record-texas).",
      },

      {
        kind: "note",
        title: "A widely repeated claim we could not confirm",
        body: [
          "Several third party guides state that once a Texas PE licence has been expired for two or more years it becomes non renewable and is removed from the published roster, so a search for a long lapsed licensee returns nothing rather than an expired record.",
          "We could not trace that to a board page or to a rule citation. It is plausible and it may be correct. It is recorded here as unconfirmed rather than repeated as fact, because the difference between a licence that never existed and one that lapsed in 2019 matters a great deal to somebody checking, and a reader should know that a blank result may not distinguish between them.",
          "The board is the authority. Where a search returns nothing and the answer matters, ask the board directly rather than inferring from the absence.",
        ],
      },

      { kind: "h2", text: "A short checklist" },
      {
        kind: "ul",
        items: [
          "Use the engineer roster to confirm a named individual holds a current Texas licence. It is free and immediate.",
          "Use the firm roster separately to confirm the business entity is registered, searching the legal entity name rather than the trading name.",
          "Expect no contact details from the roster for individual licensees. Senate Bill 510 removed them in September 2023.",
          "Use an official verification only for board to board purposes, and allow up to 30 business days, because the board does not expedite.",
          "Where a search returns nothing and the answer matters, ask the board rather than reading the blank as an answer.",
        ],
      },
      {
        kind: "p",
        text: "For a public entity, these checks sit ahead of the selection rather than inside it. Eligibility is established first, and the ranking that follows is governed by [the Professional Services Procurement Act](/insights/texas-professional-services-procurement-act).",
      },
    ],
    sources: [
      {
        label: "TBPELS, engineer and firm rosters",
        url: "https://pels.texas.gov/roster/eng_rosters.html",
        supports: "The searchable rosters, the daily downloadable files, and the Senate Bill 510 removal of addresses and phone numbers from 1 September 2023.",
      },
      {
        label: "TBPELS, License Verification",
        url: "https://pels.texas.gov/verification.html",
        supports: "That verifications route through NCEES, that Texas does not charge for them, and the stated 30 business day processing time with no expediting.",
      },
      {
        label: "TBPELS, Engineering Firm Registration",
        url: "https://pels.texas.gov/firms.htm",
        supports: "That firm registration is a separate requirement from individual licensure.",
      },
      {
        label: "Tex. Occ. Code § 1001.405, Practice by Business Entity; Registration",
        url: "https://texas.public.law/statutes/tex._occ._code_section_1001.405",
        supports: "The statutory basis for checking the entity as well as the individual.",
      },
    ],
    faqs: [
      {
        q: "Is the TBPELS roster free to search?",
        a: "Yes. The board publishes searchable rosters of engineering licensees and of registered engineering firms on its own site, along with downloadable files updated daily. No account is needed.",
      },
      {
        q: "Why can I not find a licensee's phone number on the roster any more?",
        a: "The board removed mailing addresses and phone numbers for individual professional engineer licensees and engineers in training from the published roster on 1 September 2023, in compliance with Senate Bill 510. Email addresses are excluded as well. The roster remains a licensure status tool.",
      },
      {
        q: "How long does an official Texas licence verification take?",
        a: "The board states a normal processing time of up to 30 business days from the date the request is received, that requests are processed in order of receipt, and that it does not offer expediting. That is roughly six calendar weeks and should be planned for rather than worked around.",
      },
    ],
  },
];

export function insightBySlug(slug: string): Insight | undefined {
  return insights.find((i) => i.slug === slug);
}

/** Newest first, for the hub. Dates are real and set by hand in this file. */
export function insightsByDate(): Insight[] {
  return [...insights].sort((a, b) => b.datePublished.localeCompare(a.datePublished));
}
