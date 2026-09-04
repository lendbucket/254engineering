import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { jobView } from "@/lib/ops-field";
import { progressLabel } from "@/lib/ops-evidence";
import { services } from "@/content/services";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { Chip, PageHead } from "@/components/portal/surfaces";
import { Checklist } from "./CaptureClient";

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

  const closed = ["evidence_submitted", "under_review", "sealed", "delivered", "closed", "cancelled"].includes(
    view.file.status,
  );

  return (
    <>
      <Link
        href="/portal/jobs"
        className="mb-3 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--secondary)]"
      >
        Back to my jobs
      </Link>

      <PageHead
        eyebrow={view.file.file_number}
        title={view.file.property_address}
        lede={`${view.file.city ? `${view.file.city}, ` : ""}${view.file.county} County. ${serviceName}.`}
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Chip label={STATUS_LABEL[view.file.status as FileStatus] ?? view.file.status} tone="warn" />
        {view.file.twia_county ? <Chip label="Windstorm county" tone="warn" /> : null}
        <Chip label={progressLabel(view.state)} tone={view.state.canSubmit ? "good" : "neutral"} />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {/* An external map, because the phone in the technician's hand already
            has the navigation app they know how to use, and building a worse
            one inside the portal would only be in the way. */}
        <a
          href={`https://maps.google.com/?q=${mapQuery}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[48px] items-center justify-center rounded-[3px] border border-[var(--border)] bg-white px-4 text-[15px] font-semibold text-[var(--navy)]"
        >
          Directions
        </a>
      </div>

      {view.file.notes ? (
        <div className="mb-6 rounded-[4px] border border-[var(--border)] bg-white px-4 py-3">
          <p className="portal-kicker text-[var(--gold-deep)]">
            Notes on this file
          </p>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            {view.file.notes}
          </p>
        </div>
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
          }))}
          captures={view.captures.map((c) => ({
            id: c.id,
            itemKey: c.item_key,
            kind: c.kind,
            valueText: c.value_text,
            valueNumber: c.value_number === null ? null : Number(c.value_number),
            storageKey: c.storage_key,
          }))}
        />
      ) : (
        <div className="rounded-[4px] border border-[var(--border)] bg-white px-4 py-4">
          <p className="text-[13.5px] font-semibold text-[var(--navy)]">No protocol is attached to this file</p>
          <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            There is nothing to capture against yet, and nothing can be submitted. An engineer
            publishes the protocol for this service line, and it attaches itself here. Do not drive
            out until it does.
          </p>
        </div>
      )}
    </>
  );
}
