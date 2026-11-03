import { deliverablePriceCents } from "@/config/prices";
import { catalogFor } from "@data/catalog";
import {
  CRM_SCRIPTS,
  SOLAR_WIND_LOAD_CITIES,
  SOLAR_WIND_LOAD_NOTE,
  type ScriptPair,
} from "@/content/crm-scripts";
import type { CrmVertical } from "./crm-rules";

/**
 * THE CALL SCRIPT A CARD SHOWS, FILLED. Robert's sales CRM ruling, item R3.
 *
 * Pure and client safe: the server decides the variant (crm-queue.ts reads
 * whether the line is sellable), and this fills the placeholders from the
 * price book and the card. A placeholder this does not know is refused rather
 * than printed, so a script can never show "{{price:...}}" or a stale figure to
 * a rep on the telephone.
 */

/** Whole dollars when the price is whole, as the site prints them. */
export function dollars(cents: number): string {
  return cents % 100 === 0 ? `$${(cents / 100).toLocaleString("en-US")}` : `$${(cents / 100).toFixed(2)}`;
}

function priceOf(serviceSlug: string, tier?: string): string | null {
  const entry = catalogFor(serviceSlug, tier);
  if (!entry) return null;
  const cents = deliverablePriceCents(serviceSlug, entry.tier);
  return cents === null ? null : dollars(cents);
}

/** The published coastal addition, read from the roof line, the one every coastal script quotes beside. */
function coastal(): string | null {
  const entry = catalogFor("roof-inspections");
  return entry && typeof entry.coastalSurchargeCents === "number" ? dollars(entry.coastalSurchargeCents) : null;
}

export type ScriptCard = {
  vertical: CrmVertical;
  rep: string;
  contact: string | null;
  company: string;
  city: string | null;
};

export type RenderedScript =
  | { ok: true; variant: "open" | "prelaunch"; text: string; note: string | null; usedVertical: CrmVertical }
  | { ok: false; error: string };

export function fillScript(template: string, card: ScriptCard): { ok: true; text: string } | { ok: false; error: string } {
  const unknown: string[] = [];
  const text = template.replace(/\{\{([a-z0-9:-]+)\}\}/g, (whole, key: string) => {
    if (key === "rep") return card.rep;
    if (key === "contact") return card.contact?.trim() ? card.contact.trim().split(/\s+/)[0] : "there";
    if (key === "company") return card.company;
    if (key === "coastal") {
      const c = coastal();
      if (c) return c;
      unknown.push(key);
      return whole;
    }
    const price = key.match(/^price:([a-z0-9-]+)(?::([a-z0-9-]+))?$/);
    if (price) {
      const p = priceOf(price[1], price[2]);
      if (p) return p;
    }
    unknown.push(key);
    return whole;
  });
  return unknown.length ? { ok: false, error: `The script names ${unknown.join(", ")}, which the price book does not answer, so it is not shown.` } : { ok: true, text };
}

/** Whether the solar ruling of 2026-10-30 applies: a solar company in a listed wind load city. */
function inWindLoadCity(card: Pick<ScriptCard, "vertical" | "city">): boolean {
  return card.vertical === "solar" && card.city
    ? SOLAR_WIND_LOAD_CITIES.some((c) => c.toLowerCase() === card.city!.trim().toLowerCase())
    : false;
}

/**
 * Which vertical's script a card shows: its own, or the general script for a
 * solar company in a listed wind load city. The caller reads the sellable
 * answer for THIS vertical's line (SCRIPT_LINE), so the general script always
 * follows the roof line, Robert's R3 ruling 4 of 2026-11-02, including when it
 * stands in for solar.
 */
export function scriptVerticalFor(card: Pick<ScriptCard, "vertical" | "city">): CrmVertical {
  return inWindLoadCity(card) ? "other" : card.vertical;
}

/**
 * The script for a card. `sellable` is the server's answer for the line of
 * scriptVerticalFor(card) (SCRIPT_LINE); the solar ruling turns a solar company
 * in a listed city to the general script with the reason.
 */
export function scriptFor(card: ScriptCard, sellable: boolean): RenderedScript {
  const windCity = inWindLoadCity(card);
  const usedVertical: CrmVertical = scriptVerticalFor(card);
  const pair: ScriptPair = CRM_SCRIPTS[usedVertical];
  const variant = sellable ? "open" : "prelaunch";
  const filled = fillScript(pair[variant], { ...card, vertical: usedVertical });
  if (!filled.ok) return filled;
  return { ok: true, variant, text: filled.text, note: windCity ? SOLAR_WIND_LOAD_NOTE : null, usedVertical };
}
