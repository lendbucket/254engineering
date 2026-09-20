"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  checklistState,
  newCaptureId,
  progressLabel,
  type CapturedItem,
  type EvidenceKind,
  type ItemException,
  type ProtocolItem,
} from "@/lib/ops-evidence";
import { dequeue, enqueue, flushOne, markAttempt, pendingFor, positionOrNull, type QueuedCapture } from "@/lib/offline-queue";

/**
 * The checklist a technician works.
 *
 * THE GATE IS COMPUTED HERE AND ENFORCED ON THE SERVER
 * ----------------------------------------------------
 * checklistState runs in this component so the progress and the blockers update
 * the instant a photograph is taken, with no round trip. It is the same function
 * submitEvidence calls on the server, which is what makes the disabled button
 * and the actual refusal agree.
 *
 * The button is not the gate. If somebody re-enables it in a console, the server
 * runs the same check against the rows that actually exist and refuses. What the
 * button buys is that a technician is never told no after driving away.
 *
 * PENDING CAPTURES COUNT TOWARD THE GATE
 * --------------------------------------
 * A capture sitting in the offline queue is a photograph that exists. It has not
 * reached the server yet, so it counts locally and the submit button says so:
 * the package cannot be submitted until the queue is empty, because the server
 * would look at rows that are not there and refuse. Showing the technician that
 * distinction, rather than a spinner, is the difference between waiting and
 * wondering.
 */

type Item = {
  id: string;
  itemKey: string;
  kind: EvidenceKind;
  label: string;
  instructions: string | null;
  required: boolean;
  unit: string | null;
  minValue: number | null;
  maxValue: number | null;
  minCount: number | null;
};

type ServerCapture = {
  id: string;
  itemKey: string;
  kind: EvidenceKind;
  valueText: string | null;
  valueNumber: number | null;
  storageKey: string | null;
};

const KIND_VERB: Record<EvidenceKind, string> = {
  photo: "Take a photograph",
  measurement: "Record the measurement",
  reading: "Record the reading",
  document: "Attach the document",
  note: "Write the note",
};

type ServerException = {
  itemKey: string;
  kind: "not_observed" | "not_applicable";
  reason: string;
};

export function Checklist({
  fileId,
  items,
  captures,
  exceptions,
  protocolName,
  readOnly,
}: {
  fileId: string;
  items: Item[];
  captures: ServerCapture[];
  exceptions: ServerException[];
  protocolName: string;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedCapture[]>([]);
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const previews = useRef(new Map<string, string>());

  const refreshQueue = useCallback(async () => {
    try {
      const pending = await pendingFor(fileId);
      for (const entry of pending) {
        if (entry.blob && !previews.current.has(entry.id)) {
          previews.current.set(entry.id, URL.createObjectURL(entry.blob));
        }
      }
      setQueue(pending);
    } catch {
      // A browser with IndexedDB blocked. Capture still works; it just does not
      // survive a reload, and the banner below says so.
      setQueue([]);
    }
  }, [fileId]);

  /**
   * Push whatever is queued.
   *
   * Serial rather than parallel, because ten photographs uploading at once on a
   * rural connection is ten uploads that all crawl and any of which can time
   * out. One at a time finishes the first one.
   */
  const flush = useCallback(async () => {
    if (flushing) return;
    setFlushing(true);
    try {
      const pending = await pendingFor(fileId);
      let sent = 0;
      for (const entry of pending) {
        const result = await flushOne(entry);
        if (result.ok) {
          await dequeue(entry.id);
          sent++;
        } else {
          await markAttempt(entry, result.error);
          break;
        }
      }
      await refreshQueue();
      if (sent > 0) router.refresh();
    } finally {
      setFlushing(false);
    }
  }, [fileId, flushing, refreshQueue, router]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshQueue();

    const up = () => {
      setOnline(true);
      void flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
    // flush is intentionally not a dependency: re-subscribing on every flush
    // state change would tear the listeners down mid upload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshQueue]);

  /** The protocol as the pure module wants it. */
  const protocolItems: ProtocolItem[] = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        itemKey: i.itemKey,
        kind: i.kind,
        label: i.label,
        instructions: i.instructions,
        required: i.required,
        unit: i.unit,
        minValue: i.minValue,
        maxValue: i.maxValue,
        minCount: i.minCount,
      })),
    [items],
  );

  /** Everything captured: on the server, plus everything still in the queue. */
  const captured: CapturedItem[] = useMemo(
    () => [
      ...captures.map((c) => ({
        itemKey: c.itemKey,
        kind: c.kind,
        valueText: c.valueText,
        valueNumber: c.valueNumber,
        storageKey: c.storageKey,
      })),
      ...queue.map((q) => ({
        itemKey: q.itemKey,
        kind: q.kind,
        valueText: q.valueText ?? null,
        valueNumber: q.valueNumber ?? null,
        // A queued photograph has bytes on the device. For the purpose of the
        // gate it exists; the banner is what says it has not landed yet.
        storageKey: q.blob ? `queued:${q.id}` : null,
      })),
    ],
    [captures, queue],
  );

  /**
   * Everything recorded as an absence: on the server, plus anything still
   * queued, for the same reason a queued photograph counts. A technician who
   * has typed the reason has answered the item, and showing it as outstanding
   * until the signal returns would invite them to answer it twice.
   */
  const recordedAbsences: ItemException[] = useMemo(
    () => [
      ...exceptions.map((e) => ({ itemKey: e.itemKey, kind: e.kind, reason: e.reason })),
      ...queue
        .filter((q) => q.exception)
        .map((q) => ({ itemKey: q.itemKey, kind: q.exception!.kind, reason: q.exception!.reason })),
    ],
    [exceptions, queue],
  );

  /*
   * THE EXCEPTIONS ARE PASSED, AND THIS IS THE SAME WIRING THE SERVER NEEDED.
   *
   * checklistState's third argument defaults to an empty list, so a caller that
   * forgets it gets a gate that silently cannot see an absence. Two callers
   * compute this state, here and in jobView, and BOTH had to be taught. A
   * default that reads as "none recorded" is indistinguishable from "nobody
   * asked", which is the overloaded null this repository keeps meeting.
   */
  const state = useMemo(
    () => checklistState(protocolItems, captured, recordedAbsences),
    [protocolItems, captured, recordedAbsences],
  );

  async function capture(item: Item, payload: { blob?: Blob; text?: string; value?: number }) {
    setError(null);
    const position = await positionOrNull();
    const entry: QueuedCapture = {
      id: newCaptureId(),
      fileId,
      itemKey: item.itemKey,
      kind: item.kind,
      blob: payload.blob,
      contentType: payload.blob?.type,
      valueText: payload.text ?? null,
      valueNumber: payload.value ?? null,
      capturedAt: new Date().toISOString(),
      lat: position?.coords.latitude ?? null,
      lng: position?.coords.longitude ?? null,
      accuracy: position?.coords.accuracy ?? null,
      attempts: 0,
    };

    try {
      await enqueue(entry);
      if (payload.blob) previews.current.set(entry.id, URL.createObjectURL(payload.blob));
      await refreshQueue();
    } catch {
      setError("This phone would not store that locally. Stay in signal and it will upload directly.");
    }
    if (navigator.onLine) void flush();
  }

  /**
   * Record why an item could not be done. Section 7 of the signed protocol: no
   * item is estimated, assumed, or left blank.
   *
   * It goes through the same queue as a capture, so it survives a reload and a
   * dead patch of signal. Nothing about this path is faster than a capture on
   * purpose: the technician has stopped to type a sentence either way, and the
   * one thing that must not be quick is recording an absence by accident.
   */
  async function recordAbsence(item: Item, kind: "not_observed" | "not_applicable", reason: string) {
    setError(null);
    const entry: QueuedCapture = {
      id: newCaptureId(),
      fileId,
      itemKey: item.itemKey,
      kind: item.kind,
      exception: { kind, reason },
      capturedAt: new Date().toISOString(),
      attempts: 0,
    };
    try {
      await enqueue(entry);
      await refreshQueue();
    } catch {
      setError("This phone would not store that locally. Stay in signal and it will send directly.");
    }
    if (navigator.onLine) void flush();
  }

  /**
   * Take it back, which is what happens when the technician gets onto the roof
   * after all.
   *
   * A queued absence is dropped from the queue; a recorded one is withdrawn on
   * the server. Both are the same act to the person doing it, and the two
   * branches exist because the row is in two different places.
   */
  async function withdrawAbsence(item: Item) {
    setError(null);
    const queued = queue.find((q) => q.itemKey === item.itemKey && q.exception);
    if (queued) {
      await dequeue(queued.id);
      await refreshQueue();
      return;
    }
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw_exception", fileId, itemKey: item.itemKey }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        return;
      }
      router.refresh();
    } catch {
      setError("The network dropped that. Try again when you have signal.");
    }
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    setBlockers([]);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_evidence", fileId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; blockers?: string[] }
        | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        setBlockers(body?.blockers ?? []);
        return;
      }
      router.push("/portal/jobs");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again when you have signal.");
    } finally {
      setSubmitting(false);
    }
  }

  const queued = queue.length;
  const canSubmit = state.canSubmit && queued === 0 && !readOnly;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <p className="portal-kicker text-[var(--gold-deep)]">
          {protocolName}
        </p>
        <p className="text-[13.5px] font-semibold text-[var(--navy)]">{progressLabel(state)}</p>
      </div>

      {!online ? (
        <div className="mb-4 rounded-[4px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3">
          <p className="text-[13.5px] leading-[1.55] font-semibold text-[var(--warn-ink)]">
            No signal. Keep working.
          </p>
          <p className="mt-1 text-[13.5px] leading-[1.55] text-[var(--warn-ink)]">
            Everything you capture is held on this phone and uploads by itself when you are back in
            range. Do not close this tab until it has.
          </p>
        </div>
      ) : null}

      {queued > 0 ? (
        <div className="mb-4 rounded-[4px] border border-[var(--border)] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] font-semibold text-[var(--navy)]">
              {queued} capture{queued === 1 ? "" : "s"} waiting to upload
            </p>
            <button
              type="button"
              onClick={() => void flush()}
              disabled={flushing || !online}
              className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] disabled:opacity-50"
            >
              {flushing ? "Uploading" : "Upload now"}
            </button>
          </div>
          {queue.find((q) => q.lastError) ? (
            <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
              Last attempt: {queue.find((q) => q.lastError)?.lastError}
            </p>
          ) : null}
        </div>
      ) : null}

      <ol className="flex flex-col gap-3">
        {items.map((item, index) => {
          /*
           * READ OFF THE ONE STATE RATHER THAN RECOMPUTED PER ROW.
           *
           * This called itemStatus again for each item, which was a second
           * answer to the question the gate had just answered, and it went
           * wrong the moment exceptions existed: the row would have shown an
           * item as outstanding while the submit button, reading the state that
           * knows about absences, said the package was ready. Two right answers
           * to one question, until one of them learns something the other has
           * not.
           */
          const status = state.items[index];
          const mine = queue.filter((q) => q.itemKey === item.itemKey && !q.exception);
          const needed = item.kind === "photo" ? Math.max(1, item.minCount ?? 1) : 1;

          return (
            <li
              key={item.id}
              className={`rounded-[4px] border bg-white p-4 ${
                status.satisfied
                  ? "border-[var(--border)] border-l-[var(--green)]"
                  : item.required
                    ? "border-[var(--border)]"
                    : "border-[var(--border)]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] leading-[1.35] font-semibold text-[var(--navy)]">
                    {index + 1}. {item.label}
                    {item.required ? "" : " (optional)"}
                  </p>
                  {item.instructions ? (
                    <p className="mt-1 max-w-[65ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                      {item.instructions}
                    </p>
                  ) : null}
                  {/*
                    * AN ABSENCE READS AS AN ABSENCE, NEVER AS "CAPTURED".
                    *
                    * Both open the gate, and they are not the same fact. The
                    * engineer weighs a recorded absence differently from a
                    * photograph, and a technician who sees "Captured" beside an
                    * item they never saw will assume somebody else did it.
                    */}
                  <p className="mt-1.5 text-[13.5px] font-semibold text-[var(--secondary)]">
                    {status.exception
                      ? status.exception.kind === "not_applicable"
                        ? "Marked as not applicable"
                        : "Marked as could not be observed"
                      : status.satisfied
                        ? item.kind === "photo" && needed > 1
                          ? `${status.captured} of ${needed} captured`
                          : "Captured"
                        : status.problem}
                  </p>
                  {status.exception ? (
                    <p className="mt-1 max-w-[65ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                      &ldquo;{status.exception.reason}&rdquo;
                    </p>
                  ) : null}
                </div>
              </div>

              {mine.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {mine.map((q) =>
                    previews.current.get(q.id) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <li key={q.id}>
                        <img
                          src={previews.current.get(q.id)}
                          alt=""
                          className="h-16 w-16 rounded-[3px] border border-[var(--border)] object-cover"
                        />
                      </li>
                    ) : null,
                  )}
                </ul>
              ) : null}

              {readOnly ? null : status.exception ? (
                <button
                  type="button"
                  onClick={() => void withdrawAbsence(item)}
                  className="mt-3 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)]"
                >
                  I can record this after all
                </button>
              ) : (
                <>
                  <CaptureControl item={item} onCapture={(payload) => void capture(item, payload)} />
                  {status.satisfied ? null : (
                    <AbsenceControl
                      label={item.label}
                      onRecord={(kind, reason) => void recordAbsence(item, kind, reason)}
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-7 border-t border-[var(--border)] pt-6">
        {error ? (
          <p role="alert" className="mb-3 text-[13.5px] leading-[1.5] font-semibold text-[var(--red)]">
            {error}
          </p>
        ) : null}

        {blockers.length > 0 ? (
          <ul className="mb-3 flex flex-col gap-1">
            {blockers.map((b) => (
              <li key={b} className="text-[13.5px] leading-[1.5] text-[var(--red)]">
                {b}
              </li>
            ))}
          </ul>
        ) : null}

        {readOnly ? (
          <p className="text-[13.5px] leading-[1.55] text-[var(--secondary)]">
            This package has been submitted. It is with the engineer now, and capture is closed on
            it. If something needs to change, they will send it back with a note saying what.
          </p>
        ) : (
          <>
            {!state.canSubmit && state.blockers.length > 0 ? (
              <div className="mb-4">
                <p className="portal-kicker text-[var(--gold-deep)]">
                  Still needed
                </p>
                <ul className="mt-2 flex flex-col gap-1">
                  {state.blockers.map((b) => (
                    <li key={b} className="text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {state.canSubmit && queued > 0 ? (
              <p className="mb-3 text-[13.5px] leading-[1.55] text-[var(--secondary)]">
                Everything is captured. {queued} item{queued === 1 ? " is" : "s are"} still uploading,
                and the package can be submitted once they land.
              </p>
            ) : null}

            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={() => void submit()}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[16px] font-bold text-white transition-colors hover:bg-[var(--navy-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {submitting ? "Submitting" : "Submit this package"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The control for one item, which is a different control per kind.
 *
 * The photograph input carries capture="environment", which on a phone opens the
 * rear camera directly rather than a file browser. On a desktop the same input
 * is a file picker, which is what an administrator attaching something on behalf
 * of a technician needs, so one element serves both without a branch.
 */
/**
 * RECORDING WHY AN ITEM COULD NOT BE DONE.
 *
 * DESIGNED AGAINST BEING EASY, which is the opposite of everything else on this
 * screen. Capture is one tap because a technician with gloves on is doing it
 * fifty one times. This is three deliberate acts, closed by default, because
 * the failure mode it guards is not a slow technician: it is a quick one
 * clearing the last four items on the way to the truck.
 *
 * Section 7 of the signed protocol is the whole reason it exists at all. "The
 * technician records each item that could not be observed and the reason. No
 * item is estimated, assumed, or left blank." Before this, a roof that could not
 * be walked left them with nothing honest to do, and the pressure of a gate
 * that will not open is what produces a photograph of something else.
 *
 * The two kinds are separate buttons rather than a dropdown. "I could not see
 * it" and "there is none here" are different claims about a property and the
 * engineer weighs them differently, so the technician chooses one and the
 * screen never picks a default.
 */
function AbsenceControl({
  label,
  onRecord,
}: {
  label: string;
  onRecord: (kind: "not_observed" | "not_applicable", reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"not_observed" | "not_applicable" | null>(null);
  const [reason, setReason] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--secondary)] underline underline-offset-4"
      >
        I cannot record this one
      </button>
    );
  }

  const chip = (value: "not_observed" | "not_applicable", text: string) => (
    <button
      type="button"
      onClick={() => setKind(value)}
      aria-pressed={kind === value}
      className={`inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[3px] border px-3 text-[13.5px] font-semibold ${
        kind === value
          ? "border-[var(--navy)] bg-[var(--navy)] text-white"
          : "border-[var(--border)] bg-white text-[var(--navy)]"
      }`}
    >
      {text}
    </button>
  );

  return (
    <div className="mt-3 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] p-3">
      <p className="text-[13.5px] leading-[1.5] font-semibold text-[var(--navy)]">
        Which is it?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {chip("not_observed", "Could not see it")}
        {chip("not_applicable", "Does not apply here")}
      </div>

      <label htmlFor={`why-${label}`} className="mt-3 block text-[13.5px] font-semibold text-[var(--navy)]">
        Why
      </label>
      <p className="mt-0.5 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
        The engineer reads this before signing. Say what you saw and what stopped you.
      </p>
      <textarea
        id={`why-${label}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] bg-white p-2.5 text-[16px] leading-[1.5] text-[var(--navy)]"
      />

      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={kind === null || reason.trim().length < 3}
          onClick={() => {
            if (kind === null) return;
            onRecord(kind, reason.trim());
            setOpen(false);
            setKind(null);
            setReason("");
          }}
          className="inline-flex min-h-[44px] items-center rounded-[3px] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Record this
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setKind(null);
            setReason("");
          }}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)]"
        >
          Cancel
        </button>
      </div>
      {kind !== null && reason.trim().length > 0 && reason.trim().length < 3 ? (
        <p className="mt-2 text-[13.5px] leading-[1.5] text-[var(--secondary)]">
          A few words at least. This goes on the record beside the engineer&rsquo;s seal.
        </p>
      ) : null}
    </div>
  );
}

/**
 * THE REPAIR LIST ON THE REVISIT, AND WHY IT SITS ABOVE THE CHECKLIST.
 *
 * A technician dispatched back to a property after repairs is there for one
 * reason, and it is not the standard Appendix B sweep. Appendix C's SITE
 * REVISIT heading says the capture list is "an engineer-specified capture list,
 * which is not the standard Appendix B list", and the criterion for a repairs
 * revisit is "return after repairs to verify each item on the repair list".
 *
 * So the list he was sent for goes first, and the checklist is underneath it.
 * Putting the fifty one item checklist on top and the four repairs below would
 * bury the entire purpose of the journey.
 *
 * ONE ITEM AT A TIME, AND NO VERIFY ALL. The operator's ruling is that a file
 * cannot be sealed without every item individually closed, and a button that
 * closed four at once is that rule with the word individually taken out. Four
 * taps is the point.
 */
export function RepairList({
  fileId,
  repairs,
  captures,
  readOnly,
}: {
  fileId: string;
  repairs: {
    id: string;
    requirement: string;
    closedAt: string | null;
    closedNote: string | null;
  }[];
  captures: { id: string; itemKey: string }[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (repairs.length === 0) return null;
  const open = repairs.filter((r) => r.closedAt === null).length;

  async function verify(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "close_repair_item",
          fileId,
          repairItemId: id,
          note: note.trim() || null,
          evidenceId: evidenceId || null,
        }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.error ?? "That did not work.");
        return;
      }
      setOpenId(null);
      setNote("");
      setEvidenceId("");
      router.refresh();
    } catch {
      setError("The network dropped that. Try again when you have signal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 rounded-[4px] border border-[var(--gold)] bg-[var(--gold-wash)] p-4">
      <p className="portal-kicker text-[var(--gold-deep)]">Repairs to verify</p>
      <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.55] text-[var(--ink)]">
        {open === 0
          ? "Every repair on this list has been verified. The engineer decides from here."
          : `The engineer withheld certification until these are done. ${open} still to verify, one at a time. This file cannot be sealed until every one of them is closed.`}
      </p>

      <ol className="mt-3 flex flex-col gap-2">
        {repairs.map((r, i) => (
          <li key={r.id} className="rounded-[3px] border border-[var(--border)] bg-white p-3">
            <p className="text-[15px] leading-[1.35] font-semibold text-[var(--navy)]">
              {i + 1}. {r.requirement}
            </p>
            {r.closedAt !== null ? (
              <>
                <p className="mt-1 text-[13.5px] font-semibold text-[var(--green)]">Verified</p>
                {r.closedNote ? (
                  <p className="mt-0.5 max-w-[65ch] text-[13.5px] leading-[1.5] text-[var(--secondary)]">
                    &ldquo;{r.closedNote}&rdquo;
                  </p>
                ) : null}
              </>
            ) : readOnly ? (
              <p className="mt-1 text-[13.5px] text-[var(--secondary)]">Not yet verified.</p>
            ) : openId === r.id ? (
              <div className="mt-2.5">
                <label
                  htmlFor={`repair-note-${r.id}`}
                  className="block text-[13.5px] font-semibold text-[var(--navy)]"
                >
                  What you saw
                </label>
                <textarea
                  id={`repair-note-${r.id}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="mt-1.5 w-full rounded-[3px] border border-[var(--border)] bg-white p-2.5 text-[16px] leading-[1.5] text-[var(--navy)]"
                />

                {captures.length > 0 ? (
                  <>
                    <label
                      htmlFor={`repair-photo-${r.id}`}
                      className="mt-2.5 block text-[13.5px] font-semibold text-[var(--navy)]"
                    >
                      The photograph that shows it (optional)
                    </label>
                    <select
                      id={`repair-photo-${r.id}`}
                      value={evidenceId}
                      onChange={(e) => setEvidenceId(e.target.value)}
                      className="mt-1.5 min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-2.5 text-[16px] text-[var(--navy)]"
                    >
                      <option value="">None</option>
                      {captures.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.itemKey}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}

                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || (evidenceId === "" && note.trim().length < 3)}
                    onClick={() => void verify(r.id)}
                    className="inline-flex min-h-[44px] items-center rounded-[3px] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Recording" : "Record it verified"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenId(null);
                      setNote("");
                      setEvidenceId("");
                    }}
                    className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpenId(r.id);
                  setNote("");
                  setEvidenceId("");
                }}
                className="mt-2 inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)]"
              >
                Verify this one
              </button>
            )}
          </li>
        ))}
      </ol>

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] leading-[1.5] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CaptureControl({
  item,
  onCapture,
}: {
  item: Item;
  onCapture: (payload: { blob?: Blob; text?: string; value?: number }) => void;
}) {
  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const inputId = `cap-${item.id}`;

  if (item.kind === "photo" || item.kind === "document") {
    return (
      <div className="mt-3">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-[48px] w-full cursor-pointer items-center justify-center rounded-[3px] border border-slate bg-slate px-4 text-[15px] font-bold text-[var(--on-navy)] sm:w-auto sm:px-6"
        >
          {KIND_VERB[item.kind]}
        </label>
        <input
          id={inputId}
          type="file"
          accept={item.kind === "photo" ? "image/*" : "image/*,application/pdf"}
          {...(item.kind === "photo" ? { capture: "environment" as const } : {})}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onCapture({ blob: file });
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (item.kind === "note") {
    return (
      <div className="mt-3">
        <label htmlFor={inputId} className="sr-only">
          {item.label}
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="What you saw"
          className="w-full rounded-[3px] border border-[var(--border)] bg-white px-3 py-2.5 text-[16px] leading-[1.5] text-[var(--navy)] outline-none focus:border-slate"
        />
        <button
          type="button"
          disabled={text.trim().length === 0}
          onClick={() => {
            onCapture({ text: text.trim() });
            setText("");
          }}
          className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-[3px] border border-slate bg-slate px-4 text-[15px] font-bold text-[var(--on-navy)] disabled:opacity-50 sm:w-auto sm:px-6"
        >
          Save this note
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <div className="min-w-[140px] flex-1">
        <label htmlFor={inputId} className="block text-[13.5px] font-semibold text-[var(--navy)]">
          {item.unit ? `Value in ${item.unit}` : "Value"}
          {item.minValue != null || item.maxValue != null
            ? `, expected ${item.minValue ?? "any"} to ${item.maxValue ?? "any"}`
            : ""}
        </label>
        <input
          id={inputId}
          type="number"
          step="any"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 min-h-[48px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate"
        />
      </div>
      <button
        type="button"
        disabled={value === ""}
        onClick={() => {
          onCapture({ value: Number(value) });
          setValue("");
        }}
        className="inline-flex min-h-[48px] items-center justify-center rounded-[3px] border border-slate bg-slate px-5 text-[15px] font-bold text-[var(--on-navy)] disabled:opacity-50"
      >
        Record
      </button>
    </div>
  );
}
