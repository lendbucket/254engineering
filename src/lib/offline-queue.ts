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
  /** Attempts made. Shown to the technician rather than hidden. */
  attempts: number;
  lastError?: string | null;
};

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
  await tx("readwrite", (store) => store.put(entry));
}

export async function pendingFor(fileId: string): Promise<QueuedCapture[]> {
  const all = await tx<QueuedCapture[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedCapture[]>);
  return all.filter((e) => e.fileId === fileId);
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
        | { ok?: boolean; url?: string; path?: string; error?: string }
        | null;
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
        lat: entry.lat ?? null,
        lng: entry.lng ?? null,
        accuracy: entry.accuracy ?? null,
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
