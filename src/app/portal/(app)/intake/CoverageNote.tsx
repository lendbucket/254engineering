"use client";

import { useEffect, useState } from "react";
import type { CoveragePreview } from "@/lib/ops-field";

/**
 * WHO COULD TAKE THIS JOB, SAID BEFORE IT IS TAKEN. The Killeen call, item 1
 * (Robert, 2026-11-14). Asks coverage_preview, which runs dispatch's own plan
 * for the county and line, whenever either changes. A failed ask is said; it
 * is never shown as "nobody covers it".
 */
export function CoverageNote({
  serviceSlug,
  county,
  canAddCoverage = false,
}: {
  serviceSlug: string;
  county: string | null;
  /** profiles.update; the server asks it again. */
  canAddCoverage?: boolean;
}) {
  const [preview, setPreview] = useState<CoveragePreview | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [asked, setAsked] = useState("");
  /* Bumped after a county is added, so the preview is asked again on the same screen. */
  const [round, setRound] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);
  const [addSaid, setAddSaid] = useState<string | null>(null);

  const key = serviceSlug && county ? `${serviceSlug}|${county}|${round}` : "";

  async function addCounty(techId: string, name: string) {
    setAdding(techId);
    setAddSaid(null);
    try {
      const res = await fetch("/api/portal/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_coverage_county", techId, county }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setAddSaid(body?.error ?? `${county} County could not be added to ${name}'s coverage.`);
        return;
      }
      setAddSaid(`${county} County was added to ${name}'s coverage.`);
      setRound((r) => r + 1);
    } catch {
      setAddSaid("The network dropped that. Nothing was changed.");
    } finally {
      setAdding(null);
    }
  }

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
      <>
        <p className="mt-2 text-[14px] leading-[1.55] text-[var(--ink)]">
          {preview.eligible} certified technician{preview.eligible === 1 ? "" : "s"} can be offered this job in {preview.county} County.
        </p>
        {addSaid ? <p role="status" className="mt-1 text-[14px] font-semibold text-[var(--ink)]">{addSaid}</p> : null}
      </>
    );
  }
  return (
    <div role="status" className="mt-2 border-l-2 border-[var(--ink)] py-1 pl-3">
      <p className="text-[14px] leading-[1.55] font-semibold text-[var(--ink)]">
        No certified technician covers {preview.county} County for this service. Taken now, the job waits at dispatch until one does.
      </p>
      {preview.couldCover.length > 0 ? (
        <>
          <p className="mt-1.5 text-[14px] text-[var(--ink)]">Certified for this service, not covering {preview.county} County:</p>
          <ul className="mt-1 flex flex-col gap-1">
            {preview.couldCover.map((t) => (
              <li key={t.id} className="text-[14px] text-[var(--ink)]">
                <a href={`/portal/techs/${t.id}`} className="font-semibold text-[var(--navy)] underline">{t.displayName}</a>
                {t.covers.length ? `, covers ${t.covers.join(", ")}` : ", no counties set"}
                {canAddCoverage ? (
                  <button
                    type="button"
                    disabled={adding !== null}
                    onClick={() => void addCounty(t.id, t.displayName)}
                    className="ml-2 inline-flex min-h-[44px] items-center rounded-[2px] border border-[var(--border)] px-3 text-[14px] font-semibold text-[var(--navy)] disabled:opacity-50"
                  >
                    {adding === t.id ? "Adding" : `Add ${preview.county} County to ${t.displayName}`}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {addSaid ? <p role="status" className="mt-1.5 text-[14px] font-semibold text-[var(--ink)]">{addSaid}</p> : null}
          <p className="mt-1.5 text-[13px] text-[var(--secondary)]">
            Distance needs the property located, which happens when the job is taken; the file's dispatch plan orders them by miles.
          </p>
        </>
      ) : null}
      {preview.blocked.length > 0 ? (
        <ul className="mt-1.5 flex flex-col gap-1">
          {preview.blocked.map((b) => (
            <li key={b.displayName} className="text-[14px] text-[var(--ink)]">{b.displayName} covers it and cannot be offered work: {b.reason}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
