import { notFound } from "next/navigation";
import { PageHead, Panel } from "@/components/portal/surfaces";
import { protocolByDocument } from "@/content/protocols";

/**
 * ===========================================================================
 * ANY PROTOCOL IN THE PORTAL. The document is the authority; this is the view.
 * ===========================================================================
 *
 * ONE PAGE FOR EVERY PROTOCOL, operator ruling 2026-10-06. This was the body
 * of `protocols/rc-001/page.tsx`, written for 254-RC-001 alone, and it is moved
 * here unchanged apart from reading the protocol it is handed instead of
 * importing RC-001 by name. RC-001's route now renders this for its own
 * document number, so its screen is the same markup it was.
 *
 * WHY EACH PROTOCOL STILL HAS ITS OWN SHORT ROUTE FILE RATHER THAN ONE
 * `[document]` ROUTE. The route sweeps derive their subject by walking the app
 * directories and skip every dynamic segment (`routesOf` in
 * scripts/lib/surfaces.mjs). A `[document]` route would have taken
 * `/portal/protocols/rc-001` out of the contrast, mobile, native and perimeter
 * sweeps without a single check going red, which is the vacuous green this
 * repository records again and again. A five line route per protocol keeps
 * every protocol's screen inside every sweep, and the page itself is still
 * written once, here.
 *
 * WHAT THIS SCREEN IS, AND WHAT IT IS NOT, STATED PLAINLY BECAUSE THE
 * DIFFERENCE MATTERS. It renders the protocol as the engineer signed it: the
 * checklist items in their sections, the photo procedure, the determinations
 * with their criteria, the thresholds, and the rules the platform enforces
 * rather than displays.
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
 * THE STATUS PANEL BELOW IS STALE FOR RC-001 AND IS LEFT AS IT WAS ON PURPOSE.
 * It says the protocol is signed and not yet approved; RC-001 was approved on
 * 2026-09-22. The ruling for this change was that RC-001 behaves exactly as
 * before, so the sentence is carried unchanged and reported, and it is replaced
 * by the signed record when portal signing is built.
 */
/**
 * THE ROUTE GUARDS, NOT THIS COMPONENT. Each protocol's route file calls
 * `holdsLicence(actor, "protocols.author")` itself and refuses before
 * rendering this, because surface-audit finds licensed screens by reading the
 * ROUTE source for that call. A guard living only here, or behind a wrapper
 * with another name, would take every protocol screen out of that check's
 * subject without anything going red.
 */
export async function ProtocolDocumentPage({ documentNumber }: { documentNumber: string }) {
  const protocol = protocolByDocument(documentNumber);
  if (!protocol) notFound();
  const doc = protocol.declaration;

  const itemsBySection = doc.sections.map((section) => ({
    section,
    items: doc.checklist.filter((i) => i.section === section.key),
  }));

  const photoItems = doc.checklist.filter((i) => i.photo).length;
  const rulerItems = doc.checklist.filter((i) => i.ruler).length;

  return (
    <>
      <PageHead
        title={`${doc.documentNumber} v${doc.version}`}
        lede={`${doc.title}. Signed by ${doc.approvedBy} on ${doc.issueDate}. This is the document as signed, not a working checklist.`}
      />

      <Panel
        title="Where this protocol stands"
        description="Signed is not approved, and the difference decides whether a line may be sold."
      >
        <p className="text-[14px] leading-[1.7] text-[var(--secondary)]">
          The engineer of record signed this document on {doc.issueDate}. It has not been approved
          in the platform, which only he can do and only through his own account. Until he does,
          the roof certification line does not take orders, and nothing on this screen changes that.
        </p>
        <p className="mt-3 text-[14px] leading-[1.7] text-[var(--secondary)]">
          The declaration is transcribed from {doc.sourceFile} and every question, checklist item,
          criterion and enforced rule on this screen is compared word for word against that PDF by
          protocol-registry-audit. A sentence here that the document does not contain is a red board.
        </p>
        {doc.requiresDiscipline === null ? (
          <p className="mt-3 text-[14px] leading-[1.7] text-[var(--secondary)]">
            The discipline this protocol requires is not declared. That is the engineer&apos;s
            answer rather than a reading of the words &quot;roof certification&quot;, and until he
            gives it the line stays blocked.
          </p>
        ) : null}
      </Panel>

      <Panel
        title={`The checklist: ${doc.checklist.length} items in ${doc.sections.length} sections`}
        description={`${photoItems} require a photograph and ${rulerItems} require a ruler in frame. Counted from the registry rather than typed.`}
      >
        <div className="flex flex-col gap-5">
          {itemsBySection.map(({ section, items }) => (
            <div key={section.key}>
              {/*
                The section heading as the document writes it, with no CSS case
                transform: a transform makes the screen disagree with the
                transcription, and V10's label is 13/600.
              */}
              <p className="text-[13px] font-semibold text-[var(--secondary)]">
                {section.heading} ({items.length})
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {items.map((item) => (
                  <li key={item.key} className="text-[14px] leading-[1.6] text-[var(--ink)]">
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
          {doc.photoProcedure.map((step) => (
            <li key={step.step} className="text-[14px] leading-[1.7] text-[var(--ink)]">
              <span className="font-semibold">{step.step}.</span> {step.text}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel
        title={`The five determinations, ${doc.determinations.reduce((n, d) => n + d.criteria.length, 0)} criteria`}
        description="What the engineer decides, and the criteria he wrote in advance to decide it against."
      >
        <div className="flex flex-col gap-4">
          {doc.determinations.map((d) => (
            <div key={d.key} className="border-t border-[var(--border)] pt-3 first:border-t-0 first:pt-0">
              <p className="text-[14px] font-semibold text-[var(--ink)]">{d.heading}</p>
              {d.effect ? (
                <p className="mt-1 text-[13px] leading-[1.6] text-[var(--secondary)]">{d.effect}</p>
              ) : null}
              <ul className="mt-2 flex flex-col gap-1.5">
                {d.criteria.map((c) => (
                  <li key={c} className="text-[14px] leading-[1.6] text-[var(--secondary)]">
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
          {doc.thresholds.map((t) => (
            <li key={t.key} className="text-[14px] leading-[1.6] text-[var(--ink)]">
              {t.states}
              {t.settled ? null : (
                <span className="text-[var(--secondary)]"> Unsettled: {t.question}</span>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={`Enforced rather than displayed: ${protocol.enforced.length} rules`}
        description="These are the ones the platform must make impossible to break, rather than ones a person is asked to remember."
      >
        <ul className="flex flex-col gap-2">
          {protocol.enforced.map((r) => (
            <li key={r.key} className="text-[14px] leading-[1.6] text-[var(--ink)]">
              {r.rule} <span className="text-[var(--secondary)]">({r.at})</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel
        title={`Questions for the engineer: ${protocol.ambiguities.length}`}
        description="Places the document does not settle. Recorded as questions rather than resolved by a reading."
      >
        <ul className="flex flex-col gap-2">
          {protocol.ambiguities.map((a) => (
            <li key={a.question} className="text-[14px] leading-[1.6] text-[var(--ink)]">
              {a.question} <span className="text-[var(--secondary)]">({a.at})</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
