"use client";

import { useEffect, useState } from "react";
import type { CoveragePreview } from "@/lib/ops-field";

/**
 * WHO COULD TAKE THIS JOB, SAID BEFORE IT IS TAKEN. The Killeen call, item 1
 * (Robert, 2026-11-14). Asks coverage_preview, which runs dispatch's own plan
 * for the county and line, whenever either changes. A failed ask is said; it
 * is never shown as "nobody covers it".
 */
export function CoverageNote({ serviceSlug, county }: { serviceSlug: string; county: string | null }) {
  const [preview, setPreview] = useState<CoveragePreview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [asked, setAsked] = useState("");

  const key = serviceSlug && county ? `${serviceSlug}|${county}` : "";

  useEffect(() => {
    if (!key) return;
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/portal/files", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "coverage_preview", serviceSlug, county }),
        });
        const body = (await res.json().catch(() => null)) as { ok?: boolean; preview?: CoveragePreview; error?: string } | null;
        if (!live) return;
        if (!res.ok || !body?.ok || !body.preview) {
          setFailed(body?.error ?? "Who covers this county could not be read.");
          setPreview(null);
        } else {
          setFailed(null);
          setPreview(body.preview);
        }
        setAsked(key);
      } catch {
        if (live) {
          setFailed("The network dropped that, so who covers this county is not known.");
          setAsked(key);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [key, serviceSlug, county]);

  if (!key) return null;
  if (asked !== key) return <p className="mt-2 text-[14px] text-[var(--secondary)]">Checking who covers {county} County.</p>;
  if (failed) return <p role="alert" className="mt-2 text-[14px] font-semibold text-[var(--ink)]">{failed}</p>;
  if (!preview) return null;
  if (!preview.known) return <p className="mt-2 text-[14px] text-[var(--secondary)]">{preview.why}</p>;

  if (preview.eligible > 0) {
    return (
      <p className="mt-2 text-[14px] leading-[1.55] text-[var(--ink)]">
        {preview.eligible} certified technician{preview.eligible === 1 ? "" : "s"} can be offered this job in {preview.county} County.
      </p>
    );
  }
  return (
    <div role="status" className="mt-2 border-l-2 border-[var(--ink)] py-1 pl-3">
      <p className="text-[14px] leading-[1.55] font-semibold text-[var(--ink)]">
        No certified technician covers {preview.county} County for this service. Taken now, the job waits at dispatch until one does.
      </p>
      {preview.couldCover.length > 0 ? (
        <>
          <p className="mt-1.5 text-[13.5px] text-[var(--ink)]">Certified for this service, not covering {preview.county} County:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {preview.couldCover.map((t) => (
              <li key={t.id} className="text-[13.5px] text-[var(--ink)]">
                <a href={`/portal/techs/${t.id}`} className="font-semibold text-[var(--navy)] underline">{t.displayName}</a>
                {t.covers.length ? `, covers ${t.covers.join(", ")}` : ", no counties set"}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[13px] text-[var(--secondary)]">
            Distance needs the property located, which happens when the job is taken; the file's dispatch plan orders them by miles.
          </p>
        </>
      ) : null}
      {preview.blocked.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {preview.blocked.map((b) => (
            <li key={b.displayName} className="text-[13.5px] text-[var(--ink)]">{b.displayName} covers it and cannot be offered work: {b.reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
