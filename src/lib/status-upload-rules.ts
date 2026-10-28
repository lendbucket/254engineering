import type { IntakeField } from "@data/intake-fields";

/**
 * WHAT A CUSTOMER MAY UPLOAD FROM THEIR STATUS PAGE, AND WHERE IT MAY LAND.
 * Robert's addendum of 2026-10-25, item 4: "Add an upload control on the
 * tokened status page for requested documents."
 *
 * Pure, so the rule is proven without a database. A slot is offered only for
 * a document the firm is still waiting on: a FILE field the customer can
 * answer, required for this line, with no answer yet. Nothing else can be
 * written through this door, so a token is never a way to replace a document
 * the firm already holds.
 */
export type UploadSlot = { id: string; label: string; help: string | null; photo: boolean };

export function requestedSlots(fields: IntakeField[], answers: Record<string, unknown>): UploadSlot[] {
  return fields
    .filter((f) => f.kind === "file" && f.audience === "customer" && f.required)
    .filter((f) => {
      const value = answers[f.id];
      return value === undefined || value === null || value === "";
    })
    .map((f) => ({ id: f.id, label: f.label, help: f.help ?? null, photo: Boolean(f.photo) }));
}

/** Where a status page upload for this order and slot must sit, and nowhere else. */
export function statusUploadPrefix(orderId: string, fieldId: string): string {
  return `status/${orderId}/${fieldId}/`;
}

/** Null when the key is this order's and this slot's; otherwise why not. */
export function statusUploadKeyProblem(orderId: string, fieldId: string, storageKey: string): string | null {
  const prefix = statusUploadPrefix(orderId, fieldId);
  if (!storageKey.startsWith(prefix)) return "That upload is not one this page prepared.";
  const rest = storageKey.slice(prefix.length);
  if (!/^[A-Za-z0-9-]+[.](pdf|jpg|png|heic|webp)$/.test(rest)) return "That upload is not one this page prepared.";
  return null;
}
