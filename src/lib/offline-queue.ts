/**
 * The capture queue that survives no signal.
 *
 * WHY INDEXEDDB AND NOT LOCALSTORAGE
 * ----------------------------------
 * The obvious build keeps pending captures in localStorage. It works until the
 * first photograph, because localStorage holds strings, a photograph has to be
 * base64 encoded to become one, that inflates it by a third, and the whole store
 * is capped around five megabytes. One roof photograph from a modern phone is
 * four. The technician would fill the quota on the second frame and the failure
 * would arrive as a thrown exception in the middle of a job.
 *
 * IndexedDB stores the Blob itself, with no encoding and no five megabyte
 * ceiling. It is more code. It is the only one of the two that actually works.
 *
 * WHY THE ID IS MINTED BEFORE THE UPLOAD
 * --------------------------------------
 * The queue retries, and a retry that arrives twice must not produce the same
 * photograph twice. The id comes from newCaptureId on the device at the moment
 * of capture, travels with the upload, and the unique index on
 * (file_id, client_capture_id) turns the second arrival into an update of the
 * row that already exists. Asking the server for an id would require the network
 * this whole module exists because the technician does not have.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ----------------------------------
 * It does not use a service worker, and the app is not installable offline. A
 * technician who closes the tab in a dead zone cannot reopen it until they have
 * signal. What is protected is the case that actually happens: the tab stays
 * open, the signal comes and goes across a two hour inspection, and nothing
 * captured is lost. Making the whole portal work from a cold start offline is a
 * separate piece of work and is in the backlog rather than half done here.
 */

export type QueuedCapture = {
  /** The client capture id. Also the IndexedDB key. */
  id: string;
  fileId: string;
  itemKey: string;
  kind: "photo" | "measurement" | "reading" | "document" | "note";
  blob?: Blob;
  contentType?: string;
  valueText?: string | null;
  valueNumber?: number | null;
  capturedAt: string;
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  /**
   * SET WHEN THIS ENTRY IS AN ABSENCE RATHER THAN A CAPTURE.
   * Added 2026-09-19 with the exception write path.
   *
   * WHY IT RIDES THE SAME QUEUE INSTEAD OF POSTING DIRECTLY. The obvious build
   * is to POST an exception straight to the server, because it is a sentence
   * rather than a photograph and needs no upload. That would have worked
   * everywhere except the place it is needed: the item most likely to need an
   * exception is the one the technician cannot reach, on a roof, in a county
   * where one bar is the normal condition. An exception typed with no signal
   * and posted directly is an exception that vanishes, and the technician finds
   * out by being blocked at submission with a blocker naming an item they have
   * already answered.
   *
   * So it is queued like everything else, survives a reload in IndexedDB, and
   * flushes when the signal returns. The queue banner counts it, and the
   * submission gate refuses while the queue is non-empty, which is already the
   * rule and needs no exception of its own.
   *
   * `kind` above still says what the ITEM is, because the server checks the
   * item exists in the protocol either way. This says what the ENTRY is.
   */
  exception?: { kind: "not_observed" | "not_applicable"; reason: string };
  /** Attempts made. Shown to the technician rather than hidden. */
  attempts: number;
  lastError?: string | null;
  /**
   * When this entry joined the queue, set by enqueue. The queue replays in this
   * order (field audit F18, 2026-11-02): the IndexedDB key is cap_<uuid>, so
   * key order is random, and a capture and a later exception on one item would
   * otherwise replay in either order. Entries queued before this field existed
   * fall back to capturedAt.
   */
  queuedAt?: string;
  /**
   * THE PHOTOGRAPH'S SHA-256, TAKEN ON THE PHONE AT THE MOMENT OF CAPTURE.
   * Robert's T2 and his answer 2 of 2026-11-07 (6717223376): the phone hashes
   * at capture, the server hashes the stored bytes again at upload and
   * compares, the server's hash stays the record, and a mismatch is refused and
   * named. Lowercase hex. Absent on an entry with no bytes, and on an entry
   * queued before this field existed, which the server records as before.
   */
  captureSha256?: string;
};

/**
 * The SHA-256 of a blob, lowercase hex, by the browser's own crypto. Called at
 * capture, before the entry is queued, so the hash describes the bytes the
 * camera produced rather than whatever later reaches storage.
 */
export async function sha256OfBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Replay a queue: every entry in queued order, oldest first, stopping at the
 * first failure so a later entry never lands ahead of an earlier one that has
 * not. Robert's T2 (2026-11-07): "the queue replays in time order when signal
 * returns. Prove the replay order with a planted fault."
 *
 * The order is inQueueOrder's, here and nowhere else: the component that
 * flushes calls this rather than looping itself, so the proof that runs this
 * function is a proof about the loop that actually runs on the phone
 * (scripts/proofs/a-field-day-starts-and-replays-with-no-signal.mjs).
 */
export async function replayQueue(
  entries: QueuedCapture[],
  sendOne: (entry: QueuedCapture) => Promise<{ ok: true } | { ok: false; error: string }>,
  onSent: (entry: QueuedCapture) => Promise<void>,
  onFailed: (entry: QueuedCapture, error: string) => Promise<void>,
): Promise<{ sent: number; stoppedAt: string | null }> {
  let sent = 0;
  for (const entry of inQueueOrder(entries)) {
    const result = await sendOne(entry);
    if (!result.ok) {
      await onFailed(entry, result.error);
      return { sent, stoppedAt: entry.id };
    }
    await onSent(entry);
    sent += 1;
  }
  return { sent, stoppedAt: null };
}

/** How a queue is replayed: by when each entry was queued, oldest first. */
export function inQueueOrder(entries: QueuedCapture[]): QueuedCapture[] {
  const at = (e: QueuedCapture) => Date.parse(e.queuedAt ?? e.capturedAt) || 0;
  return [...entries].sort((a, b) => at(a) - at(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const DB_NAME = "eng-field";
const STORE = "captures";
const VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("fileId", "fileId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => db.close();
      }),
  );
}

export async function enqueue(entry: QueuedCapture): Promise<void> {
  const stamped: QueuedCapture = entry.queuedAt ? entry : { ...entry, queuedAt: new Date().toISOString() };
  await tx("readwrite", (store) => store.put(stamped));
}

export async function pendingFor(fileId: string): Promise<QueuedCapture[]> {
  const all = await tx<QueuedCapture[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedCapture[]>);
  return inQueueOrder(all.filter((e) => e.fileId === fileId));
}

export async function dequeue(id: string): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
}

export async function markAttempt(entry: QueuedCapture, error: string | null): Promise<void> {
  await enqueue({ ...entry, attempts: entry.attempts + 1, lastError: error });
}

/**
 * Push one queued capture to the server.
 *
 * Two steps for a photograph and one for everything else. The photograph goes
 * to storage through a signed URL rather than through the app, because a fifteen
 * megabyte body through a serverless function on one bar is the upload that
 * times out after the technician has climbed down.
 */
export async function flushOne(entry: QueuedCapture): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    /*
     * AN ABSENCE HAS NO BYTES AND TAKES THE SHORT PATH. It is answered first so
     * the upload branch below cannot be reached by an entry that has a reason
     * and, through some later edit, also a blob: a row that is both a
     * photograph and a statement that nothing could be photographed is the
     * contradiction recordException refuses on the server, and it should not be
     * constructible here either.
     */
    if (entry.exception) {
      const posted = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_exception",
          fileId: entry.fileId,
          itemKey: entry.itemKey,
          kind: entry.exception.kind,
          reason: entry.exception.reason,
        }),
      });
      const body = (await posted.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!posted.ok || !body?.ok) {
        return { ok: false, error: body?.error ?? "The server refused that entry." };
      }
      return { ok: true };
    }

    let storageKey: string | null = null;

    if (entry.blob && entry.contentType) {
      const signed = await fetch("/api/portal/field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sign_upload",
          fileId: entry.fileId,
          captureId: entry.id,
          contentType: entry.contentType,
          size: entry.blob.size,
        }),
      });
      const signedBody = (await signed.json().catch(() => null)) as
        | { ok?: boolean; url?: string; path?: string; stored?: boolean; error?: string }
        | null;
      if (signed.ok && signedBody?.ok && signedBody.stored && signedBody.path) {
        /*
         * A replay whose upload already landed. The server issues no URL for a
         * stored object (Q2, 2026-11-02: never an overwrite), so the row is
         * recorded against the object that is there.
         */
        storageKey = signedBody.path;
      } else {
        if (!signed.ok || !signedBody?.ok || !signedBody.url) {
          return { ok: false, error: signedBody?.error ?? "Could not prepare the upload." };
        }

        const put = await fetch(signedBody.url, {
          method: "PUT",
          headers: { "Content-Type": entry.contentType },
          body: entry.blob,
        });
        if (!put.ok) return { ok: false, error: `The upload was refused (${put.status}).` };
        storageKey = signedBody.path ?? null;
      }
    }

    const recorded = await fetch("/api/portal/field", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "record_capture",
        fileId: entry.fileId,
        captureId: entry.id,
        itemKey: entry.itemKey,
        kind: entry.kind,
        valueText: entry.valueText ?? null,
        valueNumber: entry.valueNumber ?? null,
        storageKey,
        capturedAt: entry.capturedAt,
        /* The clock at the moment of sending, so the server measures the clock
         * and not how long the capture waited for signal. */
        deviceNow: new Date().toISOString(),
        lat: entry.lat ?? null,
        lng: entry.lng ?? null,
        accuracy: entry.accuracy ?? null,
        /* The hash taken at capture, for the server to compare with the stored bytes (T2). */
        captureSha256: entry.captureSha256 ?? null,
      }),
    });
    const body = (await recorded.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!recorded.ok || !body?.ok) return { ok: false, error: body?.error ?? "The server refused that capture." };

    return { ok: true };
  } catch {
    return { ok: false, error: "No connection." };
  }
}

/**
 * Where the phone is, if it will say, and never blocking on the answer.
 *
 * A geotag on an evidence photograph is worth having: a photograph whose
 * location cannot be established is weak evidence. But a technician who denies
 * the permission, or who is inside a metal building where the fix never
 * arrives, must still be able to work. So this resolves to null after six
 * seconds rather than hanging, and a capture with no coordinates is a capture.
 */
export function positionOrNull(): Promise<GeolocationPosition | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const done = (value: GeolocationPosition | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    const timer = setTimeout(() => done(null), 6000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(timer);
        done(p);
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60_000 },
    );
  });
}
