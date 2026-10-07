import type { IntakeField } from "./intake-fields";
import { PROTOCOL_ENTRIES, type ProtocolEntry } from "@/content/protocols";
import { PROTOCOL_PHRASING } from "./protocol-phrasing";

/** The customer fields a line's protocol supersedes, because it asks the same fact. */
export function supersededFields(serviceSlug: string): Set<string> {
  const out = new Set<string>();
  for (const p of PROTOCOL_ENTRIES.filter((e) => e.declaration.serviceSlug === serviceSlug)) {
    for (const words of Object.values(PROTOCOL_PHRASING[p.declaration.documentNumber]?.questions ?? {})) {
      if ("supersedes" in words) for (const id of words.supersedes ?? []) out.add(id);
    }
  }
  return out;
}

/**
 * A PROTOCOL'S INTAKE QUESTIONS, AS INTAKE FIELDS. DERIVED, NEVER TYPED TWICE.
 *
 * Operator ruling, 2026-09-16: the sixteen questions of 254-RC-001 Appendix A
 * drive web, phone and partner through the ONE field definition that is already
 * standing law, which is `data/intake-fields.ts`.
 *
 * WHY THIS DERIVES INSTEAD OF LISTING. The questions already exist, transcribed
 * from the signed PDF and proved against it by `protocol-registry-audit`.
 * Writing them out again here would be a second home for one fact, which this
 * repository has now ruled on four times in a fortnight: the firm registration
 * number, the compliance sentence, the telephone number, the firm's name, the
 * PE licence. Every time the answer was one home and a deriver.
 *
 * So there is one home, `src/content/protocols/rc-001*.ts`, and this maps it
 * into the shape the intake surfaces already render. Change the document,
 * reissue the protocol, and every surface follows without anybody editing a
 * form.
 *
 * WHY IT SITS IN data/ RATHER THAN src/. `fieldsFor` is the one definition of
 * what a job needs, and it lives here. A second source of fields in src/ would
 * recreate exactly the problem intake-fields.ts was written to solve: three
 * surfaces with three ideas of a complete job. Only `keyword-registry.ts` is
 * synchronized verbatim across the three repositories, so a firm-specific
 * protocol import here breaks nothing elsewhere.
 */

/**
 * THE FLAG QUESTIONS NEED A MACHINE READABLE YES, AND THE PAPER FORM DOES NOT
 * HAVE ONE. Disclosed as a judgement rather than buried.
 *
 * Appendix A gives every question a single free "Answer: ____" line. Section 6
 * says "A yes to any flag question in Appendix A routes the job to the engineer
 * before dispatch", so the document itself presupposes that questions 8 to 12
 * are answerable yes or no; a free line cannot be routed on.
 *
 * So a flag question is asked as a yes or no, with the document's own wording
 * as the label, and the detail the question asks for is captured beside it in a
 * second field carrying the same question number. Nothing is invented: question
 * 12 asks for "Date and type (hail/wind)" and question 11 for disclosure, and
 * those answers need somewhere to go.
 *
 * IT IS STILL A QUESTION FOR THE ENGINEER, raised in the report: is yes or no
 * plus the detail what he intends, or does he want the single free line the
 * paper form has, with a person deciding what counts as a yes?
 */
const FLAG_DETAIL_SUFFIX = "_detail";

/** Where each Appendix A group lands among the groups the screens already render. */
function groupFor(group: string): IntakeField["group"] {
  if (group === "purpose-and-recipient") return "document";
  if (group === "property-basics") return "property";
  if (group === "access-and-safety") return "access";
  if (group === "prior-paperwork") return "document";
  /*
   * The flags have no group of their own on the screens, and they are not
   * getting one invented for them. They are facts about the property and its
   * history, so they render under property, where a reader meets them next to
   * the age and the covering. What makes them flags is the ROUTING, which is a
   * rule rather than a heading.
   */
  return "property";
}

/**
 * Every field 254-RC-001 requires at intake.
 *
 * `stage` is "order" throughout, and that is section 6 rather than a
 * preference: "A job is not dispatched until intake is complete and every
 * upload required by Appendix A has been received." There is no tier of these
 * that may be answered later.
 */
export function protocolIntakeFields(protocol: ProtocolEntry): IntakeField[] {
  const fields: IntakeField[] = [];
  const prefix = protocol.fieldPrefix;
  const serviceSlug = protocol.declaration.serviceSlug;

  /*
   * ORDER FLOW V2, 2026-10-07: THE WORDING COMES FROM data/protocol-phrasing.ts.
   * The question's NUMBER still comes from the signed document, so every
   * question the document asks still becomes a field; only the words a
   * customer reads change. A question with no phrasing falls back to the
   * document's own words rather than vanishing, and the proof beside the
   * phrasing file goes red naming it.
   */
  const phrasing = PROTOCOL_PHRASING[protocol.declaration.documentNumber];

  for (const q of protocol.declaration.intakeQuestions) {
    const base = {
      required: true,
      stage: "order" as const,
      audience: "customer" as const,
      applies: [serviceSlug],
      group: groupFor(q.group),
    };
    const words = phrasing?.questions[q.number];
    /* Asked by the order's own step, so not asked again. Counted by the proof. */
    if (words && "byOrder" in words) continue;
    const label = words?.label ?? q.ask;

    if (q.flag) {
      fields.push({
        ...base,
        id: `${prefix}_q${q.number}`,
        label,
        help: words?.help,
        kind: "select",
        options: ["Yes", "No"],
      });
      fields.push({
        ...base,
        id: `${prefix}_q${q.number}${FLAG_DETAIL_SUFFIX}`,
        label: words?.detailLabel ?? "If yes, tell us more.",
        /*
         * Not required: the document asks for detail where there is detail to
         * give, and requiring it would make "No" impossible to answer.
         */
        required: false,
        kind: "longtext",
      });
      continue;
    }

    const options = words && "options" in words ? words.options : undefined;
    fields.push({
      ...base,
      id: `${prefix}_q${q.number}`,
      label,
      /*
       * VERBATIM QUESTIONS GET A FREE FIELD AND NEVER A SELECT. Section 6: the
       * purpose and the recipient are recorded exactly as given. A dropdown
       * would normalise the one fact the letter is addressed for. A question
       * the phrasing offers as choices (the attic) is a select; a verbatim one
       * never is, whatever the phrasing says, and the registry audit asserts it.
       */
      kind: q.verbatim ? "longtext" : options ? "select" : "text",
      ...(options && !q.verbatim ? { options } : {}),
      help: words?.help,
    });
  }

  for (const u of protocol.declaration.intakeUploads) {
    fields.push({
      id: `${prefix}_upload_${u.key}`,
      label: phrasing?.uploads[u.key] ?? u.what,
      ...(phrasing?.photos?.includes(u.key) ? { photo: true } : {}),
      help: u.when ?? undefined,
      kind: "file",
      /*
       * Only the document's own "Required" tier is required at order. The
       * conditional tier is required once its condition is true, which is a
       * rule the intake gate enforces rather than a property of the field.
       */
      required: u.tier === "required",
      stage: "order",
      audience: "customer",
      applies: [serviceSlug],
      group: "document",
    });
  }

  return fields;
}

/**
 * Every registered protocol's intake fields, in registry order. With one entry
 * this is exactly what `rc001IntakeFields()` returned before 2026-10-06.
 */
export function allProtocolIntakeFields(): IntakeField[] {
  return PROTOCOL_ENTRIES.flatMap((p) => protocolIntakeFields(p));
}

/** The ids of the flag questions, for the routing rule. Derived, never listed. */
export function protocolFlagFieldIds(protocol: ProtocolEntry): string[] {
  return protocol.declaration.intakeQuestions
    .filter((q) => q.flag)
    .map((q) => `${protocol.fieldPrefix}_q${q.number}`);
}

/**
 * Does this set of answers route to the engineer before dispatch?
 *
 * Section 6 and the Appendix A heading over questions 8 to 12. Pure, so the
 * audit exercises the RULE rather than a screen.
 */
export function protocolRoutesToEngineer(
  protocol: ProtocolEntry,
  answers: Record<string, string>,
): { routes: boolean; because: string[] } {
  const because: string[] = [];
  for (const q of protocol.declaration.intakeQuestions.filter((f) => f.flag)) {
    if ((answers[`${protocol.fieldPrefix}_q${q.number}`] ?? "").trim().toLowerCase() === "yes") {
      because.push(`Question ${q.number}: ${q.ask}`);
    }
  }
  return { routes: because.length > 0, because };
}

/**
 * Which required uploads are still missing.
 *
 * The conditional tier becomes required when its condition is true, and the one
 * condition the document states mechanically is question 11: an adverse report
 * "must be disclosed and uploaded".
 */
export function protocolMissingUploads(protocol: ProtocolEntry, answers: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const u of protocol.declaration.intakeUploads) {
    const id = `${protocol.fieldPrefix}_upload_${u.key}`;
    const present = (answers[id] ?? "").trim().length > 0;
    if (present) continue;
    if (u.tier === "required") {
      missing.push(u.what);
      continue;
    }
    /*
     * An upload the document requires only when a flag question is answered
     * yes. For 254-RC-001 that is the adverse report and question 11, which was
     * written here as a literal until 2026-10-06 and is now the entry's own
     * declaration, so another protocol's conditional uploads need no code.
     */
    const whenYesTo = protocol.uploadRequiredWhenYes[u.key];
    if (
      whenYesTo !== undefined &&
      (answers[`${protocol.fieldPrefix}_q${whenYesTo}`] ?? "").trim().toLowerCase() === "yes"
    ) {
      missing.push(u.what);
    }
  }
  return missing;
}
