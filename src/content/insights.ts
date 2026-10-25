import type { Faq } from "./services";
import { coastalInsights } from "./insights-coastal";
import { roofInsights } from "./insights-roofs";
import { topics } from "@data/keyword-registry";
import { registrationStatement } from "@/lib/launch";
import type { FigureId } from "@/components/insights/figures";

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
  | { kind: "note"; title: string; body: string[] }
  /**
   * A diagram, by id. The markup lives in src/components/insights/figures.tsx
   * so this file stays a .ts data module: the moment prose data can hold JSX it
   * stops being reviewable as writing. A wrong id is a type error there.
   */
  | { kind: "figure"; id: FigureId };

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
      { kind: "figure", id: "qbs-compliant-versus-not" },

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
      { kind: "figure", id: "qbs-sequence" },

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
      "In Texas the individual license is only half of it. The business entity has to be registered too, and the statute restricts what an unregistered company may call itself.",
    eyebrow: "Licensure",
    primaryKeyword: "texas engineering firm registration",
    datePublished: "2026-08-23",
    dateModified: "2026-08-23",
    body: [
      {
        kind: "p",
        text: "Texas licenses two different things. It licenses people to practice engineering, and it separately registers the business entities through which engineering is practised. A company whose every employee holds a Texas engineering license is still prohibited from practising engineering in Texas if the company itself is not registered.",
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
        text: "Section 1001.301 sits alongside it and does the same job for individuals. A person may not engage in the practice of engineering without a license, may not use the protected titles, and may not use any abbreviation, word, symbol, slogan, or sign that tends or is likely to create an impression with the public that they are qualified to practice. Subsection (e) of that section provides that a person or entity that offers or attempts to engage in the described conduct is conclusively presumed to be engaged in the practice of engineering.",
      },

      { kind: "h2", text: "Why this site is written the way it is" },
      {
        kind: "p",
        text: [
          registrationStatement(),
          /* "No engineer of record has been appointed" came out: false since the engineer was recorded, and removed on the operator's ruling of 2026-10-21. */
          "Under section 1001.405(e) a registration alone is not the whole of what the statute asks: it reserves the representation for an entity actively engaged in the practice, with a full time licensed engineer supervising it.",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        kind: "p",
        text: "So the service pages on this site describe what each document is, what standard governs it, and who ordinarily needs one. They do not say that the firm is performing that work, because the statute reserves that representation for a registered entity that is actively engaged in the practice with a full time licensed engineer supervising it. The gate is one function in the codebase, and it does not open on a registration alone: every condition it names, including an engineer in responsible charge, has to be stated true first.",
      },
      {
        kind: "p",
        text: "A reader is entitled to weigh that. It is stated on [the page about this firm](/about) as well, and the position is the same in both places: the capability is described, the present tense claim is not made, and the registration number the board issued appears in the footer of every page beside the name it was issued to.",
      },

      { kind: "h2", text: "How to check a firm registration" },
      {
        kind: "p",
        text: "The board publishes a searchable engineering firm roster and a separate roster for individual licensees, and it also publishes downloadable files of both that are updated daily. The firm search is the one that answers the section 1001.405 question, and it is a different search from the one that answers whether a named individual holds a license.",
      },
      {
        kind: "p",
        text: "Both checks are worth doing, because they fail independently. A registered firm can employ someone who is not licensed, and a licensed individual can be working through a company that has let its registration lapse. The mechanics of the individual search, including what the roster stopped publishing in 2023, are covered in [how to look up a Texas PE license](/insights/texas-pe-license-lookup).",
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
        text: "Registration is a threshold, not a ranking. It establishes that an entity is permitted to practice and to describe itself as an engineering firm. It says nothing about whether the firm has done work resembling yours, whether the individual who would seal your document practises in the relevant discipline, or whether anyone there has stood on a roof in the county your property is in.",
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
        supports: "The individual license requirement and the conclusive presumption in subsection (e).",
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
        q: "Does a sole practitioner have to register the business as well as hold a license?",
        a: "Section 1001.405(a) includes a sole proprietorship in the definition of business entity, so the registration requirement reaches a one person practice. The board's firm registration page states a separate, lower initial fee for sole proprietorships, which reflects that they are inside the scheme rather than outside it.",
      },
      {
        q: "Can an out of state firm practice engineering in Texas?",
        a: "The registration requirement in section 1001.405(b) is written about the practice of engineering in this state rather than about where the entity is organised, and the individual license requirement in section 1001.301 applies to the person doing the work. Both have to be satisfied. The board is the authority on how it treats a particular out of state entity.",
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
        text: "Section 1001.401 of the Occupations Code requires that a plan, specification, plat, or report issued by a license holder for a project to be constructed or used in this state include the license holder's seal on the document. The section also prohibits use of a seal where the license has expired, been suspended, or been revoked.",
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
      { kind: "figure", id: "seal-scope" },
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
      { kind: "figure", id: "evidence-chain" },
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
    h1: "How to look up a Texas PE license, and what the roster leaves out",
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
        text: "Most people who need to check a Texas Professional Engineer are doing one of two very different things. They are confirming that the person about to seal a document holds a current license, or they are moving a license between states and need the board to certify its standing to another board. Texas serves those two needs through separate systems, and using the wrong one is the usual reason a check takes a month.",
      },

      { kind: "h2", text: "The roster answers the first question" },
      {
        kind: "p",
        text: "The Texas Board of Professional Engineers and Land Surveyors publishes searchable rosters at pels.texas.gov. There is a roster of engineering licensees and certificates, and a separate roster of registered engineering firms. The board also publishes downloadable files of the PE, engineer in training, and engineering firm rosters, updated daily.",
      },
      {
        kind: "p",
        text: "It is free, it is immediate, and it is the right tool for confirming that a named individual currently holds a Texas license. It is also the tool most people mean when they search for a Texas PE license lookup.",
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
        text: "A license check on an individual is only half of the question a buyer usually has. Texas separately requires the business entity practising engineering to be registered, and it restricts what an unregistered company may call itself. Those two checks fail independently, so passing one says nothing about the other.",
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
          "Several third party guides state that once a Texas PE license has been expired for two or more years it becomes non renewable and is removed from the published roster, so a search for a long lapsed licensee returns nothing rather than an expired record.",
          "We could not trace that to a board page or to a rule citation. It is plausible and it may be correct. It is recorded here as unconfirmed rather than repeated as fact, because the difference between a license that never existed and one that lapsed in 2019 matters a great deal to somebody checking, and a reader should know that a blank result may not distinguish between them.",
          "The board is the authority. Where a search returns nothing and the answer matters, ask the board directly rather than inferring from the absence.",
        ],
      },

      { kind: "h2", text: "A short checklist" },
      {
        kind: "ul",
        items: [
          "Use the engineer roster to confirm a named individual holds a current Texas license. It is free and immediate.",
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
        q: "How long does an official Texas license verification take?",
        a: "The board states a normal processing time of up to 30 business days from the date the request is received, that requests are processed in order of receipt, and that it does not offer expediting. That is roughly six calendar weeks and should be planned for rather than worked around.",
      },
    ],
  },
];

/*
 * The coastal windstorm posts, 2026-09-15, in their own module so this file
 * stays readable. Spread in rather than exported separately, so the sitemap,
 * the hub and every audit that reads `insights` see them without being told.
 */
insights.push(...coastalInsights);

/*
 * ===========================================================================
 * THE BUYERS, AGENTS AND LENDERS SECTION. Written 2026-10-16.
 * ===========================================================================
 *
 * Keyword research is the operator's Ahrefs pull (US), supplied with the
 * brief; no Ahrefs call was made in the writing session. The plan, the
 * cannibalization check and the internal link plan are in
 * docs/blog/buyers-section-plan.md.
 *
 * THREE OF THE TEN BRIEFED POSTS ARE FOLDED, NOT WRITTEN.
 *   "structural engineer home inspection" is already a supporting term of
 *     /structural-engineer/inspection, which owns "structural engineer
 *     inspection" (src/content/structural-engineer.ts, 2026-09-18).
 *   "structural engineer inspection cost" is a target term of
 *     /structural-engineer/cost, which renders the price book.
 *   "foundation inspection" was ruled to /services/foundation-inspections in
 *     docs/keyword-mapping.md: "retarget, do not build a competitor".
 * Their supporting terms are listed in the plan for later edits of those pages.
 *
 * SOURCES, ALL READ 2026-10-16
 * ----------------------------
 *   22 Tex. Admin. Code 535.227 and 535.228, the TREC standards of practice
 *   TREC, rule notice for 535.228 adopted August 10, 2026 (walk the roof)
 *   TREC, guidance on rendering an opinion of foundation performance
 *   TREC, Property Inspection Report form REI 7-6
 *   TREC form 20-18 and 22 Tex. Admin. Code 537.28 (the resale contract)
 *   Tex. Prop. Code 5.008, the seller's disclosure notice
 *   Fannie Mae Selling Guide B4-1.3-06 (settlement and a professional report)
 *   ASCE Texas Section, Guidelines for the Evaluation and Repair of
 *     Residential Foundations, Version 3, adopted 2022
 *   Tex. Occ. Code 1001.003, 1001.301, 1001.401; 22 Tex. Admin. Code 137.33,
 *     137.57, 137.59; TBPELS response on foundation repair methods, 2018
 *   USDA soil fact sheet on Houston Black (hosted by TWDB); TDLR technical
 *     bulletin IHB TB 10-01 on IRC R403.1.8; Tex. Loc. Gov't Code 214.212
 *   NRMCA CIP 4; ACI 224.1R-07; PTI position statement on DC10.5;
 *     STRUCTURE magazine, Post-Tensioned Slabs on Ground, Part 4 (2010)
 *   City of Houston and City of Denton foundation repair permit pages
 *   House Committee analysis of C.S.H.B. 613, 83rd Legislature (2013)
 *
 * NO PRICE IS TYPED. The cost post links /structural-engineer/cost and
 * /services/foundation-inspections, which render the price book. The one
 * figure typed is a city's published permit fee, cited to the city.
 *
 * THE FIRM'S STANDING IS DERIVED. The registration renders through
 * registrationStatement(), as posts 2 and 13 already call it. No engineer is
 * named and no license or registration number is typed.
 */

const BUYERS_SECTION_DATE = "2026-10-16";

const BUYER_SRC = {
  trec227: {
    label: "22 Tex. Admin. Code § 535.227, Standards of Practice: General Provisions",
    url: "https://regulations.justia.com/states/texas/title-22/part-23/chapter-535/subchapter-r/section-535-227/",
  },
  trec228: {
    label: "22 Tex. Admin. Code § 535.228, Standards of Practice: Minimum Inspection Requirements for Structural Systems",
    url: "https://regulations.justia.com/states/texas/title-22/part-23/chapter-535/subchapter-r/section-535-228/",
  },
  trec228Notice: {
    label: "TREC, rule notice for 22 TAC § 535.228, adopted August 10, 2026",
    url: "https://www.trec.texas.gov/node/3065",
  },
  trecFoundationGuide: {
    label: "TREC, guidance on rendering an opinion of foundation performance",
    url: "https://www.trec.texas.gov/node/807",
  },
  rei76: {
    label: "TREC, Property Inspection Report form REI 7-6",
    url: "https://www.trec.texas.gov/sites/default/files/pdf-forms/REI%207-6_fillable.pdf",
  },
  trec2018: {
    label: "TREC, One to Four Family Residential Contract (Resale), form 20-18",
    url: "https://trec.texas.gov/node/2755",
  },
  trec2018Text: {
    label: "One to Four Family Residential Contract (Resale), published text (Justia Forms)",
    url: "https://forms.justia.com/texas/statewide/texas-real-estate-commission/contracts/one-to-four-family-residential-contract-resale-43316.html",
  },
  tac537_28: {
    label: "22 Tex. Admin. Code § 537.28, Standard Contract Form TREC No. 20-18",
    url: "https://law.cornell.edu/regulations/texas/22-Tex-Admin-Code-SS-537-28",
  },
  prop5008: {
    label: "Tex. Prop. Code § 5.008, Seller's Disclosure of Property Condition",
    url: "https://texas.public.law/statutes/tex._prop._code_section_5.008",
  },
  prop5008Form: {
    label: "Tex. Prop. Code ch. 5, official text including the § 5.008(b) notice form",
    url: "https://tcss.legis.texas.gov/resources/PR/htm/PR.5.htm",
  },
  fannie: {
    label: "Fannie Mae Selling Guide B4-1.3-06, Property Condition and Quality of Construction of the Improvements",
    url: "https://selling-guide.fanniemae.com/sel/b4-1.3-06/property-condition-and-quality-construction-improvements",
  },
  asceTx: {
    label: "ASCE Texas Section, Guidelines for the Evaluation and Repair of Residential Foundations, Version 3 (2022)",
    url: "https://www.texasce.org/wp-content/uploads/2025/05/Texas-Residential-Foundations-Master-Repair-Guidelines-Ver-3-FINAL-latest.pdf",
  },
  asceTxPage: {
    label: "ASCE Texas Section, Residential Foundations Guidelines page",
    url: "https://www.texasce.org/?p=147",
  },
  occ1001_003: {
    label: "Tex. Occ. Code § 1001.003, Practice of Engineering",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.003",
  },
  occ1001_301: {
    label: "Tex. Occ. Code § 1001.301, License Required",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.301",
  },
  occ1001_401: {
    label: "Tex. Occ. Code § 1001.401, Use of Seal",
    url: "https://texas.public.law/statutes/tex._occ._code_section_1001.401",
  },
  rule137_33: {
    label: "22 Tex. Admin. Code § 137.33, Sealing Procedures",
    url: "http://txrules.elaws.us/rule/title22_chapter137_sec.137.33",
  },
  rule137_57: {
    label: "22 Tex. Admin. Code § 137.57, Engineers Shall Be Objective and Truthful",
    url: "https://regulations.justia.com/states/texas/title-22/part-6/chapter-137/subchapter-c/section-137-57/",
  },
  rule137_59: {
    label: "22 Tex. Admin. Code § 137.59, Engineers' Actions Shall Be Competent",
    url: "https://regulations.justia.com/states/texas/title-22/part-6/chapter-137/subchapter-c/section-137-59/",
  },
  tbpelsRepairResponse: {
    label: "TBPELS, response to a policy advisory request on residential foundation repair methods, January 23, 2018",
    url: "https://www.pels.texas.gov/nm/EAOR_Response44.pdf",
  },
  houstonBlack: {
    label: "USDA soil fact sheet, Houston Black: the Texas state soil (hosted by the Texas Water Development Board)",
    url: "https://www.twdb.texas.gov/conservation/education/doc/tx_State_soil.pdf",
  },
  tdlrExpansive: {
    label: "TDLR, IHB Technical Bulletin TB 10-01, Foundations on Expansive Soils, Residential (rev. 2018)",
    url: "https://tdlr.texas.gov/ihb/pdf/TB1001.pdf",
  },
  lgc214_212: {
    label: "Tex. Loc. Gov't Code § 214.212, International Residential Code",
    url: "https://texas.public.law/statutes/tex._local_gov't_code_section_214.212",
  },
  nrmcaCip4: {
    label: "NRMCA, Concrete in Practice CIP 4, Cracking Concrete Surfaces (2014)",
    url: "https://assets.noviams.com/novi-file-uploads/tca/static-content/04pr.pdf",
  },
  aci224: {
    label: "ACI Committee 224, ACI 224.1R-07, Causes, Evaluation, and Repair of Cracks in Concrete Structures",
    url: "https://www.concrete.org/publications/internationalconcreteabstractsportal/m/details/id/18555",
  },
  ptiDc105: {
    label: "Post-Tensioning Institute, position statement on PTI DC10.5 slab on ground foundations (2020)",
    url: "https://www.post-tensioning.org/Portals/13/Files/PDFs/Education/positionstatement.pdf",
  },
  structurePt: {
    label: "STRUCTURE magazine, Post-Tensioned Slabs on Ground, Part 4: Existing Foundations (December 2010)",
    url: "https://www.structuremag.org/wp-content/uploads/2014/08/C-StrucDesign-Allred-Dec101.pdf",
  },
  houstonPermit: {
    label: "City of Houston, Houston Permitting Center, Foundation repair",
    url: "https://www.houstonpermittingcenter.org/hpwfmo1010",
  },
  dentonPermit: {
    label: "City of Denton, Foundation Repair",
    url: "https://www.cityofdenton.com/649/Foundation-Repair",
  },
  hb613: {
    label: "House Committee Report, bill analysis of C.S.H.B. 613, 83rd Legislature (2013)",
    url: "https://capitol.texas.gov/tlodocs/83R/analysis/html/HB00613H.htm",
  },
} as const;

const bcite = (key: keyof typeof BUYER_SRC, supports: string) => ({ ...BUYER_SRC[key], supports });

const buyerInsights: Insight[] = [
  // --------------------------------------------------------- buyers, post 3
  {
    slug: "foundation-inspection-cost",
    title: "Foundation Inspection Cost: What You Pay | 254 Engineering",
    h1: "Foundation inspection cost, and what each price actually buys",
    description:
      "What a foundation inspection costs depends on who makes it and what document you receive. See what each fee buys, and which one a lender will accept.",
    summary:
      "Three different people sell three different scopes under the name foundation inspection, at three different prices. The useful comparison is the document at the end and who will accept it.",
    eyebrow: "Buying and lending",
    primaryKeyword: "foundation inspection cost",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A foundation inspection costs what its scope costs, and in Texas three different people sell three different scopes under the same name. A licensed home inspector includes a foundation opinion inside the general inspection fee, a repair company may offer its visit free because the visit is how it sells repair, and an engineer charges a separate fee for an evaluation that ends in a sealed opinion.",
      },
      {
        kind: "p",
        text: "So the number on each quote is the wrong thing to compare. Compare the document each one produces and who will accept it.",
      },
      {
        kind: "p",
        text: "The published price for the engineering version of this work, and what changes it, is on [the structural engineer cost page](/structural-engineer/cost).",
      },
      { kind: "h2", text: "The home inspector's opinion is one line of a larger fee" },
      {
        kind: "p",
        text: "The standard Texas resale contract contemplates inspectors licensed by the Texas Real Estate Commission or otherwise permitted by law, and a TREC licensed inspector works to the commission's standards of practice. Rule 535.228(a) requires that inspector to render a written opinion on the performance of the foundation and to report the visible indications used to reach it, such as binding, out of square or non latching doors.",
      },
      {
        kind: "p",
        text: "The same rules set the limits. Rule 535.227(a)(3) describes the inspection as a limited visual survey and states that the inspector is not required to use elevation tools or to perform elevation measurement or calculations. Subsection (d)(7) states that the inspector is not required to recommend or provide engineering services.",
      },
      {
        kind: "p",
        text: "That is why the foundation section of a home inspection adds nothing to the fee. It is one item in a survey of the whole house, written to tell a buyer whether to look further rather than to settle the question.",
      },
      { kind: "h2", text: "The free visit is paid for by the repair" },
      {
        kind: "p",
        text: "A free foundation inspection costs the owner nothing because its cost is recovered from the repair it is meant to lead to. It can still be useful, and how to use one well, and what it cannot be used for, is set out in [free foundation inspection versus an engineer](/insights/free-foundation-inspection).",
      },
      { kind: "h2", text: "The engineer's fee follows the level of investigation" },
      {
        kind: "p",
        text: "The Texas Section of the American Society of Civil Engineers publishes guidelines for evaluating and repairing residential foundations. Version 3 was adopted in 2022, and section 3.1 defines three levels of investigation. Those levels describe, better than any price list, what an engineer's fee is paying for.",
      },
      {
        kind: "ul",
        items: [
          "Level A, first impressions: interviews, a review of existing documents such as drawings, soil reports and prior repairs, and a visual walk through. The guidelines say a written report at this level shall be clearly identified as a report of first impressions.",
          "Level B: everything in Level A, plus relative floor elevations across the foundation, a scaled elevation drawing, and reported overall deflection, local deflection and tilt measured against tolerances.",
          "Level C: everything in Level B, plus the testing the engineer considers appropriate, which the guidelines list as soil sampling, plumbing testing, materials testing, a reinforcing steel survey and post tensioning cable testing.",
        ],
      },
      {
        kind: "p",
        text: "Ask which level a quote is for before comparing it with another.",
      },
      {
        kind: "p",
        text: "Those levels explain why two engineers' quotes for the same house can differ: they may be quoting different levels. A Level A visit is a walk through and a conversation. A Level B evaluation adds a measured survey of the whole floor and the time to reduce and read it. Level C adds work such as a plumbing test or a soil boring, each of which carries its own charge.",
      },
      {
        kind: "p",
        text: "Section 3.1 also says the engineer should personally visit the site and be in responsible charge of the investigation. The scope 254 Engineering describes for a foundation evaluation, measured elevations included, is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "Costs that sit outside the inspection fee" },
      {
        kind: "p",
        text: "A foundation question can produce charges beyond the evaluation itself. Knowing them in advance avoids treating the first quote as the whole cost.",
      },
      {
        kind: "ul",
        items: [
          "A plumbing test. The guidelines list leaking plumbing among the factors that contribute to foundation movement, and section 7.6 says water and sanitary lines should be tested for leaks where a repair includes jacking or lifting.",
          "A site specific soil boring. Section 7.4.2 says geotechnical information for a major or comprehensive repair should come from a site specific boring and testing program.",
          "Repair documents. Section 7.4.1 lists what remediation documents contain, from a plan view and details to the required post repair elevation survey. That is a separate engagement from the evaluation, described on [the repair specification page](/services/repair-specifications).",
          "A city permit. Some Texas cities require one for foundation repair. The City of Denton states that all foundation repairs require a permit, asks for a repair letter and plan signed and sealed by a Texas registered engineer, and lists a fee of $100.",
          "Post repair verification. Section 7.7 says floor elevations should be measured by the engineer or the engineer's representative after the repair, and section 7.8 says the engineer should provide a letter of substantial completion.",
        ],
      },
      { kind: "h2", text: "Who pays in a Texas sale" },
      {
        kind: "p",
        text: "Rule 537.28 makes TREC form 20-18 the contract for a resale of residential property. Its paragraph 7A lets the buyer have the property inspected by inspectors the buyer selects who are licensed by TREC or otherwise permitted by law to make inspections, and it requires the seller to turn on existing utilities at the seller's expense.",
      },
      {
        kind: "p",
        text: "The buyer therefore chooses and engages the inspectors. Anything beyond that about who bears their cost is a matter for the parties and their agents to put in writing.",
      },
      {
        kind: "p",
        text: "Timing matters as much as price. The contract's termination option gives the buyer an unrestricted right to terminate by notice within the time the contract sets, and the option fee is not refunded. An engineer's evaluation needs access to the house and time to reduce the measurements, so it has to be booked early enough to land inside that window.",
      },
      { kind: "h2", text: "What a lender will accept changes the comparison" },
      {
        kind: "p",
        text: "Fannie Mae's Selling Guide, at B4-1.3-06, addresses evidence of settlement noted in an appraisal. The lender must either provide satisfactory evidence that the condition was corrected, or submit a professionally prepared report, based on an inspection of the property, indicating that the condition does not pose any threat of structural damage to the improvements.",
      },
      {
        kind: "p",
        text: "A repair company's proposal is not written to answer that question, and a home inspection is not required to. An engineer's report can be addressed to it directly. Where a lender's condition is the reason for the inspection, the cheapest inspection is the one that satisfies the condition the first time.",
      },
      {
        kind: "note",
        title: "Published price ranges this post could not trace",
        body: [
          "Many cost guides publish national average ranges for foundation inspections and structural engineer visits. The ones read for this post came from contractor quote platforms and did not state a survey method, a sample, or a date range that could be checked.",
          "None is repeated here. The prices that can be checked are the ones a firm publishes for its own work, and this firm's are on its cost page.",
        ],
      },
      {
        kind: "p",
        text: "For a buyer holding an inspection report with a foundation comment and an option period running, the next step is a written question and a scope. [The foundation inspection page](/services/foundation-inspections) sets out what the evaluation covers, and [the published price list](/structural-engineer/cost) states the fee before anyone visits.",
      },
    ],
    sources: [
      bcite("trec228", "That a TREC inspector must render a written opinion on foundation performance and report the indications used, such as binding, out of square or non latching doors."),
      bcite("trec227", "That a TREC inspection is a limited visual survey, that elevation tools and elevation measurement are not required, and that the inspector is not required to recommend or provide engineering services."),
      bcite("asceTx", "The three levels of investigation, the first impressions label, the engineer's site visit, plumbing testing, site specific borings, remediation documents, post repair elevations and the letter of substantial completion."),
      bcite("asceTxPage", "That Version 3 is the current edition of the guidelines."),
      bcite("dentonPermit", "That Denton requires a permit for all foundation repairs, a sealed repair letter and plan, and a fee of $100."),
      bcite("tac537_28", "That form 20-18 is the mandatory contract for residential resale."),
      bcite("trec2018Text", "The paragraph 7A text on inspectors and utilities, and the termination option and its non refundable fee."),
      bcite("fannie", "The two routes a lender has when an appraisal notes settlement, and the professionally prepared report standard."),
    ],
    faqs: [
      {
        q: "How much does a foundation inspection cost in Texas?",
        a: "It depends on who makes it. A TREC inspector's foundation opinion is part of the general home inspection fee, many repair companies offer a free visit, and an engineer charges a separate fee that rises with the level of investigation. This firm publishes a fixed price for its foundation line on its structural engineer cost page.",
      },
      {
        q: "Does a home inspection include the foundation?",
        a: "Yes. Rule 535.228(a) requires a TREC inspector to render a written opinion on foundation performance. Rule 535.227 says that inspector is not required to measure elevations, perform calculations, or provide engineering services.",
      },
      {
        q: "Is the plumbing test included in a foundation inspection?",
        a: "Usually not. The ASCE Texas Section guidelines treat plumbing testing as Level C work the engineer specifies where it is warranted, and section 7.6 calls for leak testing where a repair includes jacking or lifting.",
      },
      {
        q: "Who pays for the foundation inspection when buying a house?",
        a: "Under paragraph 7A of TREC form 20-18 the buyer selects the inspectors, and the seller turns on utilities at the seller's expense. Any other arrangement about inspection costs is for the parties to agree in writing.",
      },
    ],
  },

  // --------------------------------------------------------- buyers, post 5
  {
    slug: "free-foundation-inspection",
    title: "Free Foundation Inspection vs Engineer | 254 Engineering",
    h1: "Free foundation inspection versus an independent engineer",
    description:
      "A free foundation inspection is a sales visit for a repair. See what it tells you, what it cannot, and when an engineer with nothing to sell is worth paying.",
    summary:
      "A free inspection is paid for by the repair it leads to. An independent engineer is paid for the opinion and has no repair to sell, and that single difference decides what each document is worth.",
    eyebrow: "Foundations",
    primaryKeyword: "free foundation inspection",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A free foundation inspection is a visit from a business that is paid when it sells foundation repair, so the person deciding whether you need a repair is the person who would sell it to you. An independent engineer charges for the evaluation and has no repair to sell, and that difference is what a lender, a buyer and a court weigh when they read the result.",
      },
      {
        kind: "p",
        text: "Neither fact makes the free visit dishonest or the paid one correct. They decide what each document can be used for.",
      },
      {
        kind: "p",
        text: "The scope 254 Engineering describes for an independent foundation evaluation is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "What the free visit is" },
      {
        kind: "p",
        text: "The free visit ends in a proposal: a recommended repair, a method, a number of piers or supports, and a price. That is the product. It is the same visit a contractor makes before quoting any job, and the contractor is entitled to make it.",
      },
      {
        kind: "p",
        text: "What it is not, unless a licensed engineer does it, is an engineering evaluation. Section 1001.003 of the Texas Occupations Code includes consultation, investigation, evaluation and analysis in the practice of engineering, section 1001.301 restricts the practice and the title engineer to license holders, and section 1001.401 requires a license holder's seal on a report issued for a Texas project. A salesperson's assessment carries none of that.",
      },
      {
        kind: "note",
        title: "An observation, not a statistic",
        body: [
          "This post describes free foundation inspections as offered by businesses that sell foundation repair because that is how the offer is advertised in Texas markets. No survey counting who offers them was found, and none is implied. The analysis below holds for any free visit whose cost is recovered from a sale.",
        ],
      },
      { kind: "h2", text: "What a free inspection can tell you" },
      {
        kind: "p",
        text: "It tells you what that company would do and what it would charge. Collected from two or three companies, those proposals show whether the contractors agree that repair is needed, how far apart their methods are, and how far apart their prices are. That is real information, and it costs nothing to collect.",
      },
      {
        kind: "p",
        text: "It can also surface observations an owner missed. A good estimator who measures and photographs is recording evidence, and that record is worth keeping whatever is decided. Ask for a copy of the photographs and any readings before the estimator leaves, because they are the part of the visit an independent engineer can use later when reviewing the proposal against the measured floor.",
      },
      { kind: "h2", text: "What it cannot do" },
      {
        kind: "ul",
        items: [
          "It is not the inspection the resale contract contemplates unless the visitor is a TREC licensed inspector or otherwise permitted by law to make inspections, which is the wording of paragraph 7A of TREC form 20-18.",
          "It is not a sealed opinion, and it is not written to answer the question Fannie Mae's Selling Guide puts where an appraisal notes settlement: whether the condition poses any threat of structural damage to the improvements.",
          "It does not define the repair the way remediation documents do. Section 7.4.1 of the ASCE Texas Section guidelines lists what those documents contain, including construction details, specifications, observation requirements and a required post repair elevation survey.",
          "It cannot be independent of the repair, because the repair is how it is paid for.",
        ],
      },
      { kind: "h2", text: "Why having nothing to sell matters" },
      {
        kind: "p",
        text: "The ASCE Texas Section guidelines put it in one sentence at section 2.2: it is essential to avoid conflicts of interest to maintain the credibility of the evaluation. Section 2.1 says the evaluation and the repair design shall be performed by a professional engineer licensed in Texas.",
      },
      {
        kind: "p",
        text: "The board's rules handle the case where an engineer's own interests are tied to the outcome. Rule 137.57(d) says a potential conflict of interest exists when there is a reasonable probability that the engineer's own financial, business, property or personal interests could affect their judgment, and that the engineer may accept that work only if all parties are fully informed in writing and the client confirms its knowledge of the conflict in writing.",
      },
      {
        kind: "p",
        text: "So when a repair company brings an engineer, two questions settle most of it. Who engaged and pays the engineer? And has that relationship been disclosed to you in writing, as rule 137.57 requires where a conflict is possible? An engineer engaged by the owner, with no stake in which contractor wins or how large the repair is, does not have to answer either.",
      },
      {
        kind: "p",
        text: "Where repair is needed, independence pays off a second time. A defined scope lets several contractors price the same work, which is the purpose of [a repair specification](/services/repair-specifications).",
      },
      { kind: "h2", text: "Using a free inspection well" },
      {
        kind: "ul",
        items: [
          "Get the proposal in writing, with the number and location of supports marked on a plan, before anyone leaves the property.",
          "Ask whether floor elevations were measured, and ask for the readings. A proposal that rests on measurements can be checked; one that rests on a walk through cannot.",
          "Ask whether a licensed engineer reviewed the proposal, who engaged that engineer, and whether you will receive anything under that engineer's seal.",
          "Collect more than one. Agreement between independent contractors about the need for repair is worth more than any single proposal.",
          "Do not sign on the day. Movement on clay soil develops over seasons, and a decision can wait a week.",
          "Put the proposals in front of an independent engineer before committing, which is the cheapest point at which to find out whether the repair is warranted and whether its scope fits the measured movement.",
        ],
      },
      { kind: "h2", text: "The city permit is a second check" },
      {
        kind: "p",
        text: "Several Texas cities require engineering on a foundation repair permit. The City of Houston asks, for a slab on grade foundation, for plans prepared by a Texas licensed engineer showing the location, quantity and type of supports. The City of Denton asks for a repair letter and plan signed and sealed by a Texas registered engineer, and for a final engineered seal report before the building final.",
      },
      {
        kind: "p",
        text: "Where the city requires it, the engineering happens either way. The choice an owner has is whether the engineer works for the owner or for the contractor. The stages of a repair, and which professional handles each one, are set out in [foundation engineer versus repair company](/insights/foundation-engineer-vs-repair-company).",
      },
      {
        kind: "p",
        text: "For an owner holding one or more free proposals and unsure whether any repair is warranted, an independent evaluation answers that question before money is committed. [The foundation inspection page](/services/foundation-inspections) sets out what that evaluation measures, and [the published price list](/structural-engineer/cost) states its fee.",
      },
    ],
    sources: [
      bcite("occ1001_003", "That consultation, investigation, evaluation and analysis are part of the practice of engineering."),
      bcite("occ1001_301", "That the practice of engineering and the title engineer are restricted to license holders."),
      bcite("occ1001_401", "That a report issued by a license holder for a Texas project carries the seal."),
      bcite("trec2018Text", "The paragraph 7A wording on inspectors licensed by TREC or otherwise permitted by law."),
      bcite("fannie", "The settlement paragraph and the professionally prepared report standard."),
      bcite("asceTx", "That the evaluation and repair design shall be performed by a Texas licensed engineer, the conflict of interest sentence in section 2.2, and the contents of remediation documents."),
      bcite("rule137_57", "When a potential conflict of interest exists and the written disclosure and confirmation it requires."),
      bcite("houstonPermit", "Houston's requirement for engineer prepared plans showing supports on a slab on grade repair."),
      bcite("dentonPermit", "Denton's requirement for a sealed repair letter and plan and a final engineered seal report."),
    ],
    faqs: [
      {
        q: "Are free foundation inspections worth getting?",
        a: "As price and method comparisons, often yes, especially when more than one is collected. As a decision on whether repair is needed, they come from the party that would sell the repair, so an independent opinion is worth having before a contract is signed.",
      },
      {
        q: "Can I give a free inspection report to my lender?",
        a: "Ask the lender, and expect the answer to depend on the condition in the file. Where an appraisal notes settlement, Fannie Mae's Selling Guide asks for evidence of correction or a professionally prepared report that the condition does not pose any threat of structural damage, which a repair proposal is not written to answer.",
      },
      {
        q: "Do foundation repair companies use engineers?",
        a: "Some do, and some cities require engineering on the permit. Ask who engaged and pays the engineer, and whether any potential conflict has been disclosed to you in writing as TBPELS rule 137.57 requires.",
      },
      {
        q: "Should the engineer come before or after the repair quotes?",
        a: "Before is cheaper if the question is whether repair is needed at all. After also works, because an independent engineer can read the proposals against the measured movement and say whether their scope fits it.",
      },
    ],
  },

  // --------------------------------------------------------- buyers, post 6
  {
    slug: "pre-purchase-home-inspection",
    title: "Pre Purchase Home Inspection Guide | 254 Engineering",
    h1: "The pre purchase home inspection in Texas, and where an engineer fits",
    description:
      "How a pre purchase home inspection works in Texas: the option period, what TREC rules require, the roof, and when to add an engineer before closing. Read more.",
    summary:
      "A Texas home inspection is a visual survey made to minimum standards set by rule. Its limits are written into the same rules, and a buyer who knows them can tell quickly whether a structural question needs an engineer.",
    eyebrow: "Buying and lending",
    primaryKeyword: "pre purchase home inspection",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A pre purchase home inspection in Texas is a visual survey of a one to four family house by an inspector licensed by the Texas Real Estate Commission, made to minimum standards set by rule and reported on a form the commission promulgates. It is the right first step for almost every buyer, and because its limits are written into the same rules, a buyer who knows them can tell within a day of the report whether a structural item needs an engineer before the option period ends.",
      },
      {
        kind: "p",
        text: "Where it does, the scope 254 Engineering describes for a foundation evaluation is on [the foundation inspection page](/services/foundation-inspections), and for a roof on [the roof certification page](/services/roof-inspections).",
      },
      { kind: "h2", text: "The contract sets the clock" },
      {
        kind: "p",
        text: "Rule 537.28 makes TREC form 20-18 the contract for residential resale. Paragraph 7A lets the buyer have the property inspected by inspectors the buyer selects, licensed by TREC or otherwise permitted by law to make inspections, and requires the seller to turn on existing utilities at the seller's expense. The paragraph says the buyer may have inspections made, which means the form allows them rather than requiring them.",
      },
      {
        kind: "p",
        text: "The termination option is what gives the inspection its force. It grants the buyer an unrestricted right to terminate by notice within the time the contract sets, and the option fee is not refunded. Everything in this post has to fit inside that window, including any engineer who is called in after the first report arrives.",
      },
      { kind: "h2", text: "What the inspector must look at" },
      {
        kind: "p",
        text: "Rule 535.227(a)(2) sets the minimum requirements for inspecting a substantially completed one to four family unit, and subsection (a)(3) describes the inspection as a limited visual survey and basic performance evaluation, not a comprehensive investigation or exploratory probe. The report form, REI 7-6, lists the structural items in order under its first heading:",
      },
      {
        kind: "ul",
        items: [
          "Foundations, and grading and drainage.",
          "Roof covering materials, and roof structures and attics.",
          "Walls, ceilings and floors, doors and windows.",
          "Stairways, fireplaces and chimneys, and porches, balconies, decks and carports.",
        ],
      },
      {
        kind: "p",
        text: "For the foundation, rule 535.228(a) requires a written opinion on its performance, the type of foundation, and the vantage point from which any crawl space was inspected, and it asks the inspector to report visible indications of adverse performance such as binding, out of square or non latching doors. TREC's own guidance on that rule says the opinion rests on visual inspection only.",
      },
      { kind: "h2", text: "What the inspector is not required to do" },
      {
        kind: "p",
        text: "The rules are just as specific about the limits, and the limits are what decide whether an engineer is needed. Under rule 535.227 a TREC inspector is not required to:",
      },
      {
        kind: "ul",
        items: [
          "use specialized equipment, which the rule lists as including elevation tools, drain cameras, drones and ladders reaching above one story;",
          "perform elevation measurement, calculations, or destructive testing;",
          "determine the cause or source of a condition, or the cause or effect of a deficiency;",
          "determine compliance with codes, or insurability;",
          "inspect anything buried, hidden, latent or concealed;",
          "recommend or provide engineering, architectural or appraisal services.",
        ],
      },
      {
        kind: "p",
        text: "Rule 535.228(a) adds access limits. The inspector need not enter a crawl space with less than 18 inches of headroom or an access opening smaller than 24 by 18 inches.",
      },
      {
        kind: "p",
        text: "REI 7-6 puts the consequence on the buyer in plain words: it is the client's responsibility to obtain further evaluations or cost estimates from qualified service professionals for items reported as deficient. How a home inspection differs from a structural inspection on the day itself is described on [the structural inspection page](/structural-engineer/inspection).",
      },
      { kind: "h2", text: "When the report should send you to an engineer" },
      {
        kind: "ul",
        items: [
          "The foundation section reports adverse performance, or lists indications such as doors that bind across a whole side of the house.",
          "The roof structure section reports roof surface deflection tied to framing or decking, or the attic was not entered because of access limits.",
          "Walls or floors are marked deficient for structural reasons rather than finishes.",
          "The seller's disclosure notice marks previous structural repair or soil movement.",
          "The lender's appraisal notes settlement. Fannie Mae's Selling Guide then requires evidence of correction or a professionally prepared report, based on an inspection, that the condition does not pose any threat of structural damage.",
        ],
      },
      {
        kind: "p",
        text: "Where a crack is the item in question, [a crack in the foundation](/insights/crack-in-foundation) sets out how to read it. For the measured evaluation itself, the scope 254 Engineering describes is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "The roof before closing" },
      {
        kind: "p",
        text: "A roof inspection before buying a house is two different things depending on who makes it, and the difference is the structure under the covering.",
      },
      { kind: "h3", text: "What the home inspector checks" },
      {
        kind: "p",
        text: "Rule 535.228(c) requires the inspector to inspect the roof covering from the roof surface and to report the covering type, the vantage point, evidence of water penetration and evidence of previous repairs. TREC's rule notice for an amendment adopted on August 10, 2026 describes the requirement as walking the surface where that is safe and will not damage the covering. The rule does not require the inspector to determine remaining life or the number of layers, or to identify latent hail damage.",
      },
      {
        kind: "p",
        text: "Rule 535.228(d) covers roof structures and attics. The inspector reports the vantage point and insulation depth, and reports as deficient roof surface deflections tied to framing or decking problems and defects in framing and decking. The inspector need not enter an attic whose opening is smaller than 22 by 30 inches or where headroom is under 30 inches.",
      },
      { kind: "h3", text: "What an engineer's structural roof assessment covers" },
      {
        kind: "p",
        text: "An engineer's roof assessment narrows the question to the roof as a structure: the framing, the decking where it can be observed from below, deflection along ridges and rafters, and evidence of prior storm damage or repair to the load bearing members. On this firm's roof line the result is a sealed letter stating the observed condition on the date of inspection. It does not estimate remaining service life, and it says so.",
      },
      {
        kind: "p",
        text: "That last point matters to buyers because a lender or carrier sometimes asks for a remaining life figure. [The roof certification page](/services/roof-inspections) explains what the sealed letter does and does not state, so the question can be settled with the lender before anyone climbs a ladder.",
      },
      { kind: "h3", text: "When a buyer should commission one before closing" },
      {
        kind: "ul",
        items: [
          "The home inspector reports deflection tied to framing or decking, or could not enter the attic.",
          "The lender or the insurance carrier has asked in writing for an engineer's roof certification.",
          "The house is inside the Texas windstorm catastrophe area and the roof's certificate status is unclear, which is the subject of [windstorm inspection for coastal buyers](/insights/windstorm-inspection-coastal-buyers) and of [roof certification versus WPI-8](/insights/roof-certification-vs-wpi-8).",
          "A significant storm has passed since the inspection. What to look for is set out in [the hurricane damage structural checklist](/insights/hurricane-damage-structural-checklist).",
        ],
      },
      { kind: "h2", text: "Read the seller's disclosure before the inspection" },
      {
        kind: "p",
        text: "Section 5.008 of the Property Code requires a seller of a single dwelling unit to give the buyer a written notice of the property's condition, completed to the best of the seller's belief and knowledge. The statutory form asks about defects in the foundation and slabs, and asks whether the seller is aware of previous structural or roof repair and of landfill, settling, soil movement or fault lines.",
      },
      {
        kind: "p",
        text: "A buyer who reads those answers before the inspection can point the inspector at them. The section does not apply to every transfer: subsection (e) exempts, among others, foreclosure sales, transfers by a fiduciary administering an estate, and new homes not previously occupied.",
      },
      { kind: "h2", text: "A sequence that fits inside an option period" },
      {
        kind: "ul",
        items: [
          "Read the seller's disclosure notice the day the contract is signed.",
          "Book the TREC inspection for the first days of the option period.",
          "Read the foundation, roof structure and walls sections first, and list every item marked deficient for structural reasons.",
          "If any item is on the list, call an engineer the same day with the report in hand and the written question it raises.",
          "Ask the lender, early, whether its appraisal or its own rules call for an engineer's report, and get the wording in writing.",
        ],
      },
      {
        kind: "p",
        text: "An engineer brought in early, with a defined question and the inspector's report, has the best chance of answering inside the window that remains. [The foundation inspection page](/services/foundation-inspections) sets out what that evaluation measures, and [the published price list](/structural-engineer/cost) states each fee before the visit.",
      },
    ],
    sources: [
      bcite("tac537_28", "That form 20-18 is the mandatory contract for residential resale."),
      bcite("trec2018", "The current edition of form 20-18 and its effective date of January 3, 2025."),
      bcite("trec2018Text", "The paragraph 7A text on inspections and utilities, and the termination option and its non refundable fee."),
      bcite("trec227", "The scope of a TREC inspection, the equipment and procedures not required, and the general limitations including causes, code compliance, insurability, concealed conditions and engineering services."),
      bcite("trec228", "The foundation, roof covering, roof structure and attic requirements, and the crawl space and attic access limits."),
      bcite("trec228Notice", "The August 10, 2026 amendment on walking the roof surface where safe."),
      bcite("trecFoundationGuide", "That the foundation opinion rests on visual inspection only."),
      bcite("rei76", "The structural items on the report form and the client's responsibility to obtain further evaluations."),
      bcite("fannie", "The settlement paragraph and the professionally prepared report standard."),
      bcite("prop5008", "Who must give the notice, the best of belief and knowledge standard, and the exemptions in subsection (e)."),
      bcite("prop5008Form", "The notice form's items on foundation and slabs, previous structural or roof repair, and settling and soil movement."),
    ],
    faqs: [
      {
        q: "Is a pre purchase home inspection required in Texas?",
        a: "The resale contract does not require one. Paragraph 7A of TREC form 20-18 says the buyer may have the property inspected by inspectors the buyer selects, and the termination option is what lets the buyer act on the result.",
      },
      {
        q: "Does the home inspector check the foundation?",
        a: "Yes. Rule 535.228(a) requires a written opinion on foundation performance. Rule 535.227 says the inspector is not required to measure elevations, perform calculations, determine causes, or provide engineering services.",
      },
      {
        q: "Will the inspector walk the roof?",
        a: "Rule 535.228(c) requires inspection from the roof surface, and TREC's notice for the amendment adopted August 10, 2026 describes walking it where that is safe and will not damage the covering. Where it cannot be done safely the inspector is not required to.",
      },
      {
        q: "Can a home inspector tell me whether a crack is structural?",
        a: "The inspector reports indications of adverse performance and gives an opinion on foundation performance, visually. Determining the cause of a condition, measuring elevations and providing engineering services are outside what the rules require.",
      },
    ],
  },

  // --------------------------------------------------------- buyers, post 7
  {
    slug: "structural-engineer-report",
    title: "Structural Engineer Report Explained | 254 Engineering",
    h1: "The structural engineer report, read the way an agent or a lender reads it",
    description:
      "What a structural engineer report must show before an agent, broker or lender relies on it: the seal, scope, addressee, date and limits. See how to read one.",
    summary:
      "A structural report is useful to a transaction only as far as its seal, scope, addressee and date allow. Four questions settle whether it answers the condition in the file.",
    eyebrow: "For agents and lenders",
    primaryKeyword: "structural engineer report",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A structural engineer report is a licensed engineer's written opinion about a defined part of a building, sealed under Texas rules, and it is only as useful to a transaction as its scope, addressee and date allow. Before relying on one, an agent, broker or lender needs four answers: whose seal is on it, what question it was asked, what was actually observed, and whether its conclusion answers the condition in the file in words that match it.",
      },
      {
        kind: "p",
        text: "The two documents 254 Engineering describes for transactions are [the foundation evaluation](/services/foundation-inspections) and [the roof certification](/services/roof-inspections). This post is about reading any firm's report, including those.",
      },
      { kind: "h2", text: "The seal makes it an engineer's report" },
      {
        kind: "p",
        text: "Section 1001.401 of the Occupations Code requires a plan, specification, plat or report issued by a license holder for a Texas project to carry the license holder's seal. Rule 137.33 states the purpose: the seal assures the user that the work was performed or directly supervised by the engineer named, and it delineates the scope of that engineer's work. On sealing, the engineer takes full professional responsibility for it.",
      },
      {
        kind: "p",
        text: "So an unsealed letter on engineering letterhead is not the document a file needs, and a sealed one covers only what its scope says. Who carries that responsibility on a Texas project, and why the term engineer of record is not defined in Texas law, is set out in [the engineer of record in Texas](/insights/engineer-of-record-texas).",
      },
      {
        kind: "p",
        text: [
          "Both the individual and the firm can be checked in minutes on the board's rosters, as [the PE license lookup](/insights/texas-pe-license-lookup) and [what a firm registration is](/insights/texas-engineering-firm-registration) explain.",
          registrationStatement(),
        ]
          .filter(Boolean)
          .join(" "),
      },
      { kind: "h2", text: "Five documents share the name" },
      {
        kind: "p",
        text: "People call all of these a structural engineer report or a structural engineer letter. They answer different questions, and a file can hold the wrong one.",
      },
      {
        kind: "ul",
        items: [
          "A foundation evaluation. The ASCE Texas Section guidelines define three levels, and a Level A report of first impressions must say that it is one. Only Level B and above carry measured floor elevations.",
          "A roof certification: a sealed opinion on the observed condition of a roof on the inspection date. On this firm's roof line it does not estimate remaining service life.",
          "A structural letter for a permit, which answers a building department's written request about a described element. It is a permitting document, described on [the structural letters page](/services/structural-letters), not a transaction report.",
          "Repair documents, which the guidelines call remediation documents: the plan, details and specifications a contractor builds from.",
          "A post repair letter. Section 7.8 of the guidelines says the engineer should provide a letter of substantial completion stating that the work generally conforms to the documents, and section 7.7 calls for floor elevations measured after the repair.",
        ],
      },
      {
        kind: "p",
        text: "A forensic report on the cause of storm damage is a sixth kind again, and how it differs from an inspection and a certificate on the coast is covered in [inspection versus forensic report](/insights/inspection-vs-forensic-report).",
      },
      { kind: "h2", text: "Read the scope and the limits first" },
      {
        kind: "p",
        text: "The scope paragraph says what the engineer was asked and what was examined, and the limits paragraph says what was not. A common misreading of a report treats its conclusion as broader than its scope.",
      },
      {
        kind: "ul",
        items: [
          "The addressee. A report addressed to one party is not automatically usable by another, and some lenders require being named.",
          "The date of the observation, which is the date the opinion describes. A report records a condition on a day; whether a lender treats it as current is that lender's rule.",
          "The level of investigation. A first impressions report is labelled as one under the guidelines, and it does not include measured elevations.",
          "What was not observed. Concealed framing, finished crawl spaces and areas without safe access should be named as not observed, with the reason.",
          "Who did the field work. Section 3.1 of the guidelines says the engineer should personally visit the site and be in responsible charge of the investigation.",
        ],
      },
      { kind: "h2", text: "Read the conclusion against the condition in the file" },
      {
        kind: "p",
        text: "A lender's condition usually has its own words, and the report has to answer them. Fannie Mae's Selling Guide, at B4-1.3-06, is a clear example. Where an appraisal notes settlement, the lender must either provide satisfactory evidence that the condition was corrected or submit a professionally prepared report, based on an inspection of the property, indicating that the condition does not pose any threat of structural damage to the improvements.",
      },
      {
        kind: "p",
        text: "A report that describes movement accurately but never states a conclusion on that question has not answered the condition. A report that recommends repair points the file to the other route, evidence of correction, which is where a post repair letter of substantial completion comes in. The same section says the lender decides whether an inspection is required and documents its decision and rationale in the loan file.",
      },
      {
        kind: "p",
        text: "For a file with a foundation condition, the most efficient sequence is to send the engineer the lender's exact wording before the visit. [The foundation inspection page](/services/foundation-inspections) sets out what the evaluation measures and states.",
      },
      { kind: "h2", text: "A report in hand and the seller's disclosure" },
      {
        kind: "p",
        text: "Section 5.008 of the Property Code requires the seller of a single dwelling unit to give a written disclosure notice completed to the best of the seller's belief and knowledge. The statutory form asks about defects in the foundation and slabs and about previous structural or roof repair.",
      },
      {
        kind: "p",
        text: "An engineer's report a seller has received is part of what that seller knows. How it bears on a particular notice is a question for the seller and the seller's own counsel. For an agent, the practical point is that a report produced during a terminated contract does not disappear when the contract does.",
      },
      { kind: "h2", text: "When to suggest a report, and when not to" },
      {
        kind: "p",
        text: "A report is worth suggesting when the TREC inspection reports adverse foundation performance or structural deficiencies, when an appraisal or underwriting condition names a structural item, or when the seller discloses a previous structural repair and cannot produce the documents behind it. In that last case, ask first for the repair documents and the letter of substantial completion, which may already answer the question.",
      },
      {
        kind: "p",
        text: "It is not worth suggesting for a stable hairline crack with nothing else around it. A home inspector's foundation opinion, made under rule 535.228(a), already addresses performance, and [a crack in the foundation](/insights/crack-in-foundation) sets out which cracks point to movement.",
      },
      { kind: "h2", text: "What to send the engineer before the visit" },
      {
        kind: "ul",
        items: [
          "The written condition from the lender or underwriter, word for word.",
          "The pages of the TREC report that prompted the question.",
          "The seller's disclosure notice and any prior repair documents.",
          "The name of every party who needs to be named on the report.",
          "The closing date and the end of the option period.",
        ],
      },
      {
        kind: "p",
        text: "With those in hand an engineer can say before the visit whether the requested report can answer the condition at all. Each line's fixed fee is on [the published price list](/structural-engineer/cost).",
      },
    ],
    sources: [
      bcite("occ1001_401", "That a report issued by a license holder for a Texas project carries the seal."),
      bcite("rule137_33", "The purpose of the seal, the delineation of scope, and full professional responsibility on sealing."),
      bcite("asceTx", "The levels of investigation and the first impressions label, the engineer's site visit, remediation documents, post repair elevations and the letter of substantial completion."),
      bcite("fannie", "The settlement paragraph, the professionally prepared report standard, and that the lender decides whether an inspection is required and documents it."),
      bcite("prop5008", "The disclosure duty and the best of belief and knowledge standard."),
      bcite("prop5008Form", "The notice form's items on foundation and slabs and previous structural or roof repair."),
      bcite("trec228", "That a TREC inspector renders a written opinion on foundation performance."),
    ],
    faqs: [
      {
        q: "What is a structural engineer letter?",
        a: "Usually a short sealed report answering one question, such as whether a foundation shows movement that poses a threat of structural damage. A structural letter for a permit is a different document that answers a building department's written request about a described element.",
      },
      {
        q: "How long is a structural engineer report valid?",
        a: "It records a condition observed on a date and does not expire on its own. Whether a lender or carrier treats it as current is that party's rule, and a significant storm or new distress after the date usually calls for a fresh look.",
      },
      {
        q: "Can a buyer rely on a report the seller commissioned?",
        a: "Read the addressee and the reliance language. A report addressed to the seller is not automatically usable by the buyer or the buyer's lender, and some lenders require being named. The engineer who wrote it can say whether a letter to another party is possible.",
      },
      {
        q: "Does a structural report guarantee the foundation?",
        a: "No. It is a professional opinion about a condition observed on a date, within a stated scope. It is not a warranty and not a prediction of future movement.",
      },
    ],
  },

  // --------------------------------------------------------- buyers, post 8
  {
    slug: "crack-in-foundation",
    title: "Crack in Foundation: Should You Worry? | 254 Engineering",
    h1: "A crack in the foundation, and how to tell whether it matters",
    description:
      "Most foundation cracks are shrinkage, not failure. See which crack patterns point to movement, how to monitor one yourself, and when to ask an engineer.",
    summary:
      "Nearly all concrete cracks. The useful question is whether anything is moving, and a crack can answer that only when it is read with the house around it and watched over time.",
    eyebrow: "Foundations",
    primaryKeyword: "crack in foundation",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "Most cracks in a foundation are not a sign that it is failing. Concrete shrinks as it dries and nearly all of it cracks, so the question worth answering is whether anything is moving: a crack that is widening, that has one face displaced from the other, or that arrives with doors and windows that have stopped closing points to movement, and a stable hairline crack on its own usually does not.",
      },
      {
        kind: "p",
        text: "The industry says so plainly. The National Ready Mixed Concrete Association's guidance states that all concrete has a tendency to crack and that crack free concrete is not possible, and that most early random cracks rarely affect structural integrity or service life. The ASCE Texas Section's residential foundation guidelines say the majority of cracks do not compromise structural integrity.",
      },
      {
        kind: "p",
        text: "Where the pattern does point to movement, the measured evaluation 254 Engineering describes is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "Read the crack before measuring it" },
      {
        kind: "ul",
        items: [
          "Fine random cracks in a slab or garage floor, with no offset. These are the shrinkage cracks the concrete guidance describes.",
          "Straight cracks along sawn or tooled lines. Those are contraction joints doing their job; NRMCA guidance places them at 24 to 36 times the slab thickness so the concrete cracks there rather than at random.",
          "A crack with one face higher or further out than the other. It has moved in more than one direction, which a plain drying crack has not done.",
          "A crack that has grown since it was first noticed, in length or in width.",
          "A crack that lines up with distress elsewhere: a door that binds, a gap at a window frame, separation in brick coursing outside.",
        ],
      },
      {
        kind: "p",
        text: "The first two are normal. The last three are reasons to keep reading.",
      },
      { kind: "h2", text: "The signs that sit away from the crack" },
      {
        kind: "p",
        text: "A foundation that moves shows it through the frame above it. The Texas Real Estate Commission's inspection standards name the typical indications in rule 535.228(a): binding, out of square and non latching doors. The ASCE Texas guidelines tell an evaluating engineer to read brick coursing, door alignment and built in surfaces alongside the measured floor.",
      },
      {
        kind: "p",
        text: "One sticking door in humid weather is a door. Several doors along the same side of the house that began to bind in the same season is a pattern, and it means more than any single crack.",
      },
      { kind: "h2", text: "How to monitor a crack yourself" },
      {
        kind: "p",
        text: "A crack's history is worth more than its size, and an owner can record that history at no cost.",
      },
      {
        kind: "ul",
        items: [
          "Mark both ends of the crack with a pencil line and the date.",
          "Photograph it square on with a ruler or a tape in frame, from a spot you can return to.",
          "Measure the width at two or three marked points with a crack gauge or a feeler gauge, and write the readings down.",
          "Note whether one side sits higher than the other, and by how much.",
          "Repeat at the end of a dry season and the end of a wet one. On Texas clay, a reading from a single month says little about the year.",
        ],
      },
      {
        kind: "p",
        text: "Do not fill or paint over the crack until it has been read. Filling it removes the record an engineer would use, and a filled crack that reopens says only that something moved, not how much.",
      },
      {
        kind: "note",
        title: "The quarter inch rule, which this post could not trace",
        body: [
          "Many guides say a foundation crack narrower than a set width, often a quarter inch or an eighth, is harmless and anything wider is structural. This post could not trace that rule to a Texas primary source, a code section, or the ASCE Texas Section guidelines.",
          "The guidelines do mention a width: section 7.4.3.3 specifies epoxy injection for slab cracks of about 1/32 inch and larger to restore stiffness. That is a repair criterion inside an engineered repair, not a threshold for concern, and it should not be read as one.",
        ],
      },
      { kind: "h2", text: "Why Texas foundations crack in seasons" },
      {
        kind: "p",
        text: "Much of Texas sits on clay that changes volume with moisture. The USDA's fact sheet on Houston Black, the soil the Professional Soil Scientists Association of Texas recommended as the state soil, describes classic Vertisols that shrink and swell markedly with changes in moisture content, found on about 1.5 million acres of the Blackland Prairie, and calls their very high shrink swell potential a common limitation for building sites.",
      },
      {
        kind: "p",
        text: "The International Residential Code treats such soils as a design condition. TDLR's technical bulletin on foundations on expansive soils summarizes the code's test, one element of which is a plasticity index of 15 or greater, and the code's requirement that foundations on those soils be designed for them.",
      },
      {
        kind: "p",
        text: "So a slab on clay moves a little every year, and a crack can open in summer and close in spring without anything being wrong. Slab foundations, common across Texas, are covered in [cracks in a concrete slab foundation](/insights/crack-in-concrete-slab-foundation).",
      },
      { kind: "h2", text: "When a crack needs an engineer" },
      {
        kind: "ul",
        items: [
          "Your own readings show it widening across seasons rather than opening and closing.",
          "One face is displaced from the other.",
          "Doors and windows along one side of the house have started to bind together.",
          "The crack is in a foundation that has already been repaired.",
          "A lender, a buyer or an insurer has asked for an engineer's opinion in writing.",
          "On the coast, the crack appeared after a storm. What else to check is in [the hurricane damage structural checklist](/insights/hurricane-damage-structural-checklist).",
        ],
      },
      {
        kind: "p",
        text: "When a cracked foundation needs a repair rather than a watch, a defined scope is what lets contractors price the same job, which is what [a repair specification](/services/repair-specifications) is for.",
      },
      { kind: "h2", text: "What an engineer does with the crack" },
      {
        kind: "p",
        text: "An engineer treats the crack as one piece of evidence. Under the ASCE Texas guidelines, a Level B evaluation adds relative floor elevations across the whole foundation and reports deflection and tilt against tolerances. The guidelines use the residential code's L/360 live load limit as an analogy: where the measured profile is under L/360 and no distress is visible, it is unlikely the foundation has deflected materially. They also say a tilt greater than 1 percent is usually noticeable.",
      },
      {
        kind: "p",
        text: "The crack pattern is then read against that measured shape. A crack sitting at the low point of a measured deflection means something different from the same crack in a flat floor. ACI 224.1R, the American Concrete Institute's report on cracks, is organized the same way: causes first, then evaluation, then repair.",
      },
      {
        kind: "p",
        text: "If your readings or the signs above point to movement, the next step is a measured evaluation rather than a repair quote. [The foundation inspection page](/services/foundation-inspections) sets out what it covers, and [the structural engineer guide to when you need one](/structural-engineer/when-you-need-one) covers the cases where the honest answer is to keep watching.",
      },
    ],
    sources: [
      bcite("nrmcaCip4", "That all concrete tends to crack, that crack free concrete is not possible, contraction joint spacing, and that early random cracks rarely affect structural integrity."),
      bcite("asceTx", "That the majority of cracks do not compromise structural integrity, the use of brick coursing and door alignment, Level B elevations, the L/360 analogy, the 1 percent tilt observation, and the 1/32 inch injection criterion."),
      bcite("trec228", "The indications of adverse foundation performance named in the rule."),
      bcite("houstonBlack", "That Houston Black soils shrink and swell markedly, cover about 1.5 million acres of the Blackland Prairie, and limit building site development."),
      bcite("tdlrExpansive", "The IRC test for expansive soil, including a plasticity index of 15 or greater, and the design requirement for foundations on it."),
      bcite("aci224", "That ACI 224.1R covers the causes, evaluation and repair of cracks in concrete."),
    ],
    faqs: [
      {
        q: "Is a crack in the foundation normal?",
        a: "Usually. NRMCA guidance says all concrete tends to crack and that most early random cracks rarely affect structural integrity. A crack becomes a concern when it is widening, displaced, or accompanied by doors and windows that have started to bind.",
      },
      {
        q: "How do I know if a foundation crack is getting worse?",
        a: "Mark its ends with the date, photograph it with a ruler in frame, and measure the width at marked points. Repeat at the end of a dry season and a wet one. Growth across seasons is the signal, not the size on one day.",
      },
      {
        q: "Should I seal a foundation crack?",
        a: "Not before it has been read. Filling it removes the record an engineer would use. Sealing a stable shrinkage crack later for appearance or moisture is a separate decision.",
      },
      {
        q: "Who should look at a foundation crack?",
        a: "For a stable hairline crack, often nobody yet beyond your own dated photographs. For a crack that is moving or comes with other distress, a licensed engineer who measures the floor and reads the crack against it.",
      },
    ],
  },

  // --------------------------------------------------------- buyers, post 9
  {
    slug: "crack-in-concrete-slab-foundation",
    title: "Crack in Concrete Slab Foundation Guide | 254 Engineering",
    h1: "Cracks in a concrete slab foundation on Texas clay",
    description:
      "Why slab foundations crack on Texas clay, which slab cracks are shrinkage and which suggest movement, and what to check before anyone cuts the slab. Read more.",
    summary:
      "Most slab cracks are drying shrinkage. On expansive clay the slab around them moves with the seasons, and the crack is a record of that movement rather than a measure of it.",
    eyebrow: "Foundations",
    primaryKeyword: "crack in concrete slab foundation",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A crack in a concrete slab foundation in Texas is usually a shrinkage crack that formed as the concrete dried, and on its own it rarely matters structurally. It starts to matter when the slab around it has changed shape, which on the expansive clays under much of the state is a seasonal process that a crack can record but cannot measure.",
      },
      {
        kind: "p",
        text: "Measuring it takes a floor elevation survey and a reading of the house above. The scope 254 Engineering describes for that evaluation is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "How Texas slabs are built" },
      {
        kind: "p",
        text: "Many Texas houses stand on a slab on grade: a concrete floor cast on the ground with thickened beams under its perimeter and across its interior. The slab is reinforced in one of two ways. A conventionally reinforced slab carries steel bar. A post tensioned slab carries steel tendons stressed after the concrete hardens, and the Post-Tensioning Institute's standard PTI DC10.5 governs the design of post tensioned slabs on expansive and stable soils.",
      },
      {
        kind: "p",
        text: "The code behind both is the International Residential Code. Section 214.212 of the Local Government Code adopts the IRC as it existed on May 1, 2012 as the municipal residential building code in Texas, applies it to construction, alteration and repair of residential structures in a municipality, and lets each city adopt local amendments.",
      },
      {
        kind: "p",
        text: "The code treats clay as a design condition. TDLR's technical bulletin on foundations on expansive soils summarizes the IRC test, which includes a plasticity index of 15 or greater, and the requirement that foundations on such soils be designed for them under the building code.",
      },
      { kind: "h2", text: "Why the clay moves the slab" },
      {
        kind: "p",
        text: "The USDA's fact sheet on Houston Black, the soil recommended as the Texas state soil, describes it as a classic Vertisol that shrinks and swells markedly with changes in moisture content. It notes that water enters these soils rapidly when they are dry and cracked and very slowly when they are moist, and that their very high shrink swell potential is a common limitation for building sites.",
      },
      {
        kind: "p",
        text: "A slab on that soil moves with it as the moisture beneath it changes. The soil differs by region, from the Blackland Prairie behind [Dallas Fort Worth](/coverage/dallas-fort-worth) to the coastal clays of [Greater Houston](/coverage/greater-houston), and the region pages describe each.",
      },
      { kind: "h2", text: "Shrinkage cracks are expected" },
      {
        kind: "p",
        text: "The National Ready Mixed Concrete Association's guidance on cracking states that all concrete has a tendency to crack and that crack free concrete is not possible. It attributes most cracking to design and construction practice, recommends contraction joints spaced at 24 to 36 times the slab thickness to control where the concrete cracks, and names rapid moisture loss from fresh concrete in dry weather as a cause of plastic shrinkage cracking.",
      },
      {
        kind: "p",
        text: "Its conclusion is the one a worried owner needs: most early random cracks, though unsightly, rarely affect the structural integrity or service life of the concrete.",
      },
      {
        kind: "p",
        text: "A fine crack with no offset, found when carpet comes up or visible on a garage floor, is most often this kind.",
      },
      { kind: "h2", text: "Slab cracks that point to movement" },
      {
        kind: "ul",
        items: [
          "A vertical offset across the crack, so one side sits higher than the other.",
          "A crack that runs through the perimeter beam and is visible on the outside face of the foundation.",
          "Floor tile that cracks along a line, especially a line that continues across rooms.",
          "A crack that lines up with distress above it: doors that bind, cracks at the corners of openings, gaps where walls meet the ceiling.",
          "A crack that is wider at the end of a dry season than at the end of a wet one, year after year.",
        ],
      },
      {
        kind: "p",
        text: "Water under the slab is part of the same picture. The ASCE Texas Section guidelines list leaking plumbing among the factors that contribute to foundation movement, and section 7.6 calls for water and sanitary lines to be tested for leaks where a repair includes jacking or lifting.",
      },
      {
        kind: "p",
        text: "How to read a crack in general, and how to keep a dated record of one, is set out in [a crack in the foundation](/insights/crack-in-foundation).",
      },
      { kind: "h2", text: "Cracks found under flooring" },
      {
        kind: "p",
        text: "Many slab cracks are first seen during a flooring job. That is the moment to photograph and measure them, with a ruler in frame and the location noted on a sketch of the room, before new flooring covers them for another decade.",
      },
      {
        kind: "p",
        text: "Flooring also affects measurement. The ASCE Texas guidelines say floor elevation surveys should be adjusted for the thickness of floor coverings, because a change from tile to carpet can read as movement on a survey that ignores it.",
      },
      { kind: "h2", text: "Post tensioned slabs: locate the tendons before anyone cuts" },
      {
        kind: "p",
        text: "A post tensioned slab is not a slab to saw, core or drill on a guess. An article on existing post tensioned foundations in STRUCTURE magazine advises that tendons be located in the areas next to any planned core, warns that removing concrete that is actively resisting a loaded anchor can cause cracking or blowouts, and says an opening near live anchors will typically require engineering analysis. It describes the anchor zone as roughly 24 to 36 inches from the anchor face.",
      },
      {
        kind: "p",
        text: "That matters most when a plumber needs to reach a line under the slab, or a remodel adds a floor drain or moves a wall. The time to answer the question is before the saw arrives. Where a repair or alteration needs defined work, [a repair specification](/services/repair-specifications) sets it out so the contractor builds to a plan.",
      },
      { kind: "h2", text: "What an engineer measures on a slab" },
      {
        kind: "p",
        text: "Under the ASCE Texas guidelines a Level B evaluation records relative elevations across the slab, draws them to scale, and reports deflection and tilt against tolerances. Deflection is measured as the largest deviation of a point from a straight line between two others, divided by the distance between them. The guidelines use the residential code's L/360 limit as an analogy and say a profile under it with no visible distress is unlikely to have deflected materially.",
      },
      {
        kind: "p",
        text: "They add cautions. Over distances shorter than about 20 feet, unevenness built into the original pour can dominate the reading. A single survey may or may not be enough, and a comparison with an earlier survey, adjusted to a common reference point, says more.",
      },
      {
        kind: "p",
        text: "On repair, the guidelines set realistic expectations. Section 7.4.3.1 says it is unlikely that elevation adjustments will result in a level foundation, and section 7.4.3.3 specifies epoxy injection for slab cracks of about 1/32 inch and larger where stiffness has to be restored as part of the repair.",
      },
      {
        kind: "p",
        text: "For a slab crack that shows any of the movement signs above, the measured evaluation comes before any repair decision. [The foundation inspection page](/services/foundation-inspections) sets out what it covers, and [the published price list](/structural-engineer/cost) states its fee.",
      },
    ],
    sources: [
      bcite("ptiDc105", "That PTI DC10.5 is the standard for the design of shallow post tensioned slab on ground foundations on expansive and stable soils."),
      bcite("lgc214_212", "The IRC as it existed on May 1, 2012 as the municipal residential building code, its reach to residential alteration and repair, and local amendments."),
      bcite("tdlrExpansive", "The IRC test for expansive soil, including a plasticity index of 15 or greater, and the design requirement for foundations on it."),
      bcite("houstonBlack", "That Houston Black soils shrink and swell markedly, take water rapidly when dry and cracked, and limit building site development."),
      bcite("nrmcaCip4", "That all concrete tends to crack, contraction joint spacing, plastic shrinkage cracking, and that early random cracks rarely affect structural integrity."),
      bcite("asceTx", "Leaking plumbing as a contributing factor, leak testing during repair, floor covering adjustment, Level B elevations, the deflection ratio, the L/360 analogy, the 20 foot caution, survey comparison, and the repair expectations in 7.4.3."),
      bcite("structurePt", "Locating tendons before coring, the risk of removing concrete near a loaded anchor, the anchor zone, and the need for engineering analysis near live anchors."),
    ],
    faqs: [
      {
        q: "Is it normal for a slab foundation to crack?",
        a: "Yes. NRMCA guidance says all concrete tends to crack and that most early random cracks rarely affect structural integrity. On Texas clay, what matters is whether the slab around the crack has changed shape.",
      },
      {
        q: "How can I tell whether my slab is post tensioned?",
        a: "The builder's foundation plan says so. The STRUCTURE magazine article on existing post tensioned slabs notes that strand locations can be estimated from rust marks left by anchor nails along the foundation edge, but locating tendons for any cut is work for someone qualified to do it.",
      },
      {
        q: "Will a foundation repair make my floor level?",
        a: "Usually not perfectly. Section 7.4.3.1 of the ASCE Texas Section guidelines says it is unlikely that elevation adjustments will result in a level foundation.",
      },
      {
        q: "Should slab cracks be repaired?",
        a: "A stable shrinkage crack may only need sealing for moisture or appearance. A crack tied to measured movement is part of a foundation repair, and that repair should be specified by an engineer in remediation documents.",
      },
    ],
  },

  // -------------------------------------------------------- buyers, post 10
  {
    slug: "foundation-engineer-vs-repair-company",
    title: "Foundation Engineer vs Repair Company | 254 Engineering",
    h1: "Foundation engineer versus repair company: who does what in a repair",
    description:
      "A foundation engineer evaluates and specifies; a repair company builds. See each role from first visit to final letter, and what to ask each before you sign.",
    summary:
      "On a well run foundation repair the engineer evaluates and specifies, the contractor builds, and the engineer confirms the result. Most problems start where those roles merge.",
    eyebrow: "Foundations",
    primaryKeyword: "foundation engineer",
    datePublished: BUYERS_SECTION_DATE,
    dateModified: BUYERS_SECTION_DATE,
    body: [
      {
        kind: "p",
        text: "A foundation engineer and a foundation repair company do different jobs on the same repair: the engineer evaluates the foundation, decides whether repair is warranted and specifies it, and the repair company builds what is specified. Texas law places evaluation and design in the practice of engineering, and the residential foundation guidelines published by the Texas Section of the American Society of Civil Engineers state that the evaluation and the repair design shall be performed by a professional engineer licensed in Texas.",
      },
      {
        kind: "p",
        text: "The evaluation step, and what 254 Engineering describes for it, is on [the foundation inspection page](/services/foundation-inspections).",
      },
      { kind: "h2", text: "What foundation engineer means" },
      {
        kind: "p",
        text: "Section 1001.003 of the Occupations Code includes consultation, investigation, evaluation, analysis and design in the practice of engineering, and section 1001.301 restricts that practice, and the title engineer, to license holders. Foundation engineer describes the work an engineer does; it is not a separate license.",
      },
      {
        kind: "p",
        text: "What protects an owner is competence, and the board's rules address it directly. Rule 137.59 says engineers shall practice only in their areas of competence and shall not take an assignment they are not qualified by education or experience to perform.",
      },
      {
        kind: "p",
        text: "Two kinds of engineer can be involved. A geotechnical engineer characterizes the soil, and the ASCE Texas guidelines say a major or comprehensive repair should rest on a site specific boring and testing program. The engineer who evaluates the foundation and designs the repair draws on that soil data.",
      },
      { kind: "h2", text: "The repair, stage by stage" },
      { kind: "h3", text: "1. Evaluation, by the engineer" },
      {
        kind: "p",
        text: "The guidelines define three levels: a Level A report of first impressions, a Level B evaluation with measured floor elevations, and Level C with testing such as soil sampling, plumbing tests and post tensioning cable tests. Section 3.1 says the engineer should personally visit the site and be in responsible charge of the investigation.",
      },
      { kind: "h3", text: "2. Repair documents, by the engineer" },
      {
        kind: "p",
        text: "Section 7.4.1 lists what remediation documents contain, including the site address, purpose and limitations, a plan view, construction details, specifications, requirements for construction observation or testing, and a required post repair floor elevation survey. Section 7.2 says the engineer who seals those documents is the engineer of record, with approval authority over changes.",
      },
      { kind: "h3", text: "3. Permit, by whoever the city names" },
      {
        kind: "p",
        text: "Several Texas cities require engineering on the permit. The City of Houston asks, for a slab on grade foundation, for plans prepared by a Texas licensed engineer showing the location, quantity and type of supports. The City of Denton states that all foundation repairs require a permit and asks for a repair letter and plan signed and sealed by a Texas registered engineer. Requirements differ by city, so check the city where the house stands.",
      },
      { kind: "h3", text: "4. Construction, by the repair company" },
      {
        kind: "p",
        text: "The contractor installs the supports, lifts where the documents call for it, and restores the site, observed or tested as the documents require. Section 7.4.3.1 sets the expectation: it is unlikely that elevation adjustments will result in a level foundation.",
      },
      { kind: "h3", text: "5. Plumbing, by a licensed plumber" },
      {
        kind: "p",
        text: "Section 7.6 says water and sanitary lines should be tested for leaks where the repair includes jacking or lifting, and that leaks found should be repaired.",
      },
      { kind: "h3", text: "6. Verification, by the engineer" },
      {
        kind: "p",
        text: "Section 7.7 says floor elevations should be measured by the engineer or the engineer's representative after the repair, with copies to the client. Section 7.8 says the engineer should provide a letter of substantial completion stating that the work generally conforms to the documents. Denton asks for a final engineered seal report before its building final.",
      },
      {
        kind: "p",
        text: "That letter is the document a future buyer's agent will ask for. How the repair documents themselves work is set out on [the repair specification page](/services/repair-specifications).",
      },
      { kind: "h2", text: "Where the roles merge" },
      {
        kind: "p",
        text: "Problems start when the party that sells the repair also decides whether it is needed and how large it is. The ASCE Texas guidelines say at section 2.2 that it is essential to avoid conflicts of interest to maintain the credibility of the evaluation. TBPELS rule 137.57(d) requires an engineer whose own financial or business interests could affect their judgment to inform all parties in writing, and to accept the work only if the client confirms its knowledge of the conflict in writing.",
      },
      {
        kind: "p",
        text: "A repair company that employs or retains an engineer is not breaking a rule by doing so. The owner is entitled to know the relationship, and an engineer engaged by the owner has none to disclose. What a free inspection from a repair company can and cannot do is covered in [free foundation inspection versus an engineer](/insights/free-foundation-inspection).",
      },
      {
        kind: "p",
        text: "The board itself has declined to write technical standards for repair methods. In a 2018 response to a request about pier design under slab on grade foundations, it said the Texas Engineering Practice Act does not set specific technical standards, and that it will investigate substantiated complaints against engineers practicing incompetently.",
      },
      {
        kind: "note",
        title: "Licensing of repair contractors, which this post could not confirm",
        body: [
          "A 2013 House committee analysis of C.S.H.B. 613 recorded that interested parties contended the absence of state standards for foundation repair contractors allowed unqualified people to perform repairs, and the bill proposed a TDLR license. This post found no record that a state license for foundation repair contractors exists today, but did not find a source that states its absence either.",
          "Before relying on a contractor's claimed credentials, check them with the agency that is said to issue them.",
        ],
      },
      { kind: "h2", text: "Questions for the engineer" },
      {
        kind: "ul",
        items: [
          "Who are you engaged by, and do you have any relationship with a repair contractor on this job?",
          "Which level of investigation will this be, and will floor elevations be measured?",
          "If repair is warranted, will you prepare sealed repair documents, and will you verify the repair afterwards?",
          "Will the post repair letter state that the work conforms to your documents?",
        ],
      },
      { kind: "h2", text: "Questions for the repair company" },
      {
        kind: "ul",
        items: [
          "Whose sealed documents will the work be built to, and may I see them before signing?",
          "Who pulls the permit, and what does this city require for it?",
          "Is a plumbing test part of the contract where lifting is involved?",
          "Who measures the floor after the work, and who issues the final letter?",
          "What does the warranty cover, who holds it, and does it transfer to a buyer? Get the answers in writing.",
        ],
      },
      {
        kind: "p",
        text: "An owner who engages the engineer first controls the scope, the bids and the final letter. [The foundation inspection page](/services/foundation-inspections) sets out what the evaluation covers, and [the guide to choosing a structural engineer](/structural-engineer/how-to-choose) lists the public checks worth making on any engineer before engaging one.",
      },
    ],
    sources: [
      bcite("occ1001_003", "That consultation, investigation, evaluation, analysis and design are part of the practice of engineering."),
      bcite("occ1001_301", "That the practice and the title engineer are restricted to license holders."),
      bcite("rule137_59", "That engineers shall practice only in their areas of competence."),
      bcite("rule137_57", "The written disclosure and confirmation required where a potential conflict of interest exists."),
      bcite("asceTx", "The licensed engineer requirement, the conflict of interest sentence, the levels of investigation, site specific borings, remediation documents, the engineer of record's approval authority, plumbing testing, repair expectations, post repair elevations and the letter of substantial completion."),
      bcite("houstonPermit", "Houston's requirement for engineer prepared plans showing supports on a slab on grade repair."),
      bcite("dentonPermit", "Denton's permit requirement, sealed letter and plan, and final engineered seal report."),
      bcite("tbpelsRepairResponse", "That the board declined to set technical standards for repair methods and will investigate substantiated complaints."),
      bcite("hb613", "The 2013 committee record of the absence of state standards for foundation repair contractors and the proposed TDLR license."),
    ],
    faqs: [
      {
        q: "Do I need an engineer for foundation repair in Texas?",
        a: "Several cities require engineering on the repair permit, Houston and Denton among them, and the ASCE Texas Section guidelines say the evaluation and repair design shall be performed by a Texas licensed engineer. Where neither applies, an engineer is still the only party who can give an opinion without an interest in the repair.",
      },
      {
        q: "Is a foundation engineer the same as a structural engineer?",
        a: "Foundation engineer describes the work rather than a separate license. The engineer who evaluates a foundation and designs its repair needs competence in that work under TBPELS rule 137.59, and a geotechnical engineer may supply the soil data for a major repair.",
      },
      {
        q: "Can the repair company's engineer be independent?",
        a: "The engineer must disclose a potential conflict of interest in writing and obtain the client's written confirmation under TBPELS rule 137.57. An engineer engaged directly by the owner, with no tie to any contractor, avoids the question.",
      },
      {
        q: "Who issues the final letter after a foundation repair?",
        a: "Under the ASCE Texas Section guidelines, the engineer whose documents the repair was built to should measure the floor afterwards and provide a letter of substantial completion.",
      },
    ],
  },
];

insights.push(...buyerInsights);

/*
 * THE ROOFS SECTION, 2026-10-18. Seven posts in src/content/insights-roofs.ts,
 * wired the way the coastal file is. Plan: docs/blog/roofs-section-plan.md.
 */
insights.push(...roofInsights);

export function insightBySlug(slug: string): Insight | undefined {
  return insights.find((i) => i.slug === slug);
}

/** Newest first, for the hub. Dates are real and set by hand in this file. */
export function insightsByDate(): Insight[] {
  return [...insights].sort((a, b) => b.datePublished.localeCompare(a.datePublished));
}

/*
 * RELATED READING IS CAPPED, AND THE CAP IS WHY A POST'S HEIGHT STOPS GROWING
 * WITH THE CORPUS. Operator ruling, 2026-10-17. The block under every post used
 * to list every other post, so the buyers section put seven cards on every
 * existing post and nine routes crossed the 16000px ceiling without a word of
 * them changing. Six cards, ranked: same section first, then a shared keyword
 * cluster in the registry, then newest. Nothing is orphaned by the cap: the hub
 * and the sitemap still list every post.
 */
export const RELATED_READING_LIMIT = 6;

export type InsightSection = "core" | "coastal" | "buyers" | "roofs";

const COASTAL_SLUGS = new Set(coastalInsights.map((i) => i.slug));
const BUYER_SLUGS = new Set(buyerInsights.map((i) => i.slug));
const ROOF_SLUGS = new Set(roofInsights.map((i) => i.slug));

export function sectionOf(slug: string): InsightSection {
  if (COASTAL_SLUGS.has(slug)) return "coastal";
  if (BUYER_SLUGS.has(slug)) return "buyers";
  if (ROOF_SLUGS.has(slug)) return "roofs";
  return "core";
}

/** The registry cluster of the topic whose 254 angle is this post, or null. */
export function clusterOf(post: Insight): string | null {
  const path = `/insights/${post.slug}`;
  const byPath = topics.find((t) => t.angles["254"]?.path === path);
  if (byPath) return byPath.cluster;
  const byTopic = topics.find((t) => t.topic === post.primaryKeyword);
  return byTopic ? byTopic.cluster : null;
}

export function relatedReading(post: Insight, limit = RELATED_READING_LIMIT): Insight[] {
  const section = sectionOf(post.slug);
  const cluster = clusterOf(post);
  return insights
    .filter((i) => i.slug !== post.slug)
    .map((i) => ({
      i,
      sameSection: sectionOf(i.slug) === section ? 1 : 0,
      sameCluster: cluster !== null && clusterOf(i) === cluster ? 1 : 0,
    }))
    .sort(
      (a, b) =>
        b.sameSection - a.sameSection ||
        b.sameCluster - a.sameCluster ||
        b.i.datePublished.localeCompare(a.i.datePublished) ||
        a.i.slug.localeCompare(b.i.slug),
    )
    .slice(0, limit)
    .map((r) => r.i);
}
