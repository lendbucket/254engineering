import type { ReactNode } from "react";
import Link from "next/link";
import { PhoneLink } from "@/components/portal/PhoneLink";
import { Chip, EmptyState, PageHead, Panel } from "@/components/portal/surfaces";
import { formatInFirmZone } from "@/lib/firm-calendar";
import type { Actor } from "@/lib/ops-authz";
import { rooferApplicationById } from "@/lib/ops-roofer-applications";
import {
  ROOFER_MONTHLY_VOLUME_LABEL,
  ROOFER_SERVICE_LABEL,
  ROOFER_WORK_MIX_LABEL,
  profileCompleteness,
} from "@/lib/roofer-application";
import { PrintThis, RooferDecision } from "./RooferDecision";

/** A profile answer not given yet (0117), said in words rather than left blank. */
const NOT_YET = "Not given yet";

/**
 * ONE ROOFER APPLICATION: EVERY ANSWER, THE CERTIFICATE, AND THE DECISION.
 *
 * Rendered by the list screen at /portal/roofer-applications?id=<id>, the
 * shape /portal/files?id= uses, rather than as its own dynamic route: a
 * dynamic portal route needs a resolver in v10-layout-audit and its dated
 * exemption list closed on 2026-10-19, and no application exists on
 * development to resolve one to until this table's sitting.
 *
 * What the reviewer checks, by Robert's ruling 4, is on this page in the order
 * they check it: a Texas office, general liability with its certificate, and
 * two references with telephone numbers that dial. The call log for the
 * company is one click away on its prospect. The certificate opens through a
 * ten minute link from private storage and is never public.
 */
const when = (value: string) =>
  formatInFirmZone(value, { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) ?? value;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-[13px] font-semibold text-[var(--secondary)]">{label}</dt>
      <dd className="text-[15px] text-[var(--ink)]">{children}</dd>
    </div>
  );
}

export async function RooferApplicationDetail({ actor, id }: { actor: Actor | null; id: string }) {
  const read = await rooferApplicationById(actor, id);

  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Roofer applications" title="This application could not be opened" />
        <EmptyState
          title={read.error}
          body="Go back to the list of applications. If it is listed there and still will not open, the read failed rather than the application being missing; reload to try again."
        />
        <p className="mt-4">
          <Link href="/portal/roofer-applications" className="font-semibold text-[var(--navy)] underline">
            Back to the roofer applications
          </Link>
        </p>
      </>
    );
  }

  const a = read.row;
  const isImage = a.certificatePath ? /\.(png|jpe?g|webp)$/i.test(a.certificatePath) : false;

  return (
    <>
      <PageHead
        eyebrow="Roofer application"
        title={a.legalName}
        lede={`Received ${when(a.createdAt)}.${a.dba ? ` Doing business as ${a.dba}.` : ""}`}
        actions={<PrintThis />}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Chip
          label={a.status === "received" ? "Waiting for a decision" : a.status === "approved" ? "Approved" : "Declined"}
          tone={a.status === "received" ? "warn" : a.status === "approved" ? "good" : "neutral"}
        />
        <Link href={`/portal/prospects/${a.prospectId}`} className="text-[14px] font-semibold text-[var(--navy)] underline print:hidden">
          Open the prospect and its call log
        </Link>
        {a.accountId ? (
          <Link href={`/portal/accounts/${a.accountId}`} className="text-[14px] font-semibold text-[var(--navy)] underline print:hidden">
            Open the account
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="flex flex-col gap-4">
          <Panel title="The company">
            <dl>
              <Row label="Legal name">{a.legalName}</Row>
              <Row label="DBA">{a.dba ?? "None given"}</Row>
              <Row label="Owner">{a.ownerTitle ? `${a.ownerName}, ${a.ownerTitle}` : a.ownerName}</Row>
              <Row label="Profile">
                {profileCompleteness({ work: a.workDoneAt, insurance: a.insuranceDoneAt, references: a.referencesDoneAt }).sentence}
                {`: the work ${a.workDoneAt ? "done" : "not done yet"}, insurance ${a.insuranceDoneAt ? "done" : "not done yet"}, references ${a.referencesDoneAt ? "done" : "not done yet"}.`}
              </Row>
              <Row label="Email">
                <a href={`mailto:${a.email}`} className="font-semibold text-[var(--navy)] underline">
                  {a.email}
                </a>
              </Row>
              <Row label="Phone">
                <PhoneLink phone={a.phone} />
              </Row>
              <Row label="Office">{a.officeCity ?? NOT_YET}</Row>
              <Row label="Years in business">{a.yearsInBusiness ?? NOT_YET}</Row>
            </dl>
          </Panel>

          <Panel title="The work">
            <dl>
              <Row label="Counties served">{a.counties.length ? a.counties.join(", ") : NOT_YET}</Row>
              <Row label="Crews">{a.crewCount ?? NOT_YET}</Row>
              <Row label="Residential or commercial">{a.workMix ? ROOFER_WORK_MIX_LABEL[a.workMix] : NOT_YET}</Row>
              <Row label="Roofs a year">{a.roofsPerYear === null ? NOT_YET : a.roofsPerYear.toLocaleString("en-US")}</Row>
              <Row label="Expects to order">{a.services.length ? a.services.map((s) => ROOFER_SERVICE_LABEL[s]).join(", ") : NOT_YET}</Row>
              <Row label="Roughly">{a.monthlyVolume ? ROOFER_MONTHLY_VOLUME_LABEL[a.monthlyVolume] : NOT_YET}</Row>
            </dl>
          </Panel>

          <Panel title="Insurance">
            <dl>
              <Row label="General liability carrier">{a.insuranceCarrier ?? NOT_YET}</Row>
              <Row label="Per occurrence">{a.glPerOccurrence ?? NOT_YET}</Row>
              <Row label="Aggregate">{a.glAggregate ?? NOT_YET}</Row>
              <Row label="Certificate">
                {!a.certificatePath ? (
                  "Not attached. Ask for it before approving."
                ) : read.certificateUrl ? (
                  <span className="flex flex-col gap-3">
                    <a href={read.certificateUrl} target="_blank" rel="noreferrer" className="font-semibold text-[var(--navy)] underline">
                      Open the certificate
                    </a>
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={read.certificateUrl} alt={`Insurance certificate attached by ${a.legalName}`} className="max-h-[520px] w-auto max-w-full rounded-[3px] border border-[var(--border)]" />
                    ) : null}
                    <span className="text-[13px] text-[var(--secondary)]">The link lasts ten minutes; reload the page for a fresh one.</span>
                  </span>
                ) : (
                  read.certificateError
                )}
              </Row>
            </dl>
          </Panel>

          <Panel title="References">
            <dl>
              <Row label="First reference">
                {a.reference1Name ? [a.reference1Name, a.reference1Company].filter(Boolean).join(", ") : NOT_YET}
                {a.reference1Phone ? (
                  <span className="block">
                    <PhoneLink phone={a.reference1Phone} />
                  </span>
                ) : null}
              </Row>
              <Row label="Second reference">
                {a.reference2Name ? [a.reference2Name, a.reference2Company].filter(Boolean).join(", ") : NOT_YET}
                {a.reference2Phone ? (
                  <span className="block">
                    <PhoneLink phone={a.reference2Phone} />
                  </span>
                ) : null}
              </Row>
            </dl>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="The decision"
            description="Read against three things: a Texas office, general liability with a certificate, and the two references called by a person. There is no cap."
          >
            {a.status === "received" ? (
              <RooferDecision id={a.id} company={a.legalName} />
            ) : (
              <dl>
                <Row label="Decision">{a.status === "approved" ? "Approved, account opened" : "Declined"}</Row>
                <Row label="By">{a.decidedByName ?? "A member of staff"}</Row>
                <Row label="When">{a.decidedAt ? when(a.decidedAt) : ""}</Row>
                <Row label="Reason">{a.decisionReason}</Row>
              </dl>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
