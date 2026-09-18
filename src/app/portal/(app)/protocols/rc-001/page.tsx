import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { PageHead, Panel } from "@/components/portal/surfaces";
import { RC001, RC001_ENFORCED, RC001_AMBIGUITIES } from "@/content/protocols/rc-001";
import { RC001_CHECKLIST, RC001_SECTIONS, RC001_PHOTO_PROCEDURE } from "@/content/protocols/rc-001-checklist";
import { RC001_DETERMINATIONS, RC001_THRESHOLDS } from "@/content/protocols/rc-001-decisions";

export const dynamic = "force-dynamic";

/**
 * ===========================================================================
 * 254-RC-001 IN THE PORTAL. The document is the authority; this is the view.
 * ===========================================================================
 *
 * Operator ruling, 2026-09-18, reordering the queue: the roof protocol screens
 * come before everything else, because they are the only thing in the queue
 * that lets a real job move from intake to a sealed letter. Everything else
 * improves a firm that cannot yet take a job.
 *
 * WHAT THIS SCREEN IS, AND WHAT IT IS NOT, STATED PLAINLY BECAUSE THE
 * DIFFERENCE MATTERS. It renders the protocol as the engineer signed it: the
 * 51 checklist items in their 8 sections, the photo procedure, the five
 * determinations with their criteria, the thresholds, and the rules the
 * platform enforces rather than displays.
 *
 * It is NOT a working checklist. A technician cannot tick an item here and a
 * determination cannot be recorded against a job from this page. Those are
 * stateful surfaces that need a job to hang off and a migration to record
 * against, and building a screen that LOOKS like a working checklist without
 * being one is worse than not building it: somebody would work a job from it
 * and have nothing to submit.
 *
 * EVERY FIGURE ON IT IS COUNTED FROM THE REGISTRY RATHER THAN TYPED, so the
 * screen cannot claim 51 items while the registry holds 50.
 *
 * THE PROTOCOL IS NOT APPROVED AND THE SCREEN SAYS SO FIRST. It is signed, and
 * it sits in awaiting_engineer: signed by the engineer of record and not yet
 * approved by him in the platform. Nothing here approves it, and nothing here
 * can be mistaken for an approval.
 */
export default async function ProtocolRC001Page() {
  const actor = await currentActor();
  /*
   * The same licensed capability the protocols index uses. Authoring and
   * reading a protocol are the engineer's, and a second capability for the same
   * authority is how two answers to one question start to exist.
   */
  if (!holdsLicence(actor, "protocols.author")) notFound();

  const itemsBySection = RC001_SECTIONS.map((section) => ({
    section,
    items: RC001_CHECKLIST.filter((i) => i.section === section.key),
  }));

  const photoItems = RC001_CHECKLIST.filter((i) => i.photo).length;
  const rulerItems = RC001_CHECKLIST.filter((i) => i.ruler).length;

  return (
    <>
      <PageHead
        title={`${RC001.documentNumber} v${RC001.version}`}
        lede={`${RC001.title}. Signed by ${RC001.approvedBy} on ${RC001.issueDate}. This is the document as signed, not a working checklist.`}
      />

      <Panel
        title="Where this protocol stands"
        description="Signed is not approved, and the difference decides whether a line may be sold."
      >
        <p className="text-[14px] leading-[1.7] text-[var(--secondary)]">
          The engineer of record signed this document on {RC001.issueDate}. It has not been approved
          in the platform, which only he can do and only through his own account. Until he does,
          the roof certification line does not take orders, and nothing on this screen changes that.
        </p>
        <p className="mt-3 text-[14px] leading-[1.7] text-[var(--secondary)]">
          The declaration is transcribed from {RC001.sourceFile} and every question, checklist item,
          criterion and enforced rule on this screen is compared word for word against that PDF by
          protocol-registry-audit. A sentence here that the document does not contain is a red board.
        </p>
        {RC001.requiresDiscipline === null ? (
          <p className="mt-3 text-[14px] leading-[1.7] text-[var(--secondary)]">
            The discipline this protocol requires is not declared. That is the engineer&apos;s
            answer rather than a reading of the words &quot;roof certification&quot;, and until he
            gives it the line stays blocked.
          </p>
        ) : null}
      </Panel>

      <Panel
        title={`The checklist: ${RC001_CHECKLIST.length} items in ${RC001_SECTIONS.length} sections`}
        description={`${photoItems} require a photograph and ${rulerItems} require a ruler in frame. Counted from the registry rather than typed.`}
      >
        <div className="flex flex-col gap-5">
          {itemsBySection.map(({ section, items }) => (
            <div key={section.key}>
              <p className="font-sans text-[0.72rem] font-semibold tracking-[0.14em] text-[var(--secondary)] uppercase">
                {section.heading} ({items.length})
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item.key} className="text-[13.5px] leading-[1.6] text-[var(--ink)]">
                    {item.label}
                    {item.photo || item.ruler || item.perOccurrence || item.coveringOnly ? (
                      <span className="text-[var(--secondary)]">
                        {" "}
                        [
                        {[
                          item.photo ? "photo" : null,
                          item.ruler ? "ruler in frame" : null,
                          item.perOccurrence ? "per occurrence" : null,
                          item.coveringOnly ? `${item.coveringOnly} only` : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        ]
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="The photo procedure"
        description="Three steps, in order, from Appendix B. The second is what makes a photograph traceable to the item it evidences."
      >
        <ol className="flex flex-col gap-2">
          {RC001_PHOTO_PROCEDURE.map((step) => (
            <li key={step.step} className="text-[14px] leading-[1.7] text-[var(--ink)]">
              <span className="font-semibold">{step.step}.</span> {step.text}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel
        title={`The five determinations, ${RC001_DETERMINATIONS.reduce((n, d) => n + d.criteria.length, 0)} criteria`}
        description="What the engineer decides, and the criteria he wrote in advance to decide it against."
      >
        <div className="flex flex-col gap-4">
          {RC001_DETERMINATIONS.map((d) => (
            <div key={d.key} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
              <p className="text-[14px] font-semibold text-[var(--ink)]">{d.heading}</p>
              {d.effect ? (
                <p className="mt-1 text-[13px] leading-[1.6] text-[var(--secondary)]">{d.effect}</p>
              ) : null}
              <ul className="mt-2 flex flex-col gap-1.5">
                {d.criteria.map((c) => (
                  <li key={c} className="text-[13.5px] leading-[1.6] text-[var(--secondary)]">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Thresholds"
        description="Numbers the document states. An unsettled one carries the question it needs answered rather than a value somebody chose."
      >
        <ul className="flex flex-col gap-2">
          {RC001_THRESHOLDS.map((t) => (
            <li key={t.key} className="text-[13.5px] leading-[1.6] text-[var(--ink)]">
              {t.states}
              {t.settled ? null : (
                <span className="text-[var(--secondary)]"> Unsettled: {t.question}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={`Enforced rather than displayed: ${RC001_ENFORCED.length} rules`}
        description="These are the ones the platform must make impossible to break, rather than ones a person is asked to remember."
      >
        <ul className="flex flex-col gap-2">
          {RC001_ENFORCED.map((r) => (
            <li key={r.key} className="text-[13.5px] leading-[1.6] text-[var(--ink)]">
              {r.rule} <span className="text-[var(--secondary)]">({r.at})</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={`Questions for the engineer: ${RC001_AMBIGUITIES.length}`}
        description="Places the document does not settle. Recorded as questions rather than resolved by a reading."
      >
        <ul className="flex flex-col gap-2">
          {RC001_AMBIGUITIES.map((a) => (
            <li key={a.question} className="text-[13.5px] leading-[1.6] text-[var(--ink)]">
              {a.question} <span className="text-[var(--secondary)]">({a.at})</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
