import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { credentialSheet } from "@/lib/ops-onboarding";
import { CREDENTIAL_LABEL, RECORDABLE_KIND_OPTIONS } from "@/lib/ops-credentials";
import {
  CredentialHistoryList,
  CredentialHistoryTable,
  CredentialStandingList,
  CredentialStandingTable,
} from "@/components/portal/CredentialTables";
import { RecordCredentialForm } from "./RecordCredentialForm";
import { CoverageForm } from "./CoverageForm";
import { RecordTrainingForm } from "./RecordTrainingForm";
import { certificationsFor, trainableLines, trainingRecords } from "@/lib/certification-record";
import { services } from "@/content/services";
import { TEXAS_COUNTIES } from "@/lib/ops-counties";
import { formatCalendarDate } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * A TECHNICIAN'S CREDENTIALS. Operator ruling of 2026-10-07.
 *
 * An administrator records each credential dispatch reads: kind, label, issue
 * or effective date, expiration. Recording marks it verified by the signed-in
 * administrator, now, with an audit event. It is a record, never a file
 * (0062), and it is never edited: a new record replaces it and the old one
 * stays in the list below.
 *
 * Everything this page says about what is required, missing, expiring or
 * exempt comes from credentialSheet, which reads the rows, the exemption and
 * the rule dispatch reads, so the page and dispatch cannot disagree.
 *
 * Built to Design V10: sections are a heading with a 2px ink rule, no boxes,
 * urgency in words and weight, never colour.
 */
export default async function TechnicianPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!can(actor, "profiles.list")) notFound();

  const { id } = await params;
  const sheet = await credentialSheet(id);
  if (!sheet) notFound();

  const blocking = sheet.standing.filter((s) => s.blocks);
  const canRecord = can(actor, "profiles.update");
  const [certifications, training, lines] = await Promise.all([
    certificationsFor(id),
    trainingRecords(id),
    trainableLines(),
  ]);
  const lineName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;
  const longDate = (iso: string | null) =>
    iso
      ? (formatCalendarDate(iso.slice(0, 10), { year: "numeric", month: "long", day: "numeric" }) ?? "")
      : "";

  return (
    <div className="portal-sections max-w-[960px]">
      <div>
      <p className="text-[13px] text-[var(--secondary)]">
        <Link href="/portal/techs" className="text-[var(--navy)] underline active:opacity-70">
          Technicians
        </Link>
      </p>
      <h1 className="mt-2 text-[26px] leading-[1.2] font-semibold tracking-[-0.4px] text-[var(--ink)]">
        {sheet.profile.displayName}
      </h1>
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-[var(--secondary)]">
        <span>{sheet.profile.email}</span>
        <span>Account {sheet.profile.status}</span>
        {blocking.length === 0 ? (
          <span>Credentials clear for dispatch</span>
        ) : (
          <span className="font-semibold text-[var(--ink)]">
            {blocking.length === 1 ? "1 credential stops dispatch" : `${blocking.length} credentials stop dispatch`}
          </span>
        )}
      </p>
      </div>

      <section className="mt-10">
        <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
          What dispatch requires
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--secondary)]">
          Read from the rule dispatch applies. A credential expiring within {sheet.warningDays} days is
          shown here before it stops dispatch. Coverage counties and certification are separate gates.
        </p>
        {/* A phone gets rows, a wider screen the table: four columns at 390 wrap every cell. */}
        <div className="sm:hidden">
          <CredentialStandingList standing={sheet.standing} />
        </div>
        <div className="hidden sm:block">
          <CredentialStandingTable standing={sheet.standing} />
        </div>
      </section>

      {canRecord ? (
        <section className="mt-10">
          <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
            Record a credential
          </h2>
          <p className="mt-3 text-[14px] leading-[1.55] text-[var(--secondary)]">
            Recording marks it verified by you, now, and writes an audit event. Nothing is uploaded and
            nothing is edited: a new record replaces the old one, which stays in the list below.
          </p>
          <RecordCredentialForm
            profileId={sheet.profile.id}
            kinds={RECORDABLE_KIND_OPTIONS.map((k) => ({ kind: k.kind, label: CREDENTIAL_LABEL[k.kind], expires: k.expires }))}
          />
        </section>
      ) : null}

      {/*
        CERTIFICATION, operator ruling of 2026-10-07. A certification from
        supervised training is recorded here and counts for dispatch only once
        the engineer of record approves it from his own session. "Certified"
        below is the row dispatch reads; a record awaiting him is not.
      */}
      <section className="mt-10">
        <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
          Certification
        </h2>
        {certifications === null || training === null ? (
          <p role="alert" className="mt-3 text-[14px] font-semibold text-[var(--ink)]">
            Certifications could not be read, so none are shown.
          </p>
        ) : (
          <ul className="mt-3 border-t border-[var(--row-rule)]">
            {certifications.filter((c) => c.status === "certified").map((c) => (
              <li key={`c-${c.serviceSlug}`} className="border-b border-[var(--row-rule)] py-3 text-[14px]">
                <p className="font-semibold text-[var(--ink)]">{lineName(c.serviceSlug)}</p>
                <p className="text-[var(--secondary)]">
                  Certified{c.certifiedAt ? ` ${longDate(c.certifiedAt)}` : ""}. Dispatch can offer him this line.
                </p>
              </li>
            ))}
            {training.map((t) => (
              <li key={`t-${t.id}`} className="border-b border-[var(--row-rule)] py-3 text-[14px]">
                <p className="font-semibold text-[var(--ink)]">{lineName(t.serviceSlug)}</p>
                <p className={t.status === "awaiting_engineer" ? "font-semibold text-[var(--ink)]" : "text-[var(--secondary)]"}>
                  {t.status === "awaiting_engineer"
                    ? "Awaiting the engineer's approval. Dispatch refuses until he gives it."
                    : t.status === "approved"
                      ? `Approved by the engineer ${longDate(t.decidedAt)}.`
                      : `Refused by the engineer ${longDate(t.decidedAt)}: ${t.refusalReason}`}
                </p>
                <p className="text-[13px] text-[var(--secondary)]">
                  Supervised training on v{t.protocolVersion}, {longDate(t.trainedOn)}, supervised by {t.supervisedBy}.
                  Recorded {longDate(t.recordedAt)}.
                </p>
              </li>
            ))}
            {certifications.every((c) => c.status !== "certified") && training.length === 0 ? (
              <li className="border-b border-[var(--row-rule)] py-3 text-[14px] font-semibold text-[var(--ink)]">
                Not certified for any line. Dispatch offers him nothing.
              </li>
            ) : null}
          </ul>
        )}
        {canRecord ? (
          <>
            <h3 className="mt-6 text-[14px] font-semibold text-[var(--ink)]">Record supervised training</h3>
            <RecordTrainingForm
              profileId={sheet.profile.id}
              lines={lines.map((l) => ({
                serviceSlug: l.serviceSlug,
                name: lineName(l.serviceSlug),
                protocol: `${l.documentNumber} v${l.version}`,
              }))}
            />
          </>
        ) : null}
      </section>

      {/*
        COVERAGE COUNTIES, operator ruling of 2026-10-07: changed here rather
        than by SQL. Dispatch offers a job only to a technician whose coverage
        names the job's county.
      */}
      <section className="mt-10">
        <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
          Coverage counties
        </h2>
        <p className="mt-3 text-[14px] leading-[1.55] text-[var(--secondary)]">
          {sheet.profile.coverageCounties.length === 0 ? (
            <span className="font-semibold text-[var(--ink)]">
              No counties set. Dispatch offers this technician nothing.
            </span>
          ) : sheet.profile.coverageCounties.length === TEXAS_COUNTIES.length ? (
            `All ${TEXAS_COUNTIES.length} Texas counties.`
          ) : (
            `${sheet.profile.coverageCounties.length} count${sheet.profile.coverageCounties.length === 1 ? "y" : "ies"}: ${sheet.profile.coverageCounties.join(", ")}.`
          )}
        </p>
        {canRecord ? (
          <CoverageForm profileId={sheet.profile.id} current={sheet.profile.coverageCounties} allCounties={TEXAS_COUNTIES} />
        ) : null}
      </section>

      <section className="mt-10">
        <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
          Every credential record
        </h2>
        <div className="sm:hidden">
          <CredentialHistoryList history={sheet.history} />
        </div>
        <div className="hidden sm:block">
          <CredentialHistoryTable history={sheet.history} />
        </div>
      </section>
    </div>
  );
}
