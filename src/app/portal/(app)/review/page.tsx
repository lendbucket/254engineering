import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { packageFor, reviewQueue } from "@/lib/ops-engineer";
import { availableReviewActions, isBriskReview } from "@/lib/ops-review";
import { STATUS_LABEL, STATUS_TONE, type FileStatus } from "@/lib/ops-files";
import { isPrelaunch } from "@/lib/launch";
import { services } from "@/content/services";
import { Chip, EmptyState, PageHead } from "@/components/portal/surfaces";
import { DecisionPanel, OpenReviewButton } from "./ReviewClient";

export const dynamic = "force-dynamic";

/**
 * The review queue and the evidence package.
 *
 * WHAT THIS SCREEN IS FOR
 * -----------------------
 * A licensed engineer deciding whether they will put their seal on a
 * conclusion. Everything on it serves that: the protocol beside the evidence,
 * every photograph at a size worth looking at, the shortfalls named, and the
 * four decisions with the same weight given to declining as to sealing.
 *
 * OLDEST SUBMISSION FIRST
 * -----------------------
 * A review queue sorted newest first is one where the awkward file somebody
 * keeps skipping sinks out of sight. The one that has been waiting longest is
 * at the top.
 */

const when = (value: string | null) =>
  value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : null;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await currentActor();
  if (!can(actor, "review.queue")) notFound();
  const params = await searchParams;

  const queue = await reviewQueue(actor);
  const selected = params.id ? await packageFor(actor, params.id) : null;
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  const actions = selected
    ? availableReviewActions(
        actor,
        {
          status: selected.file.status as FileStatus,
          packageComplete: selected.complete,
          assignedEngineerId: actor!.id,
        },
        { prelaunch: isPrelaunch() },
      )
    : [];

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Review queue"
        lede="Evidence packages waiting on a decision, longest waiting first. Four decisions, and declining to seal carries the same weight as sealing."
      />

      {isPrelaunch() ? (
        <div className="mb-5 rounded-[4px] border border-[#f0d9a8] bg-[#fdf3e0] px-4 py-3">
          <p className="text-[12px] font-bold tracking-[0.1em] text-[#7a4c05] uppercase">
            Compliance gate active
          </p>
          <p className="mt-1 max-w-[75ch] text-[13px] leading-[1.55] text-[#7a4c05]">
            Nothing can be sealed while firm registration is pending and no Professional Engineer is
            in responsible charge. Packages can be reviewed, sent back, and declined. Declining stays
            available on purpose: a gate that stopped an engineer saying no, while leaving yes open,
            would be the wrong way round.
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className={selected ? "hidden lg:block" : "block"}>
          {queue.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              body="A file arrives here when a technician submits a complete evidence package. It stays until an engineer decides it."
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {queue.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/portal/review?id=${f.id}`}
                    className={`block rounded-[4px] border bg-white p-4 transition-colors hover:border-slate ${
                      selected?.file.id === f.id
                        ? "border-slate"
                        : "border-limestone-line"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[12.5px] text-brass-ink">{f.file_number}</p>
                        <p className="mt-1 text-[14.5px] font-semibold text-slate">{f.property_address}</p>
                        <p className="mt-0.5 text-[13px] text-slate-muted">
                          {f.county} County, {serviceName(f.service_slug)}
                        </p>
                        {when(f.evidence_submitted_at) ? (
                          <p className="mt-1 text-[12.5px] text-slate-muted">
                            Submitted {when(f.evidence_submitted_at)}
                            {f.revision_count > 0
                              ? `, ${f.revision_count} revision${f.revision_count === 1 ? "" : "s"} so far`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                      <Chip
                        label={STATUS_LABEL[f.status as FileStatus] ?? f.status}
                        tone={STATUS_TONE[f.status as FileStatus] ?? "neutral"}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected ? (
          <div>
            <Link
              href="/portal/review"
              className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-slate-muted lg:hidden"
            >
              Back to the queue
            </Link>

            <div className="rounded-[4px] border border-limestone-line bg-white">
              <div className="border-b border-limestone-line px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[12.5px] text-brass-ink">{selected.file.file_number}</p>
                    <h2 className="mt-1 font-display text-[20px] leading-[1.2] font-bold text-slate">
                      {selected.file.property_address}
                    </h2>
                    <p className="mt-1 text-[13.5px] text-slate-muted">
                      {selected.file.city ? `${selected.file.city}, ` : ""}
                      {selected.file.county} County
                      {selected.protocolName ? `, worked to ${selected.protocolName}` : ""}
                      {selected.technician ? `, captured by ${selected.technician.name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Chip
                      label={STATUS_LABEL[selected.file.status as FileStatus] ?? selected.file.status}
                      tone={STATUS_TONE[selected.file.status as FileStatus] ?? "neutral"}
                    />
                    {selected.file.twia_county ? <Chip label="Windstorm county" tone="warn" /> : null}
                    <Chip
                      label={selected.complete ? "Package complete" : `${selected.blockers.length} missing`}
                      tone={selected.complete ? "good" : "bad"}
                    />
                  </div>
                </div>

                {selected.session ? (
                  <p className="mt-3 text-[13px] text-slate-muted">
                    In review for {selected.session.minutesSoFar} minute
                    {selected.session.minutesSoFar === 1 ? "" : "s"}. The elapsed time goes on your
                    responsible charge record.
                    {isBriskReview(selected.session.minutesSoFar)
                      ? " Anything under three minutes is flagged on your own record, not blocked."
                      : ""}
                  </p>
                ) : null}
              </div>

              {selected.file.status === "refused" && selected.file.refusal_reason ? (
                <div className="border-b border-limestone-line bg-[#fdf1f0] px-4 py-4 sm:px-5">
                  <p className="text-[12px] font-bold tracking-[0.1em] text-[#a3241c] uppercase">
                    Declined to seal
                  </p>
                  <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[#a3241c]">
                    {selected.file.refusal_reason}
                  </p>
                </div>
              ) : null}

              <div className="px-4 py-5 sm:px-5">
                {!selected.session && selected.file.status !== "refused" ? (
                  <OpenReviewButton fileId={selected.file.id} status={selected.file.status} />
                ) : null}

                <p className="mt-2 text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                  Evidence
                </p>

                {selected.items.length === 0 ? (
                  <p className="mt-3 text-[13.5px] text-slate-muted">
                    No protocol is attached to this file, so there is nothing to review against.
                  </p>
                ) : (
                  <ol className="mt-3 flex flex-col gap-4">
                    {selected.items.map((item, i) => (
                      <li
                        key={item.id}
                        className={`rounded-[4px] border p-4 ${
                          item.satisfied
                            ? "border-limestone-line border-l-[#2f6b45]"
                            : item.required
                              ? "border-[#e8bdb8] border-l-[#a3241c]"
                              : "border-limestone-line"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[14.5px] leading-[1.35] font-semibold text-slate">
                            {i + 1}. {item.label}
                            {item.required ? "" : " (optional)"}
                          </p>
                          {!item.satisfied && item.problem ? (
                            <p className="text-[13px] font-semibold text-[#a3241c]">{item.problem}</p>
                          ) : null}
                        </div>
                        {item.instructions ? (
                          <p className="mt-1 max-w-[70ch] text-[13px] leading-[1.5] text-slate-muted">
                            {item.instructions}
                          </p>
                        ) : null}

                        {item.captures.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-3">
                            {item.captures.map((c) => (
                              <li key={c.id}>
                                {!c.url && c.storageKey ? (
                                  /*
                                   * A photograph whose file could not be
                                   * loaded. It must NOT fall through to the
                                   * text fallback below, which would render
                                   * the word "Captured" and leave an engineer
                                   * believing they had looked at an image they
                                   * never saw. Sealing on that basis is the
                                   * failure this whole screen exists to
                                   * prevent.
                                   */
                                  <p className="flex h-40 w-40 items-center justify-center rounded-[3px] border border-[#a3241c] bg-[#fdf1f0] px-3 text-center text-[12.5px] leading-[1.4] font-semibold text-[#a3241c]">
                                    This file could not be loaded. Do not seal on it.
                                  </p>
                                ) : c.url ? (
                                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={c.url}
                                      alt={`${item.label}, captured ${c.capturedAt ?? "at an unrecorded time"}`}
                                      className="h-40 w-40 rounded-[3px] border border-limestone-line object-cover"
                                    />
                                    {c.lat !== null && c.lng !== null ? (
                                      <span className="mt-1 block text-[11.5px] text-slate-muted">
                                        {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                                      </span>
                                    ) : (
                                      <span className="mt-1 block text-[11.5px] text-slate-muted">
                                        No location recorded
                                      </span>
                                    )}
                                  </a>
                                ) : (
                                  <p className="rounded-[3px] border border-limestone-line px-3 py-2 text-[13.5px] text-slate">
                                    {c.valueNumber !== null
                                      ? `${c.valueNumber}${c.unit ? ` ${c.unit}` : ""}`
                                      : (c.valueText ?? "Captured")}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}

                <div className="mt-7 border-t border-limestone-line pt-6">
                  <DecisionPanel
                    fileId={selected.file.id}
                    actions={actions}
                    complete={selected.complete}
                    blockers={selected.blockers}
                    inReview={Boolean(selected.session)}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              title="No package open"
              body="Choose a file from the queue. The protocol, every photograph, and the shortfalls are on one screen, because deciding whether to seal is one decision."
            />
          </div>
        )}
      </div>
    </>
  );
}
