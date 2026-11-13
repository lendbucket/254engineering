import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { jobView, listOffers, revisionFor, visitClockFor } from "@/lib/ops-field";
import { isKnown, money } from "@/lib/ops-money";
import { OfferControls } from "../JobsClient";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { noteAsksAQuestion, REVISIONS_REQUESTED } from "@/lib/revision-rules";
import { RevisionAnswer } from "./RevisionAnswer";
import { VisitClock } from "./VisitClock";
import { AppleMapsLink } from "./AppleMapsLink";

/** How a request or reply time reads: "Nov 7, 2:05 PM", in the firm's zone. */
const WHEN = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;

/** How a visit time reads: "Nov 7, 2:05 PM", in the firm's zone. */
const VISIT_TIME = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;
import { captureDeleteRefusal, progressLabel } from "@/lib/ops-evidence";
import { CAPTURE_CLOSED_STATUSES, evidenceWriteRefusal } from "@/lib/evidence-capture-rules";
import { photoAnswersFor } from "@/lib/protocol-run";
import { services } from "@/content/services";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { PageHead } from "@/components/portal/surfaces";
import { Checklist, RepairList } from "./CaptureClient";
import { FileThreadButton } from "@/components/portal/FileThreadButton";
import { captureAdditionsFor } from "@/lib/letter-facts";
import { checklistPropsFrom } from "@/lib/job-checklist-props";

export const dynamic = "force-dynamic";

/**
 * One job, as the technician working it sees it.
 *
 * The whole screen is the checklist. Everything above it is the four facts
 * needed to find the property and know what is being asked, and everything below
 * it is the submit button, which is disabled with the reasons showing until the
 * gate opens.
 */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await currentActor();
  if (!can(actor, "offers.list_own") && !can(actor, "evidence.review")) notFound();

  const { id } = await params;
  const view = await jobView(actor, id);
  if (!view) notFound();

  const serviceName = services.find((s) => s.slug === view.file.service_slug)?.name ?? view.file.service_slug;
  const mapQuery = encodeURIComponent(
    [view.file.property_address, view.file.city, `${view.file.county} County`, "TX", view.file.postal_code]
      .filter(Boolean)
      .join(", "),
  );

  /*
   * The engineer's request, while the file is sent back (Robert's T5). Read
   * only in that status: once resubmitted the request is history, and the
   * engineer reads it in review. undefined when not sent back, null when the
   * read failed.
   */
  const revision = view.file.status === REVISIONS_REQUESTED ? await revisionFor(view.file.id) : undefined;

  /*
   * THE OFFER, ANSWERED HERE TOO (Robert's answer 3 of 2026-11-12, from the
   * phone pass): opened from a notification or a link, an offered job's page
   * showed the checklist and no way to answer, so the technician had to go
   * back to the list. The reader's own live offer on this file, by the list's
   * own rule (offered, and the file not yet assigned), gets the same controls
   * the list card has: the same server action, its rules and its refusals.
   */
  const liveOffer = can(actor, "offers.list_own")
    ? ((await listOffers(actor)).find((o) => o.file_id === view.file.id && o.state === "offered" && !o.file?.assigned_tech_id) ?? null)
    : null;

  /* The visit clock, read from the server's record. Null when it could not be read. */
  const visitClock = await visitClockFor(view.file.id);

  /* PL-5: the engineer's added capture items, on a permit letter job. */
  const additions = view.file.service_slug === "structural-letters" ? await captureAdditionsFor(view.file.id) : null;

  /* The photograph items that also take a written answer, from the signed document. */
  const photoAnswers = photoAnswersFor(view.protocol?.document_number ?? null);
  const checklist = checklistPropsFrom(view, photoAnswers);

  /*
   * Read only when capture is closed on the file, or when this person is not
   * the one who may write evidence on it: the evidence.capture grant and the
   * assigned technician, the rule the server asks (Q3, 2026-11-02). An engineer
   * or administrator reading the job sees the record, not controls the server
   * would refuse.
   */
  const closed =
    CAPTURE_CLOSED_STATUSES.includes(view.file.status) ||
    actor === null ||
    evidenceWriteRefusal({ id: actor.id, mayCapture: can(actor, "evidence.capture") }, view.file.assigned_tech_id) !== null;

  /*
   * WF-030 step 5, Robert's ruling 2026-10-29: a capture can be removed while
   * the file is in the field. The same rule deleteCapture asks, so the control
   * is drawn only where the server would allow the removal.
   */
  const canRemove =
    actor !== null &&
    captureDeleteRefusal({
      actorId: actor.id,
      actorRole: actor.role,
      mayCapture: can(actor, "evidence.capture"),
      assignedTechId: view.file.assigned_tech_id,
      status: view.file.status,
    }) === null;

  return (
    <>
      {/*
        Back to wherever this reader can go. Product audit, 2026-10-10: it always
        linked /portal/jobs, which an engineer is refused, so for the one role
        that reaches this page from Files the link was a 404.
      */}
      <Link
        href={can(actor, "offers.list_own") ? "/portal/jobs" : `/portal/files?id=${view.file.id}`}
        className="mb-3 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--secondary)]"
      >
        {can(actor, "offers.list_own") ? "Back to my jobs" : "Back to the file"}
      </Link>

      <PageHead
        eyebrow={view.file.file_number}
        title={view.file.property_address}
        lede={`${view.file.city ? `${view.file.city}, ` : ""}${view.file.county} County. ${serviceName}.`}
      />

      {/*
        V10's meta line: plain items separated by space, under the title. Three
        chips became three facts, in the order a technician asks them: where the
        file is, whether it is a windstorm county, and how far through the
        capture they are.
      */}
      <div className="mb-6 flex flex-wrap items-center gap-3 text-[14px] text-[var(--ink)]">
        <span className="font-semibold">{STATUS_LABEL[view.file.status as FileStatus] ?? view.file.status}</span>
        {view.file.twia_county ? <span>Windstorm county</span> : null}
        <span className="font-semibold">{progressLabel(view.state)}</span>
      </div>

      {liveOffer ? (
        <section aria-labelledby="offer-here" className="mb-6 rounded-[2px] border border-[var(--border)] bg-white p-4">
          <h2 id="offer-here" className="portal-label">
            This job is offered to you
          </h2>
          {/* Never a bare "not set" (operator ruling, 2026-10-09): a rate, or what its absence means. */}
          <p className="mt-2 font-display text-[17px] leading-[1.25] font-bold text-[var(--ink)]">
            {isKnown(liveOffer.offer_amount_cents) ? money(liveOffer.offer_amount_cents) : "No rate on this offer yet"}
          </p>
          <OfferControls offerId={liveOffer.id} fileId={liveOffer.file_id} hasRate={isKnown(liveOffer.offer_amount_cents)} />
        </section>
      ) : null}

      {/* At the top of the job, because it is why the technician is back here (Robert's T5). */}
      {revision === null ? (
        <p className="mb-6 border-t-2 border-[var(--ink)] pt-3 text-[14px] font-semibold text-[var(--ink)]">
          This package was sent back, and the engineer&apos;s note could not be read. Reload the page to try again.
        </p>
      ) : revision?.round ? (
        <RevisionAnswer
          fileId={view.file.id}
          note={revision.round.note}
          requestedAt={formatInFirmZone(revision.round.requestedAt, WHEN) ?? revision.round.requestedAt}
          reply={revision.round.reply?.body ?? null}
          repliedAt={revision.round.reply ? (formatInFirmZone(revision.round.reply.at, WHEN) ?? revision.round.reply.at) : null}
          question={noteAsksAQuestion(revision.round.note)}
          canReply={!closed}
        />
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {/* An external map, because the phone in the technician's hand already
            has the navigation app they know how to use, and building a worse
            one inside the portal would only be in the way. */}
        <a
          href={`https://maps.google.com/?q=${mapQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center rounded-[2px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--ink)]"
        >
          Directions
        </a>
        {/* Apple Maps beside it on an iPhone (Robert's answer 5, 2026-11-07, 6717223376). */}
        <AppleMapsLink query={mapQuery} />
        {can(actor, "messages.use") ? <FileThreadButton fileId={view.file.id} /> : null}
      </div>

      {/*
        The visit clock (Robert's T6, 2026-11-07): when the technician arrived
        and left, on the server's clock. Recorded only by the assigned
        technician while the file is in the field, the same rule as capture, so
        a reader who may not write sees the times and no button.
      */}
      <VisitClock
        fileId={view.file.id}
        visits={(visitClock?.visits ?? []).map((v) => ({
          arrived: formatInFirmZone(v.arrivedAt, VISIT_TIME) ?? v.arrivedAt,
          arrivedLate: v.arrivedLate,
          left: v.leftAt ? (formatInFirmZone(v.leftAt, VISIT_TIME) ?? v.leftAt) : null,
          leftLate: v.leftLate,
        }))}
        onSite={visitClock?.onSite ?? false}
        canRecord={!closed}
        unreadable={visitClock === null}
      />

      {view.file.notes ? (
        <div className="mb-6 border-t-2 border-[var(--ink)] pt-3">
          <p className="portal-label">
            Notes on this file
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
            {view.file.notes}
          </p>
        </div>
      ) : null}

      {/*
        * ABOVE THE CHECKLIST, because a technician sent back after repairs is
        * there for this list and not for the standard sweep. Appendix C says
        * the revisit carries an engineer-specified capture list rather than
        * Appendix B, and burying four repairs under fifty one checklist items
        * would hide the purpose of the journey.
        */}
      <RepairList
        fileId={view.file.id}
        readOnly={closed}
        repairs={view.repairs.map((r) => ({
          id: r.id,
          requirement: r.requirement,
          closedAt: r.closed_at,
          closedNote: r.closed_note,
        }))}
        captures={view.captures.map((c) => ({ id: c.id, itemKey: c.item_key }))}
      />

      {/*
        * THE ENGINEER'S OWN ITEMS FOR THIS JOB, in his words. PL-5, operator
        * ruling 7 of 2026-10-23: the capture list starts as the protocol's items
        * and he may add to it at triage. Shown above the checklist for the same
        * reason the repair list is: it is why this job differs from the last.
        */}
      {additions && additions.ok && additions.items.length > 0 ? (
        <div className="mb-6 border-t-2 border-[var(--ink)] pt-3">
          <p className="portal-label">The engineer also asks for</p>
          <ul className="mt-1.5 flex max-w-[70ch] list-disc flex-col gap-1 pl-5 text-[14px] leading-[1.55] text-[var(--ink)]">
            {additions.items.map((a) => (
              <li key={a.id}>{a.label}</li>
            ))}
          </ul>
        </div>
      ) : additions && !additions.ok ? (
        <p role="alert" className="mb-6 text-[14px] text-[var(--ink)]">
          The engineer&apos;s added items for this job could not be read: {additions.error}. Reload before you start.
        </p>
      ) : null}

      {checklist ? (
        /* The same props the offline day pack carries (src/lib/job-checklist-props.ts, Robert's T2). */
        <Checklist
          fileId={view.file.id}
          readOnly={closed}
          canRemove={canRemove}
          protocolName={checklist.protocolName}
          items={checklist.items}
          captures={checklist.captures}
          exceptions={checklist.exceptions}
        />
      ) : (
        <div className="border-t-2 border-[var(--ink)] pt-3">
          <p className="text-[14px] font-semibold text-[var(--ink)]">No protocol is attached to this file</p>
          <p className="mt-1.5 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--secondary)]">
            There is nothing to capture against yet, and nothing can be submitted. An engineer
            publishes the protocol for this service line, and it attaches itself here. Do not drive
            out until it does.
          </p>
        </div>
      )}
    </>
  );
}
