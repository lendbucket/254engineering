"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Problem, ghostClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * Approve exactly the content shown above it. Two steps, because an approval
 * puts a course in force for every technician who takes it, and cannot be
 * edited or removed once written.
 */
export function ApproveCourseButton({ course, version, title, hash }: { course: string; version: number; title: string; hash: string }) {
  const router = useRouter();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!sure) {
    return (
      <button type="button" className={ghostClass} onClick={() => setSure(true)}>
        Approve this course
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="w-full text-[14px] leading-[1.55] text-[var(--ink)]">
        You are approving &ldquo;{title}&rdquo;, version {version}, exactly as shown, content {hash.slice(0, 12)}. Once approved it is in force and the
        approval cannot be changed; a later change to the course is a new version that needs its own approval.
      </p>
      <button
        type="button"
        disabled={busy}
        className={primaryClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const result = await postJson("/api/portal/training", { action: "approve", course, version });
          setBusy(false);
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
      >
        {busy ? "Approving" : "Approve it"}
      </button>
      <button type="button" className={ghostClass} onClick={() => setSure(false)}>
        Cancel
      </button>
      <div className="w-full">
        <Problem message={error} />
      </div>
    </div>
  );
}
