import { selfServiceSignUp } from "@/config/launch-conditions";
import { insuranceOverride } from "@/config/credentials";
import { sisterOrdering } from "@/config/sister-ordering";
import { insuranceStandsOn } from "./launch";

/**
 * THE SWITCHES STATED IN CONFIGURATION THAT STAFF ASK TO FLIP FROM A SCREEN,
 * READ STRAIGHT OFF THE CONFIGURATION, for the launch screen's panel.
 *
 * Robert's W2 ruling of 2026-10-27 asked for screens to turn on self-service
 * sign-up and to set and clear the insurance override. Each is a gate condition
 * held in a file, and the gate may read the database for a signed protocol and
 * nothing else (CLAUDE.md section 1, ruling 11). So these rows SHOW each switch
 * and the edit that changes it; nothing here writes. Every field is read from
 * the declaration, so the panel cannot say a switch stands where it does not.
 */
export type ConfigSwitch = {
  name: string;
  state: string;
  tone: "good" | "warn" | "neutral";
  detail: string;
  setBy: string;
  edit: string;
};

export function configSwitches(today?: string): ConfigSwitch[] {
  const standing = insuranceStandsOn(today);
  const insurance: ConfigSwitch =
    standing.on === "policy"
      ? {
          name: "Insurance override",
          state: "Not needed",
          tone: "good",
          detail: "A professional liability policy is on record, so the gate stands on the policy and the override, if any, is not read.",
          setBy: insuranceOverride ? `${insuranceOverride.acknowledgedBy}, ${insuranceOverride.acknowledgedOn}` : "Nobody",
          edit: "Nothing to change. A policy is recorded in verifiedInsurance in src/config/credentials.ts.",
        }
      : standing.on === "override"
        ? {
            name: "Insurance override",
            state: `In force to ${standing.expires}`,
            tone: "warn",
            detail: `The gate's insurance condition stands on the owner's decision, not on a policy: ${standing.override.reason}. It stops counting the day after ${standing.expires}, with no edit, and ends the day a policy is recorded.`,
            setBy: `${standing.override.acknowledgedBy}, ${standing.override.acknowledgedOn}`,
            edit: "To extend or end it: insuranceOverride in src/config/credentials.ts (its expires date, or null), then deploy.",
          }
        : {
            name: "Insurance override",
            state: "Not in force",
            tone: "warn",
            detail: standing.why,
            setBy: insuranceOverride ? `${insuranceOverride.acknowledgedBy}, ${insuranceOverride.acknowledgedOn}` : "Nobody",
            edit: "To set it: insuranceOverride in src/config/credentials.ts with who, when, a reason and an expiry date, then deploy.",
          };

  const signUp: ConfigSwitch = {
    name: "Self-service sign-up",
    state: selfServiceSignUp.cleared ? "Cleared" : "Not cleared",
    tone: selfServiceSignUp.cleared ? "good" : "warn",
    detail: selfServiceSignUp.cleared
      ? "Cleared for production. The sign-up page takes new accounts once the gate is open; while it is shut, the page says so."
      : `Not cleared for production. ${selfServiceSignUp.because}`,
    setBy: selfServiceSignUp.clearedBy ? `${selfServiceSignUp.clearedBy}, ${selfServiceSignUp.clearedOn ?? "date not recorded"}` : "Nobody",
    edit: "selfServiceSignUp in src/config/launch-conditions.ts (cleared, clearedBy, clearedOn, because), then deploy.",
  };

  const sisters: ConfigSwitch[] = (Object.entries(sisterOrdering) as [string, (typeof sisterOrdering)["sealed"]][]).map(([site, s]) => ({
    name: site === "sealed" ? "Sealed Engineering orders" : site === "stamp" ? "StampMyPlans orders" : `Orders from ${site}`,
    state: s.open ? "Open" : "Closed",
    tone: s.open ? "good" : "neutral",
    detail: s.because,
    setBy: s.openedBy ? `${s.openedBy}, ${s.openedOn ?? "date not recorded"}` : "Nobody has opened it",
    edit: `sisterOrdering.${site} in src/config/sister-ordering.ts, then deploy. The hand-off is docs/sealed-order-handoff.md.`,
  }));

  return [signUp, insurance, ...sisters];
}
