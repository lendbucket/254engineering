"use client";

import { useEffect, useState } from "react";
import { readDayPack } from "@/lib/field-day-store";
import type { DayPack } from "@/lib/field-day-rules";
import { formatInFirmZone } from "@/lib/firm-calendar";
import { Checklist } from "../[id]/CaptureClient";
import { PageHead } from "@/components/portal/surfaces";

/**
 * The offline screen's body: the day pack the phone holds, read from IndexedDB,
 * for the technician this screen was rendered for (Robert's T2, 2026-11-07).
 *
 * Which job: the address bar. The service worker shows this screen in place of
 * /portal/jobs/<id> when there is no signal, so the id is read from the path;
 * /portal/jobs/offline itself, or a job the pack does not hold, lists the day.
 *
 * The checklist is the job page's own component with the job page's own props,
 * carried in the pack (src/lib/job-checklist-props.ts), so a capture made here
 * goes into the same queue and uploads the same way when signal returns.
 * Removing an uploaded capture is not offered offline: it is a write the server
 * must see at once.
 */
const WHEN = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;

export function OfflineDay({ techId }: { techId: string }) {
  const [pack, setPack] = useState<DayPack | null | undefined>(undefined);
  const [jobId, setJobId] = useState<string | null>(null);

  useEffect(() => {
    const match = window.location.pathname.match(/^\/portal\/jobs\/([0-9a-f-]{36})$/i);
    setJobId(match ? match[1] : new URLSearchParams(window.location.search).get("id"));
    readDayPack(techId)
      .then((p) => setPack(p))
      .catch(() => setPack(null));
  }, [techId]);

  /*
   * SECTIONS ON THE PHONE GROUND, AS /portal/jobs IS. Robert's answer 2 of
   * 6743092030, after board 42600011991 measured this screen as one white
   * slab at 390. Every direct child of the portal's main column becomes a white
   * section with ground between (src/styles/portal.css, V10 rule 7), so every
   * state renders a page head and then its body as separate sections, and the
   * job's lines stay together in one section rather than spilling into four.
   */
  if (pack === undefined) {
    return (
      <>
        <PageHead eyebrow="Field" title="Your day" />
        <section>
          <p className="text-[14px] text-[var(--ink)]">Reading your day from this phone...</p>
        </section>
      </>
    );
  }

  if (pack === null) {
    return (
      <>
        <PageHead eyebrow="Field" title="No signal, and no jobs kept on this phone" />
        <section>
          <p className="max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
            Open My jobs once while you have signal before you leave. Your jobs for today and tomorrow are then kept on this
            phone for 48 hours, and open here with no signal.
          </p>
        </section>
      </>
    );
  }

  const asOf = formatInFirmZone(pack.packedAt, WHEN) ?? pack.packedAt;
  const job = jobId ? pack.jobs.find((j) => j.fileId === jobId) ?? null : null;

  return (
    <>
      {job ? (
        <PageHead
          eyebrow={job.fileNumber}
          title={job.propertyAddress}
          lede={`${job.city ? `${job.city}, ` : ""}${job.county} County. ${job.serviceName}.`}
        />
      ) : (
        <PageHead eyebrow="Field" title="Your day" />
      )}

      <section>
        <p className="border-t-2 border-[var(--ink)] pt-3 text-[14px] leading-[1.55] font-semibold text-[var(--ink)]">
          No signal. This is your day as the firm sent it at {asOf}. Photographs and answers are kept on this phone and upload
          when signal returns. Submitting needs signal.
        </p>
      </section>

      {job ? (
        <section>
          {job.checklist ? (
            <Checklist
              fileId={job.fileId}
              readOnly={false}
              canRemove={false}
              protocolName={job.checklist.protocolName}
              items={job.checklist.items}
              captures={job.checklist.captures}
              exceptions={job.checklist.exceptions}
            />
          ) : (
            <p className="text-[14px] text-[var(--ink)]">No protocol is attached to this file, so there is nothing to capture against yet.</p>
          )}
        </section>
      ) : (
        <section>
          {jobId ? (
            <p className="text-[14px] text-[var(--ink)]">That job is not among the jobs kept on this phone.</p>
          ) : null}
          {pack.jobs.length === 0 ? (
            <p className="mt-2 text-[14px] text-[var(--ink)]">No jobs for today or tomorrow were assigned to you when this was kept.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {pack.jobs.map((j) => (
                <li key={j.fileId}>
                  <a href={`/portal/jobs/${j.fileId}`} className="flex min-h-[48px] flex-col justify-center py-2 text-[15px] text-[var(--ink)]">
                    <span className="font-semibold">{j.propertyAddress}</span>
                    <span className="text-[13px] text-[var(--secondary)]">
                      {j.county} County. {j.serviceName}
                      {j.visitAt ? `. Visit ${formatInFirmZone(j.visitAt, WHEN) ?? j.visitAt}` : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
