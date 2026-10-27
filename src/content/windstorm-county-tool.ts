import { allCounties } from "./regions";
import { FIRST_TIER_COASTAL, FIRST_TIER_COUNT } from "./windstorm";
import { HARRIS_DESIGNATED_CITIES, HARRIS_DESIGNATION, TDI_WINDSTORM_SOURCE } from "./windstorm-harris";

/**
 * THE WINDSTORM COUNTY CHECK. Robert's answers 16 and 17 of 2026-10-26, and
 * ruling 3 of 2026-10-27.
 *
 * IT TAKES A COUNTY, NEVER AN ADDRESS. Placing an address against State Highway
 * 146 needs a geocoder, which means a cost, a key, and visitors' addresses sent
 * to a third party (answer 16). For Harris it says what the department says and
 * that the county alone cannot settle it.
 *
 * IT TYPES NO COUNTY LIST. The 254 come from the coverage regions, the fourteen
 * from FIRST_TIER_COASTAL, and the Harris answer from ./windstorm-harris.ts, so
 * the tool cannot disagree with the pages around it.
 *
 * Every answer is computed here, on the server, for every county, and handed to
 * the client component as data. The component chooses which one to show and
 * decides nothing.
 */
export type WindstormCountyStatus = "designated" | "part" | "not-designated";

export type WindstormCountyAnswer = {
  county: string;
  status: WindstormCountyStatus;
  text: string;
};

const FIRST_TIER = new Set<string>(FIRST_TIER_COASTAL);

export function windstormCountyAnswer(county: string): WindstormCountyAnswer | null {
  const wanted = county.trim().replace(/\s+county$/i, "").toLowerCase();
  const canonical = allCounties.find((c) => c.toLowerCase() === wanted);
  if (!canonical) return null;

  if (canonical === "Harris") {
    return {
      county: canonical,
      status: "part",
      text:
        `Only part of Harris County is inside the designated catastrophe area. The Texas Department of Insurance designates ${HARRIS_DESIGNATION}. ` +
        `The county alone cannot settle whether a property is inside: check whether the property is in one of those ${HARRIS_DESIGNATED_CITIES.length} cities, and confirm with the department.`,
    };
  }

  if (FIRST_TIER.has(canonical)) {
    return {
      county: canonical,
      status: "designated",
      text: `${canonical} County is one of the ${FIRST_TIER_COUNT} first tier coastal counties, and the whole county is inside the designated catastrophe area. The windstorm inspection program and its certificate apply anywhere in it.`,
    };
  }

  return {
    county: canonical,
    status: "not-designated",
    text: `${canonical} County is outside the designated catastrophe area, so the windstorm inspection program and its certificate do not apply there. Wind design still applies everywhere in Texas, through the building code and the ordinary permit.`,
  };
}

/** One answer per Texas county, alphabetical, for the client component. */
export function windstormCountyAnswers(): WindstormCountyAnswer[] {
  return [...allCounties]
    .sort((a, b) => a.localeCompare(b))
    .map((c) => windstormCountyAnswer(c))
    .filter((a): a is WindstormCountyAnswer => a !== null);
}

export { TDI_WINDSTORM_SOURCE };
