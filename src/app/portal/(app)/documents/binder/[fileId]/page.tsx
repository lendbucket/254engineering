import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { binderFor } from "@/lib/ops-docs";
import { decisionLabel } from "@/lib/ops-binder";
import {
  Breadcrumb,
  DocumentSheet,
  SheetLetterhead,
  SheetRecordNote,
  SecondaryButton,
  StatusPill,
  AbsentChip,
  RestrictedMode,
  type StatusTone,
} from "@/components/portal/design";

export const dynamic = "force-dynamic";

/**
 * The evidence binder, on the page rather than in a spreadsheet.
 *
 * WHY THIS EXISTS AND THE SEALED LETTER DOES NOT
 * ----------------------------------------------
 * The design has two document screens: a sealed letter and this. Only one of
 * them can be built honestly today.
 *
 * Nothing in this platform produces a sealed letter. A deliverable is an
 * uploaded document, no sealing has happened because the firm's registration is
 * pending, and isPrelaunch blocks a file from ever reaching sealed. A screen
 * rendering one would be a picture of a document that cannot exist, carrying a
 * PE seal and a signature block for an engineer who is not in responsible
 * charge. That is the evidence hash problem again, and it is reported rather
 * than shipped as a shell.
 *
 * The binder is the opposite. It has been assembled from real rows since Phase
 * 6, it has only ever existed as a CSV, and a CSV is the wrong shape for a
 * document somebody hands to a third party.
 *
 * WHY IT IS ASSEMBLED ON EVERY REQUEST AND NEVER STORED
 * -----------------------------------------------------
 * Unchanged from Phase 6 and worth restating: a stored binder is a stale binder,
 * and a stale binder that looks authoritative is exactly the document a board or
 * an insurer should not be handed. It is built from the file as it stands, every
 * time, and it says when it was built.
 *
 * The visibility check is binderFor's, which is the same one the job view runs.
 * A technician gets the binder for a job they hold and nothing else.
 */

const DECISION_TONE: Record<string, StatusTone> = {
  seal: "good",
  revisions: "pending",
  site_visit: "pending",
  refuse: "failed",
};

const WHEN = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

export default async function BinderPage({ params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  const actor = await currentActor();

  const binder = await binderFor(actor, fileId);
  if (!binder) notFound();

  return (
    <>
      <Breadcrumb
        trail={[
          { label: "Documents", href: "/portal/documents" },
          { label: "Evidence binder" },
          { label: binder.fileNumber },
        ]}
      />

      <RestrictedMode />

      <div className="mb-4 flex flex-wrap gap-2">
        <SecondaryButton href={`/api/portal/exports?report=binder&fileId=${fileId}`}>
          Download as CSV
        </SecondaryButton>
      </div>

      <DocumentSheet>
        <SheetLetterhead>
          <p className="portal-kicker text-[var(--secondary)]">254 Engineering Services LLC</p>
          <h1 className="mt-1.5 font-display text-[24px] leading-[1.2] font-bold text-[var(--navy)]">
            Evidence binder
          </h1>
          <p className="mt-1 font-mono text-[13.5px] text-[var(--secondary)]">
            {binder.fileNumber} · assembled {WHEN(binder.generatedAt)}
          </p>
        </SheetLetterhead>

        <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          {[
            ["Property", binder.propertyAddress],
            ["County", `${binder.county} County${binder.twiaCounty ? ", windstorm designated" : ""}`],
            ["Service", binder.serviceName],
            [
              "Protocol",
              binder.protocolName
                ? `${binder.protocolName}, version ${binder.protocolVersion}`
                : null,
            ],
            ["Technician", binder.technicianName],
            ["City", binder.city],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="portal-kicker text-[var(--secondary)]">{label}</dt>
              <dd className="mt-1 text-[13.5px] leading-[1.5] text-[var(--ink)]">
                {value ? String(value) : <AbsentChip />}
              </dd>
            </div>
          ))}
        </dl>

        {/* ------------------------------------------------------- findings */}
        <section className="mt-8">
          <h2 className="font-display text-[16px] font-bold text-[var(--navy)]">
            What the protocol asked for
          </h2>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--secondary)]">
            {binder.complete
              ? "Every required item was captured."
              : `${binder.missingCount} required ${binder.missingCount === 1 ? "item is" : "items are"} missing. They are listed below rather than omitted.`}
          </p>

          <ul className="mt-4 divide-y divide-[var(--row-rule)]">
            {binder.items.map((item) => (
              <li key={item.itemKey} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{item.label}</span>
                  {item.required ? (
                    <StatusPill tone={item.satisfied ? "good" : "failed"}>
                      {item.satisfied ? "Captured" : "Missing"}
                    </StatusPill>
                  ) : (
                    <StatusPill tone={item.satisfied ? "good" : "inert"}>
                      {item.satisfied ? "Captured" : "Not captured, not required"}
                    </StatusPill>
                  )}
                </div>

                {/*
                  The shortfall is printed, never omitted. A binder that quietly
                  dropped what it could not show would be a binder that reads as
                  complete, which is the one thing it must never do.
                */}
                {item.shortfall ? (
                  <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--red)]">{item.shortfall}</p>
                ) : null}

                {item.captures.length > 0 ? (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {item.captures.map((c) => (
                      <li key={c.id} className="text-[12.5px] leading-[1.5] text-[var(--secondary)]">
                        {c.valueText ??
                          (c.valueNumber !== null
                            ? `${c.valueNumber}${c.unit ? ` ${c.unit}` : ""}`
                            : c.storageKey
                              ? "Photograph on file"
                              : "Captured")}
                        {WHEN(c.capturedAt) ? ` · ${WHEN(c.capturedAt)}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ decisions */}
        {binder.decisions.length > 0 ? (
          <section className="mt-8">
            <h2 className="font-display text-[16px] font-bold text-[var(--navy)]">
              Review decisions
            </h2>
            <ul className="mt-4 divide-y divide-[var(--row-rule)]">
              {binder.decisions.map((d, i) => (
                <li key={`${d.at}-${i}`} className="py-3 first:pt-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                    <StatusPill tone={DECISION_TONE[d.decision] ?? "inert"}>
                      {decisionLabel(d.decision)}
                    </StatusPill>
                    <span className="text-[12.5px] text-[var(--secondary)]">
                      {d.engineerName}
                      {d.licenseNumber ? ` · licence ${d.licenseNumber}` : ""} · {WHEN(d.at)}
                      {d.minutes !== null ? ` · ${d.minutes} minutes` : ""}
                    </span>
                  </div>
                  {d.reason ? (
                    <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--ink)]">{d.reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ---------------------------------------------------- limitations */}
        <SheetRecordNote>
          <strong className="font-bold text-[var(--ink)]">What this document is not.</strong>{" "}
          {binder.limitations.join(" ")}
        </SheetRecordNote>
      </DocumentSheet>
    </>
  );
}
