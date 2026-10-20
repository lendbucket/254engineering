/**
 * The call log's vocabulary, client safe so the panel and the server read one
 * list. Matches the check constraints in 0079.
 */
export const CONTACT_SUBJECTS = ["prospect", "client", "order", "file"] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_CHANNELS = ["call", "email", "note"] as const;
export type ContactChannel = (typeof CONTACT_CHANNELS)[number];

export const CONTACT_OUTCOMES = [
  "reached",
  "voicemail",
  "no_answer",
  "wrong_number",
  "sent",
  "replied",
  "interested",
  "not_interested",
  "visit_time_set",
] as const;
export type ContactOutcome = (typeof CONTACT_OUTCOMES)[number];

export const OUTCOME_LABEL: Record<ContactOutcome, string> = {
  reached: "Reached them",
  voicemail: "Left a voicemail",
  no_answer: "No answer",
  wrong_number: "Wrong number",
  sent: "Sent",
  replied: "They replied",
  interested: "Interested",
  not_interested: "Not interested",
  visit_time_set: "Visit time agreed",
};

/** Which outcomes make sense on which channel, so the form offers only those. */
export const OUTCOMES_FOR: Record<Exclude<ContactChannel, "note">, ContactOutcome[]> = {
  call: ["reached", "voicemail", "no_answer", "wrong_number", "interested", "not_interested"],
  email: ["sent", "replied", "interested", "not_interested"],
};
