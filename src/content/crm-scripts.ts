import type { CrmVertical } from "@/lib/crm-rules";

/**
 * THE CALL SCRIPTS, ONE PER VERTICAL. Robert's sales CRM ruling of 2026-11-02,
 * item R3, drafted for his approval and APPROVED AS DRAFTED the same day
 * (issue #1 comments 6587550851 and his answer relayed in session): "Scripts
 * may show to reps once R3 merges."
 *
 * TWO VARIANTS, AND THE GATE CHOOSES. "open" is shown only when the line the
 * script names is sellable, by the same test the order pages use
 * (lineIsSellableForDisplay); "prelaunch" otherwise, and it describes what the
 * firm is built to deliver and offers the waitlist, never a present tense
 * service claim. The choice is made by the server for each card
 * (src/lib/crm-queue.ts), never by the rep.
 *
 * NO FIGURE IS TYPED. {{price:<slug>}} and {{price:<slug>:<tier>}} come from
 * the price book (deliverablePriceCents), {{coastal}} from the catalogue's
 * published coastal addition, {{rep}}, {{contact}} and {{company}} from the
 * card. The ongoing WPI-8 tier is never priced: it is "quoted". No engineer's
 * name or licence number, no counts, years, client names or turnaround
 * promises appear anywhere. Every placeholder a script uses must be one the
 * renderer knows, or the card refuses to draw the script (crm-script-render.ts).
 *
 * THE SOLAR SCRIPT AND ROBERT'S RULING OF 2026-10-30: "Until I say otherwise,
 * do not promote solar letters for cities whose published submittal asks for
 * wind loads." The cities are SOLAR_WIND_LOAD_CITIES below; a solar company
 * there is shown the "other" script and the reason, never the solar pitch.
 */

export const SCRIPTS_APPROVED = { by: "Robert Reyna", on: "2026-11-02", record: "issue #1 comment 6587550851" } as const;

/** Every script ends the same way. */
export const SCRIPT_CLOSE =
  "If they are not interested, say thank you and record Not interested with their reason. If they ask not to be called, record Do not call before hanging up.";

export type ScriptPair = { open: string; prelaunch: string };

/** Which service line, and which tier, decides a vertical's variant. */
export const SCRIPT_LINE: Record<CrmVertical, { serviceSlug: string; tier?: string }> = {
  roofer: { serviceSlug: "roof-inspections" },
  solar: { serviceSlug: "solar-structural-letters" },
  manufactured_home_dealer: { serviceSlug: "manufactured-home-foundation-certifications" },
  foundation_repair: { serviceSlug: "foundation-inspections" },
  real_estate: { serviceSlug: "roof-inspections" },
  lender: { serviceSlug: "roof-inspections" },
  insurance_agent: { serviceSlug: "windstorm-wpi-8", tier: "completed" },
  /* The general script names no single line; it opens with the roof line, the first one offered. */
  other: { serviceSlug: "roof-inspections" },
};

export const CRM_SCRIPTS: Record<CrmVertical, ScriptPair> = {
  roofer: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering in San Antonio. We issue roof certification letters for homes in Texas, the letter a buyer's lender or insurer asks for. I'm calling roofers because you're often the first person the homeowner asks. The letter is {{price:roof-inspections}}, plus {{coastal}} in the first tier coastal counties, and it's ordered online. Would it help if I set you up with an account so you can order for your customers?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering in San Antonio. The firm is getting ready to offer roof certification letters statewide, the letter lenders and insurers ask for after a roof is replaced. I'm calling roofers ahead of opening. Can I put you on the list to hear the day it opens, and send you what the letter will cover?",
  },
  solar: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. We write structural letters for rooftop solar, the letter a permit office asks for to show the roof can carry the array. It's {{price:solar-structural-letters}} and ordered online. How are you handling those letters today?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is preparing to offer structural letters for rooftop solar, the letter a permit office asks for about the roof carrying the array. Could I add you to the list for when it opens?",
  },
  manufactured_home_dealer: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. We provide foundation certifications for manufactured homes, the letter FHA, VA and USDA loans ask for. It's {{price:manufactured-home-foundation-certifications}} and ordered online. When one of your buyers needs that letter, who do you send them to now?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is getting ready to offer foundation certifications for manufactured homes, the letter FHA, VA and USDA loans ask for. May I add you to the list for the day it opens?",
  },
  foundation_repair: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. We do foundation inspections and repair specifications, the written scope a repair can be bid and permitted against. An inspection is {{price:foundation-inspections}} and a repair specification is {{price:repair-specifications}}. Do your customers ever ask for an engineer's letter before or after a repair?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is preparing to offer foundation inspections and repair specifications across Texas. Could I put you on the list to hear when it opens?",
  },
  real_estate: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. When a buyer's lender or insurer asks for a roof certification, a foundation letter, or a windstorm certificate on the coast, those are ordered online with the price shown before anyone pays. A roof certification is {{price:roof-inspections}}. Could I send you the page your clients can order from?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is getting ready to offer the engineering letters a transaction stalls on: roof certifications, foundation letters and windstorm certificates on the coast. May I add you to the list for when it opens?",
  },
  lender: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. When an appraisal or an underwriter calls for an engineer's letter, a roof certification, a foundation letter, or a manufactured home foundation certification, those are ordered online with the price shown first. Who on your team orders those today?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is preparing to offer the engineering letters underwriters ask for: roof certifications, foundation letters and manufactured home foundation certifications. Could I add your team to the list for the day it opens?",
  },
  insurance_agent: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. On the coast, a WPI-8E evaluation of completed construction is {{price:windstorm-wpi-8:completed}}, plus {{coastal}} in the first tier counties; ongoing construction is quoted. We also write roof certifications for carriers that ask for one. When a policyholder needs either, where do you send them now?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering. The firm is getting ready to offer windstorm WPI-8 certifications on the coast and roof certifications for carriers. May I add you to the list for when it opens?",
  },
  other: {
    open:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering in San Antonio. We provide engineering letters for homes and small commercial buildings across Texas, ordered online with the price shown first. What kind of property work does {{company}} do?",
    prelaunch:
      "Hi {{contact}}, this is {{rep}} with 254 Engineering in San Antonio. The firm is preparing to offer engineering letters for homes and small commercial buildings across Texas. Could I put you on the list for when it opens?",
  },
};

/**
 * THE CITIES WHOSE PUBLISHED SOLAR SUBMITTAL ASKS FOR WIND LOADS, for Robert's
 * ruling of 2026-10-30. Read from the published checklists the firm's own
 * article cites (src/content/insights.ts, the solar letter post: Waxahachie's
 * checklist asks for wind uplift, Houston's for wind design at the address).
 * A city is added here when its checklist is read and found to ask; nothing
 * here is inferred.
 */
export const SOLAR_WIND_LOAD_CITIES: readonly string[] = ["Waxahachie", "Houston"];

export const SOLAR_WIND_LOAD_NOTE =
  "Do not pitch the solar letter to this company: its city's published checklist asks for wind loads, and the solar letter is not promoted there (Robert, 2026-10-30). Use the general script below.";
