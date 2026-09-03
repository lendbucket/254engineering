/**
 * The protocol certification check: how a technician earns the right to be
 * offered work in a service line.
 *
 * WHAT THIS REPLACES, AND WHY IT HAD TO
 * -------------------------------------
 * Phase 2 shipped the gate without the door. planDispatch refuses anybody whose
 * profile has no certified row for the service line, which is correct, and the
 * only way to get one was an administrator writing it into the table by hand.
 * A gate whose only key is "somebody decided" is a gate that will be opened for
 * whoever is available on a Friday afternoon.
 *
 * WHO WRITES THE QUESTIONS
 * ------------------------
 * The engineer who wrote the protocol, on the same screen, as part of the same
 * document. That is the arrangement the firm runs on: the person who will be
 * held responsible for the work decides what the person collecting it has to
 * understand. Questions live on the protocol version, so a protocol that changes
 * takes its check with it, and a technician certified on version one is
 * certified on version one.
 *
 * EVERY QUESTION MUST BE RIGHT, AND RETAKES ARE FREE
 * --------------------------------------------------
 * There is no percentage pass mark, and the absence is deliberate. A partial
 * pass means a technician who does not know which photograph is required is
 * dispatched anyway, and there is no such thing as eighty percent of an evidence
 * package: the missing frame is missing, the engineer cannot seal, and somebody
 * drives back.
 *
 * The pressure that would normally build against a strict mark is released the
 * other way instead. A wrong answer shows the reasoning immediately, the
 * technician can retake straight away, and every attempt is counted rather than
 * held against them. The check is there to teach the protocol, not to rank
 * people, and a check that fails somebody without telling them why has taught
 * nothing.
 *
 * WHY THE ANSWER KEY IS NEVER SENT TO THE BROWSER
 * -----------------------------------------------
 * gradeAttempt runs on the server. The questions a technician receives are
 * stripped of correctIndex and rationale by the route that serves them, and the
 * rationale for a question comes back only after it has been answered wrongly.
 * A check whose answers are in the page source is a formality, and a formality
 * that produces a certification record is worse than no record at all.
 */

export type CheckQuestion = {
  id: string;
  prompt: string;
  options: string[];
  /** Index into options. Never serialized to a technician. */
  correctIndex: number;
  /** Shown after a wrong answer. Never serialized before one. */
  rationale: string;
};

/** A question as a technician receives it. */
export type PublicQuestion = { id: string; prompt: string; options: string[] };

export function forTechnician(questions: CheckQuestion[]): PublicQuestion[] {
  return questions.map((q) => ({ id: q.id, prompt: q.prompt, options: q.options }));
}

export type Answer = { questionId: string; optionIndex: number };

export type Grade = {
  total: number;
  correct: number;
  /** Percentage, rounded, for the certification record. */
  score: number;
  passed: boolean;
  wrong: { questionId: string; prompt: string; rationale: string }[];
  /** Questions that were never answered, counted as wrong and named as skipped. */
  unanswered: string[];
};

/**
 * Grade an attempt.
 *
 * An unanswered question is wrong. It is also called out separately, because
 * "you missed three" and "you skipped three" are different things to tell
 * somebody and only one of them is about understanding the protocol.
 */
export function gradeAttempt(questions: CheckQuestion[], answers: Answer[]): Grade {
  const given = new Map(answers.map((a) => [a.questionId, a.optionIndex]));
  const wrong: Grade["wrong"] = [];
  const unanswered: string[] = [];
  let correct = 0;

  for (const q of questions) {
    const answer = given.get(q.id);
    if (answer === undefined || answer === null) {
      unanswered.push(q.id);
      wrong.push({ questionId: q.id, prompt: q.prompt, rationale: q.rationale });
      continue;
    }
    if (answer === q.correctIndex) {
      correct++;
      continue;
    }
    wrong.push({ questionId: q.id, prompt: q.prompt, rationale: q.rationale });
  }

  const total = questions.length;
  return {
    total,
    correct,
    score: total === 0 ? 0 : Math.round((correct / total) * 100),
    /*
     * An empty check never passes. A protocol with no questions is a protocol
     * whose author has not said what matters yet, and certifying somebody
     * against it would be certifying them against nothing.
     */
    passed: total > 0 && correct === total,
    wrong,
    unanswered,
  };
}

export type CertificationStatus = "in_progress" | "certified" | "failed" | "revoked";

export type CertificationRecord = {
  serviceSlug: string;
  status: CertificationStatus;
  templateId: string | null;
  score: number | null;
  attempts: number;
};

/**
 * May this technician sit the check for this service line?
 *
 * A revoked certification is the one that does not simply retake. Revocation is
 * an act by the engineer in responsible charge, and letting somebody undo it by
 * passing a multiple choice check twenty minutes later would make revocation
 * meaningless. It comes back by the same route it went: a person deciding.
 */
export function canAttempt(
  certification: CertificationRecord | null,
): { ok: true } | { ok: false; reason: string } {
  if (!certification) return { ok: true };
  if (certification.status === "revoked") {
    return {
      ok: false,
      reason:
        "This certification was revoked. It is restored by the engineer who revoked it, not by " +
        "retaking the check.",
    };
  }
  if (certification.status === "certified") {
    return { ok: false, reason: "You are already certified on this service line." };
  }
  return { ok: true };
}

/**
 * Whether a certification still covers the protocol version in force.
 *
 * A technician certified on version one of a protocol is certified on version
 * one. When the engineer publishes version two the old certification is stale,
 * and this is what says so.
 *
 * IT WARNS RATHER THAN BLOCKS, AND THAT IS A JUDGMENT CALL
 * --------------------------------------------------------
 * Blocking would empty the dispatch pool the moment an engineer fixes a typo in
 * a protocol, and the pressure that creates is on the engineer not to improve
 * the protocol. Recorded as a call rather than a certainty: if a version bump
 * ever carries a material change, the honest answer is for the engineer to
 * revoke the certifications that version supersedes, which is an act they can
 * already take and which this deliberately does not do for them.
 */
export function isStale(certification: CertificationRecord, publishedTemplateId: string | null): boolean {
  if (certification.status !== "certified") return false;
  if (!publishedTemplateId || !certification.templateId) return false;
  return certification.templateId !== publishedTemplateId;
}

/** A line for the roster and the technician's own profile. */
export function certificationLabel(certification: CertificationRecord | null): string {
  if (!certification) return "Not started";
  switch (certification.status) {
    case "certified":
      return certification.attempts > 1
        ? `Certified, ${certification.attempts} attempts`
        : "Certified";
    case "failed":
      return `Not passed yet, ${certification.attempts} attempt${certification.attempts === 1 ? "" : "s"}`;
    case "revoked":
      return "Revoked";
    default:
      return "In progress";
  }
}
