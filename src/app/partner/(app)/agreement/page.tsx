import { currentPartner } from "@/lib/partner-auth";
import { agreementOutstanding, currentAgreement } from "@/lib/ops-partner-portal";
import { EmptyState, Panel, RestrictedMode, SystemAlert } from "@/components/portal/design";
import { AcceptForm } from "./AcceptForm";

export const dynamic = "force-dynamic";

/**
 * The programme agreement, and the record that it was accepted.
 *
 * WHY THIS SCREEN EXISTS AT ALL, RATHER THAN A PDF IN AN EMAIL
 * ------------------------------------------------------------
 * The four non negotiables in docs/partner-program-decision.md are ultimately
 * carried by this document, not by the software. The platform can make the
 * approved path easy and can record what was agreed; it cannot stop a partner
 * writing whatever they like on their own website. The real control is the
 * agreement, the right to withdraw approval, and somebody looking at what
 * partners publish.
 *
 * So the version is on the screen, the acceptance is append only, and the firm
 * can produce both. That is the honest limit of what this section can do, and
 * saying it plainly is better than a compliance feature that implies more.
 */
export default async function PartnerAgreementPage() {
  const principal = await currentPartner();
  if (!principal) return null;

  const agreement = await currentAgreement();
  const outstanding = agreementOutstanding(principal, agreement);

  /*
   * Paragraphs, split on blank lines and rendered as text. Never as HTML: the
   * body is a database column, and a document that can inject markup into the
   * page a partner reads it on is a document nobody should be storing as text.
   */
  const paragraphs = (agreement?.body ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <>
      <RestrictedMode />

      <div>
        <h1 className="font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
          Programme agreement
        </h1>
        <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          {principal.partner.agreementVersion
            ? `${principal.partner.organisation} accepted version ${principal.partner.agreementVersion}${
                principal.partner.agreementAcceptedAt
                  ? ` on ${new Date(principal.partner.agreementAcceptedAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}`
                  : ""
              }.`
            : "Nothing has been accepted on this account yet."}
        </p>
      </div>

      {outstanding && agreement ? (
        <SystemAlert condition="This is a newer version than the one on file.">
          What you have already earned is unaffected. Read this version and accept it to stay
          current.
        </SystemAlert>
      ) : null}

      {agreement ? (
        <>
          <Panel
            title={`Version ${agreement.version}`}
            description={agreement.summary ?? undefined}
          >
            <div className="flex flex-col gap-3">
              {paragraphs.map((p, i) => (
                <p key={i} className="max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">
                  {p}
                </p>
              ))}
            </div>
          </Panel>

          {outstanding ? (
            <Panel title="Accept">
              <AcceptForm version={agreement.version} />
            </Panel>
          ) : null}
        </>
      ) : (
        <Panel>
          <EmptyState
            title="No agreement is published"
            body="The firm has not published a programme agreement yet. Nothing here needs your acceptance until it does, and what you have earned is unaffected either way."
          />
        </Panel>
      )}

      <Panel title="What the platform can and cannot do about this">
        <p className="max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">
          Accepting is recorded permanently: who accepted, when, from which address, and against
          which version. The text of a version never changes after it is published, because an
          agreement whose wording moved after acceptance is one nobody can prove the terms of.
        </p>
        <p className="mt-3 max-w-[74ch] text-[13.5px] leading-[1.65] text-[var(--ink)]">
          What it cannot do is police what is published elsewhere. Nothing here stops anybody
          writing whatever they like on their own website, and nothing here should be read as
          suggesting otherwise. That is what the agreement is for.
        </p>
      </Panel>
    </>
  );
}
