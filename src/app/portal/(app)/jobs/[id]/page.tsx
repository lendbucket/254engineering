import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { jobView } from "@/lib/ops-field";
import { progressLabel } from "@/lib/ops-evidence";
import { photoAnswersFor } from "@/lib/protocol-run";
import { services } from "@/content/services";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { PageHead } from "@/components/portal/surfaces";
import { Checklist, RepairList } from "./CaptureClient";
import { FileThreadButton } from "@/components/portal/FileThreadButton";
import { captureAdditionsFor } from "@/lib/letter-facts";

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

  /* PL-5: the engineer's added capture items, on a permit letter job. */
  const additions = view.file.service_slug === "structural-letters" ? await captureAdditionsFor(view.file.id) : null;

  /* The photograph items that also take a written answer, from the signed document. */
  const photoAnswers = photoAnswersFor(view.protocol?.document_number ?? null);

  const closed = ["evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"].includes(
    view.file.status,
  );

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
        {can(actor, "messages.use") ? <FileThreadButton fileId={view.file.id} /> : null}
      </div>

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

      {view.protocol ? (
        <Checklist
          fileId={view.file.id}
          readOnly={closed}
          protocolName={`${view.protocol.name} v${view.protocol.version}`}
          items={view.protocol.items.map((i) => ({
            id: i.id,
            itemKey: i.itemKey,
            kind: i.kind,
            label: i.label,
            instructions: i.instructions ?? null,
            required: i.required,
            unit: i.unit ?? null,
            minValue: i.minValue ?? null,
            maxValue: i.maxValue ?? null,
            minCount: i.minCount ?? null,
            answer: photoAnswers[i.itemKey] ?? null,
          }))}
          captures={view.captures.map((c) => ({
            id: c.id,
            itemKey: c.item_key,
            kind: c.kind,
            valueText: c.value_text,
            valueNumber: c.value_number === null ? null : Number(c.value_number),
            storageKey: c.storage_key,
          }))}
          exceptions={view.exceptions.map((e) => ({
            itemKey: e.item_key,
            kind: e.kind,
            reason: e.reason,
          }))}
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
