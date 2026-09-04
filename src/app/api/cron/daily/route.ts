import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { enqueue } from "@/lib/ops-jobs";
import { dayKey } from "@/lib/ops-metrics";
import { cronStarted, cronFinished, captureError } from "@/lib/ops-observability";

export const dynamic = "force-dynamic";

/**
 * Once a day, and it queues rather than computes.
 *
 * WHY THE ROLLUP IS NOT DONE HERE
 * -------------------------------
 * It reads a dozen tables across a whole day. That is exactly the shape of work
 * the queue exists for, and doing it inline would put a slow multi query job
 * inside a function whose timeout nobody is watching. This route writes one row
 * and returns; the worker does the counting a minute later, with retries and a
 * dead letter if the database is unreachable.
 *
 * WHY YESTERDAY AND NOT TODAY
 * ---------------------------
 * A rollup of today is a partial figure that looks exactly like a final one,
 * and nothing in the table distinguishes them. Whoever reads a chart six months
 * from now would have no way to know the last bar is half a day. So the job
 * always closes a day that is over.
 *
 * WHY IT IS SAFE FOR THIS TO FIRE TWICE
 * -------------------------------------
 * The enqueue is keyed on the day, so a second fire within the same day finds
 * the first job still pending and adds nothing. And if it somehow got past that,
 * the rollup recomputes from source rows rather than accumulating, so the
 * numbers would be identical.
 */

function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET ?? "";
  if (!expected) return NextResponse.json({ ok: false }, { status: 404 });

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  /*
   * The run is recorded before any work, so a run killed by a timeout leaves a
   * row with no finished_at rather than leaving nothing at all. The status page
   * reads that as "started and never reported", which is a different and more
   * useful thing than the silence it would otherwise show.
   */
  const runId = await cronStarted("daily");
  const yesterday = dayKey(new Date(Date.now() - 86_400_000));

  try {
    const queued = await enqueue("metrics.rollup", { day: yesterday });

    if (!queued.ok) {
      await cronFinished(runId, false, queued.error);
      await captureError(new Error(queued.error), { route: "/api/cron/daily", kind: "cron" });
      return NextResponse.json({ ok: false, error: queued.error }, { status: 503 });
    }

    await cronFinished(
      runId,
      true,
      queued.duplicate ? `${yesterday} was already queued` : `queued the rollup for ${yesterday}`,
    );

    console.log(
      `[daily] rollup for ${yesterday} ${queued.duplicate ? "was already queued" : "queued"} as job ${queued.id}`,
    );

    return NextResponse.json({ ok: true, day: yesterday, duplicate: queued.duplicate });
  } catch (err) {
    await cronFinished(runId, false, err instanceof Error ? err.message : "unknown");
    await captureError(err, { route: "/api/cron/daily", kind: "cron" });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
