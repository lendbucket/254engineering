import type { IntakeField } from "./intake-fields";
import { RC001 } from "@/content/protocols/rc-001";

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
export function rc001IntakeFields(): IntakeField[] {
  const fields: IntakeField[] = [];

  for (const q of RC001.intakeQuestions) {
    const base = {
      required: true,
      stage: "order" as const,
      audience: "customer" as const,
      applies: [RC001.serviceSlug],
      group: groupFor(q.group),
    };

    if (q.flag) {
      fields.push({
        ...base,
        id: `rc001_q${q.number}`,
        label: q.ask,
        help: "A yes routes this job to the engineer before anybody is dispatched.",
        kind: "select",
        options: ["Yes", "No"],
      });
      fields.push({
        ...base,
        id: `rc001_q${q.number}${FLAG_DETAIL_SUFFIX}`,
        label: `${q.ask} Details.`,
        /*
         * Not required: the document asks for detail where there is detail to
         * give, and requiring it would make "No" impossible to answer.
         */
        required: false,
        kind: "longtext",
      });
      continue;
    }

    fields.push({
      ...base,
      id: `rc001_q${q.number}`,
      label: q.ask,
      /*
       * VERBATIM QUESTIONS GET A FREE FIELD AND NEVER A SELECT. Section 6: the
       * purpose and the recipient are recorded exactly as given. A dropdown
       * would normalise the one fact the letter is addressed for, and question
       * 1 says "record exactly" in its own words.
       */
      kind: q.verbatim ? "longtext" : "text",
      help: q.verbatim ? "Recorded exactly as given. The letter is issued only for this purpose and to this recipient." : undefined,
    });
  }

  for (const u of RC001.intakeUploads) {
    fields.push({
      id: `rc001_upload_${u.key}`,
      label: u.what,
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
      applies: [RC001.serviceSlug],
      group: "document",
    });
  }

  return fields;
}

/** The ids of the flag questions, for the routing rule. Derived, never listed. */
export function rc001FlagFieldIds(): string[] {
  return RC001.intakeQuestions.filter((q) => q.flag).map((q) => `rc001_q${q.number}`);
}

/**
 * Does this set of answers route to the engineer before dispatch?
 *
 * Section 6 and the Appendix A heading over questions 8 to 12. Pure, so the
 * audit exercises the RULE rather than a screen.
 */
export function rc001RoutesToEngineer(answers: Record<string, string>): { routes: boolean; because: string[] } {
  const because: string[] = [];
  for (const q of RC001.intakeQuestions.filter((f) => f.flag)) {
    if ((answers[`rc001_q${q.number}`] ?? "").trim().toLowerCase() === "yes") {
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
export function rc001MissingUploads(answers: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const u of RC001.intakeUploads) {
    const id = `rc001_upload_${u.key}`;
    const present = (answers[id] ?? "").trim().length > 0;
    if (present) continue;
    if (u.tier === "required") {
      missing.push(u.what);
      continue;
    }
    if (u.key === "adverse-report" && (answers.rc001_q11 ?? "").trim().toLowerCase() === "yes") {
      missing.push(u.what);
    }
  }
  return missing;
}
