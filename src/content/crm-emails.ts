import type { CrmVertical } from "@/lib/crm-rules";

/**
 * THE SEQUENCE EMAILS, ONE PER VERTICAL. Robert's sales CRM ruling of
 * 2026-11-02, item R7, drafted for his approval and APPROVED AS DRAFTED the
 * same day (issue #1 comment 6587551356). The subjects of the prelaunch
 * variants say "for when it opens": the draft's "opening soon" was changed to
 * that before it was posted, because a launch date is not the firm's to
 * promise.
 *
 * TWO VARIANTS, AND THE GATE CHOOSES, exactly as for the call scripts
 * (src/content/crm-scripts.ts): "open" only when the line the email names is
 * sellable by the test the order pages use, decided by the server for each
 * send (src/lib/crm-email.ts); "prelaunch" otherwise. The line each vertical
 * reads is the scripts' SCRIPT_LINE, so a call and the email after it never
 * disagree about whether the line is open.
 *
 * NO FIGURE IS TYPED. {{price:<slug>}}, {{price:<slug>:<tier>}} and
 * {{coastal}} come from the price book and the catalogue, {{contact}},
 * {{company}} and {{rep}} from the company and the sender, {{order_url}} from
 * the line's order start page, {{phone}} from displayPhone(). The ongoing
 * WPI-8 tier is never priced: it is "quoted". The renderer refuses an email
 * naming a placeholder it does not know (src/lib/crm-email-rules.ts).
 *
 * The solar email follows Robert's ruling of 2026-10-30 as the solar script
 * does: a solar company in a city on SOLAR_WIND_LOAD_CITIES gets the "other"
 * email, never the solar pitch.
 */

export const EMAILS_APPROVED = { by: "Robert Reyna", on: "2026-11-02", record: "issue #1 comment 6587551356" } as const;

export type EmailVariant = { subject: string; body: string[]; signOff: string };
export type EmailPair = { open: EmailVariant; prelaunch: EmailVariant };

const OPEN_SIGN_OFF = "{{rep}}, 254 Engineering, {{phone}}";
const PRELAUNCH_SIGN_OFF = "{{rep}}, 254 Engineering";

export const CRM_EMAILS: Record<CrmVertical, EmailPair> = {
  roofer: {
    open: {
      subject: "Roof certification letters for your customers",
      body: [
        "{{contact}}, I called earlier about roof certification letters, the letter a lender or insurer asks for after a roof is done. It is {{price:roof-inspections}}, plus {{coastal}} in the first tier coastal counties, and it is ordered here: {{order_url}}. If an account for {{company}} would make it simpler to order for customers, reply and I will set one up.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Roof certification letters in Texas, for when it opens",
      body: [
        "{{contact}}, I called earlier. 254 Engineering is getting ready to offer roof certification letters statewide. Reply to this email and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  solar: {
    open: {
      subject: "Structural letters for rooftop solar",
      body: [
        "{{contact}}, following up on my call. The structural letter a permit office asks for, showing the roof can carry the array, is {{price:solar-structural-letters}} and ordered here: {{order_url}}. Reply if you would like an account for {{company}}.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Structural letters for rooftop solar, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is preparing to offer structural letters for rooftop solar. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  manufactured_home_dealer: {
    open: {
      subject: "Foundation certifications for FHA, VA and USDA loans",
      body: [
        "{{contact}}, following up on my call. The manufactured home foundation certification FHA, VA and USDA loans ask for is {{price:manufactured-home-foundation-certifications}} and ordered here: {{order_url}}. Reply if an account would help {{company}} order for buyers.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Manufactured home foundation certifications, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is getting ready to offer foundation certifications for manufactured homes. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  foundation_repair: {
    open: {
      subject: "Foundation inspections and repair specifications",
      body: [
        "{{contact}}, following up on my call. A foundation inspection is {{price:foundation-inspections}} and a repair specification, the written scope a repair is bid and permitted against, is {{price:repair-specifications}}. Both are ordered here: {{order_url}}.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Foundation inspections and repair specifications, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is preparing to offer foundation inspections and repair specifications across Texas. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  real_estate: {
    open: {
      subject: "The engineering letters a closing waits on",
      body: [
        "{{contact}}, following up on my call. Roof certifications, foundation letters and, on the coast, windstorm certificates are ordered online with the price shown first. A roof certification is {{price:roof-inspections}}. Your clients can order here: {{order_url}}.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Engineering letters for closings, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is getting ready to offer the engineering letters a transaction stalls on. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  lender: {
    open: {
      subject: "Engineer's letters your underwriters ask for",
      body: [
        "{{contact}}, following up on my call. Roof certifications, foundation letters and manufactured home foundation certifications are ordered online with the price shown first, starting at {{price:roof-inspections}}: {{order_url}}. Reply if your team would like an account.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Engineer's letters for underwriting, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is preparing to offer the engineering letters underwriters ask for. Reply and your team will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  insurance_agent: {
    open: {
      subject: "WPI-8E evaluations and roof certifications",
      body: [
        "{{contact}}, following up on my call. A WPI-8E evaluation of completed construction is {{price:windstorm-wpi-8:completed}}, plus {{coastal}} in the first tier coastal counties; ongoing construction is quoted. Roof certifications for carriers are {{price:roof-inspections}}. Both are ordered here: {{order_url}}.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Windstorm and roof certifications, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is getting ready to offer windstorm WPI-8 certifications and roof certifications. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
  other: {
    open: {
      subject: "Engineering letters for Texas properties",
      body: [
        /* Reworded on Robert's answer 1 to issue #1 6592143963 (2026-11-02): the approved sentence named the firm in the present tense, which the voice rule refuses with the gate shut; the exemption was not widened. */
        "{{contact}}, following up on my call. Engineering letters for homes and small commercial buildings across Texas are ordered online with the price shown first: {{order_url}}.",
      ],
      signOff: OPEN_SIGN_OFF,
    },
    prelaunch: {
      subject: "Engineering letters for Texas properties, for when it opens",
      body: [
        "{{contact}}, following up on my call. 254 Engineering is preparing to offer engineering letters for homes and small commercial buildings across Texas. Reply and you will hear the day it opens.",
      ],
      signOff: PRELAUNCH_SIGN_OFF,
    },
  },
};
