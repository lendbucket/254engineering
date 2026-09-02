import type { Actor } from "./ops-authz";

/**
 * Dispatch: who gets offered a job, in what order, and for how much.
 *
 * PURE, SO THE RANKING CAN BE ARGUED WITH
 * ---------------------------------------
 * Nothing here touches a database. It takes the file, the candidate technicians,
 * and the fee schedule, and returns an ordered list of offers. That means the
 * ranking can be tested exhaustively and, more importantly, that a technician
 * who asks "why did he get that job and I did not" has an answer somebody can
 * read out of one file.
 *
 * THE FOUR HARD FILTERS COME FIRST, AND NONE OF THEM IS A PREFERENCE
 * ------------------------------------------------------------------
 * A technician is eligible only if all four hold. These are not weighted, they
 * are gates, because each one represents work the person is not permitted or not
 * equipped to do:
 *
 *   Coverage. The property's county must be in their coverage list. Offering
 *   work in a county somebody does not cover wastes their time and the file's.
 *
 *   Certification. They must be certified for that service line. This is the
 *   Phase 3 protocol certification, and it is the one that carries real
 *   consequence: an uncertified technician working a windstorm inspection
 *   produces evidence an engineer cannot rely on.
 *
 *   Status. Active accounts only. A suspended technician is suspended.
 *
 *   Credentials. A current driver licence, vehicle insurance, W-9 and contractor
 *   agreement. Added in Phase 3, and the reason it was not here from the start
 *   is worth keeping: the documents were being collected by the onboarding
 *   system and nothing joined them to dispatch, so a lapsed insurance
 *   certificate stopped nothing. The blockers are computed by ops-credentials
 *   and arrive here already decided, so this module stays free of dates.
 *
 * The order of the four is the order an operator can act on them. Status first,
 * because a suspended account explains everything else. Then coverage, then
 * certification, then credentials, which is the one most likely to be a phone
 * call rather than a decision.
 *
 * THEN THE RANKING, WHICH IS A PREFERENCE AND SAYS SO
 * ---------------------------------------------------
 * Load first, then proximity. Load first because a technician holding four open
 * jobs is a slower answer than one holding none, whatever the mileage, and
 * because spreading work is how a bench stays a bench. Proximity second because
 * it is real money in fuel and hours but it is not worth stacking a fifth job on
 * somebody to save twenty miles.
 *
 * Distance is measured base to property in straight line miles. It is honest
 * about being a straight line: this is a tie break for ordering offers, not an
 * estimate of drive time, and calling it drive time would be a number nobody
 * could defend.
 */

export type TechCandidate = {
  id: string;
  displayName: string;
  status: "invited" | "active" | "suspended";
  coverageCounties: string[];
  baseLat?: number | null;
  baseLng?: number | null;
  /** Service lines this technician has passed the protocol check for. */
  certifiedFor: string[];
  /**
   * Why this technician's paperwork stops them, already decided.
   *
   * Passed in rather than computed here so this module never has to know what
   * today is. A pure function that reads the clock is a pure function that
   * cannot be tested at a date of the caller's choosing, and every expiry rule
   * in ops-credentials is exactly that kind of test.
   */
  credentialBlockers?: string[];
  /** Files currently assigned and not finished. */
  openJobs: number;
};

export type DispatchSubject = {
  county: string;
  serviceSlug: string;
  lat?: number | null;
  lng?: number | null;
};

export type Ineligible = { id: string; displayName: string; reason: string };

export type Offer = {
  techId: string;
  displayName: string;
  rank: number;
  distanceMiles: number | null;
  openJobs: number;
  amountCents: number | null;
};

export type DispatchPlan = {
  offers: Offer[];
  ineligible: Ineligible[];
};

/** Great circle distance in miles. Straight line, and the caller is told so. */
export function milesBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

const normalizeCounty = (c: string) => c.trim().replace(/\s+county$/i, "").toLowerCase();

/**
 * Build the offer list for a file.
 *
 * `ineligible` is returned alongside, with the reason each person was excluded,
 * because "nobody was offered this job" is the single most confusing state an
 * operator can meet and the answer is almost always one of these three lines.
 */
export function planDispatch(
  subject: DispatchSubject,
  candidates: TechCandidate[],
  feeCents: number | null,
): DispatchPlan {
  const offers: Offer[] = [];
  const ineligible: Ineligible[] = [];
  const county = normalizeCounty(subject.county);

  for (const tech of candidates) {
    if (tech.status !== "active") {
      ineligible.push({ id: tech.id, displayName: tech.displayName, reason: `Account is ${tech.status}.` });
      continue;
    }
    if (!tech.coverageCounties.some((c) => normalizeCounty(c) === county)) {
      ineligible.push({
        id: tech.id,
        displayName: tech.displayName,
        reason: `Does not cover ${subject.county} County.`,
      });
      continue;
    }
    if (!tech.certifiedFor.includes(subject.serviceSlug)) {
      ineligible.push({
        id: tech.id,
        displayName: tech.displayName,
        reason: "Not certified for this service line.",
      });
      continue;
    }
    if (tech.credentialBlockers?.length) {
      ineligible.push({
        id: tech.id,
        displayName: tech.displayName,
        reason: tech.credentialBlockers.join(" "),
      });
      continue;
    }

    const distance =
      subject.lat != null && subject.lng != null && tech.baseLat != null && tech.baseLng != null
        ? milesBetween({ lat: tech.baseLat, lng: tech.baseLng }, { lat: subject.lat, lng: subject.lng })
        : null;

    offers.push({
      techId: tech.id,
      displayName: tech.displayName,
      rank: 0,
      distanceMiles: distance,
      openJobs: tech.openJobs,
      amountCents: feeCents,
    });
  }

  offers.sort((a, b) => {
    if (a.openJobs !== b.openJobs) return a.openJobs - b.openJobs;
    // A known distance beats an unknown one: an unranked candidate should not
    // outrank somebody the platform can actually place.
    if (a.distanceMiles == null && b.distanceMiles == null) return a.displayName.localeCompare(b.displayName);
    if (a.distanceMiles == null) return 1;
    if (b.distanceMiles == null) return -1;
    if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
    return a.displayName.localeCompare(b.displayName);
  });

  offers.forEach((o, i) => (o.rank = i + 1));
  return { offers, ineligible };
}

/**
 * Whether an offer may still be accepted.
 *
 * FIRST ACCEPTANCE WINS, AND THE LOSERS ARE TOLD WHY
 * ---------------------------------------------------
 * Several technicians hold the same offer at once. When one accepts, the rest
 * are withdrawn. A withdrawn offer that still looked live would have somebody
 * driving to a job that is not theirs, so the refusal here is explicit rather
 * than a silent no-op.
 */
export type OfferState = "offered" | "accepted" | "declined" | "withdrawn" | "expired";

export function canRespondToOffer(
  actor: Actor | null,
  offer: { techId: string; state: OfferState; expiresAt?: string | null },
  fileAlreadyAssigned: boolean,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (!actor || actor.status !== "active") return { ok: false, reason: "You are not signed in." };
  if (actor.role !== "field_tech" && actor.role !== "admin") {
    return { ok: false, reason: "Only a technician can respond to a job offer." };
  }
  if (actor.role === "field_tech" && offer.techId !== actor.id) {
    return { ok: false, reason: "That offer is not yours." };
  }
  if (offer.state === "accepted") return { ok: false, reason: "You have already accepted this job." };
  if (offer.state === "declined") return { ok: false, reason: "You declined this job." };
  if (offer.state === "withdrawn") {
    return { ok: false, reason: "Another technician accepted this job first." };
  }
  if (offer.state === "expired") return { ok: false, reason: "This offer has expired." };
  if (offer.expiresAt && new Date(offer.expiresAt).getTime() <= now.getTime()) {
    return { ok: false, reason: "This offer has expired." };
  }
  if (fileAlreadyAssigned) {
    return { ok: false, reason: "Another technician accepted this job first." };
  }
  return { ok: true };
}
