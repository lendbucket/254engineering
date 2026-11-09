"use client";

import { packUsable, type DayPack } from "./field-day-rules";

/**
 * WHERE THE PHONE KEEPS THE DAY PACK. Robert's T2 and his answer 1 of
 * 2026-11-07: IndexedDB, that technician's jobs only, cleared at sign out, at
 * reassignment or submission, and after 48 hours.
 *
 *   - Reassignment and submission clear a job because every fresh pack REPLACES
 *     the stored one whole: a job no longer assigned to him, or no longer in the
 *     field, is simply not in the next pack.
 *   - Sign out calls clearDayPack (src/components/portal/SignOutControl.tsx).
 *   - 48 hours is packUsable's rule, asked on every read; a pack past it is
 *     deleted on the read that finds it.
 *
 * Its own database, apart from the capture queue ("eng-field"), so clearing the
 * day can never touch a photograph still waiting to upload.
 */

const DB_NAME = "eng-field-day";
const STORE = "pack";
const KEY = "current";

type Stored = { pack: DayPack; storedAtMs: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = act(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Replace the stored pack with this one, whole. */
export async function storeDayPack(pack: DayPack): Promise<void> {
  const value: Stored = { pack, storedAtMs: Date.now() };
  await run("readwrite", (store) => store.put(value, KEY));
}

/** The stored pack if it is this technician's and under 48 hours old; otherwise null, and it is deleted. */
export async function readDayPack(techId: string | null): Promise<DayPack | null> {
  const stored = (await run<Stored | undefined>("readonly", (store) => store.get(KEY) as IDBRequest<Stored | undefined>)) ?? null;
  if (stored && packUsable(stored.pack, stored.storedAtMs, techId, Date.now())) return stored.pack;
  if (stored) await clearDayPack();
  return null;
}

/** Forget the day. Never touches the capture queue. */
export async function clearDayPack(): Promise<void> {
  await run("readwrite", (store) => store.delete(KEY));
}

/** The service worker's cache of the offline screen (src/app/field-sw.js/route.ts). */
export const FIELD_SHELL_CACHE = "field-shell-v1";

/**
 * EVERYTHING THE PHONE HOLDS FOR OFFLINE START, FORGOTTEN AT SIGN OUT: the day
 * pack, and the cached offline screen, which carries the signed in person's
 * name in its chrome. Best effort and never in the way: a phone that cannot
 * clear one of them still signs out, and the pack still lapses at 48 hours.
 * The capture queue is deliberately untouched: a photograph not yet uploaded
 * is the technician's work, and it uploads at the next sign in.
 */
export async function forgetFieldDay(): Promise<void> {
  try {
    await clearDayPack();
  } catch {
    /* IndexedDB blocked or absent: nothing was stored. */
  }
  try {
    if (typeof caches !== "undefined") await caches.delete(FIELD_SHELL_CACHE);
  } catch {
    /* No Cache Storage: nothing was cached. */
  }
}
