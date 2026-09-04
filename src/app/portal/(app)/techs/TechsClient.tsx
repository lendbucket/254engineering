"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The two things an administrator changes on this screen.
 *
 * A technician's base, which is what turns the proximity half of the ranking on,
 * and the state of a pay entry.
 */

const field =
  "min-h-[44px] w-full rounded-[3px] border border-[var(--border)] bg-white px-3 text-[16px] text-[var(--navy)] outline-none focus:border-slate";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not work.");
  return body;
}

/**
 * The base, entered by hand.
 *
 * WHY THIS IS TYPED IN RATHER THAN LOOKED UP
 * ------------------------------------------
 * There is no geocoder in this stack. Adding one is a paid dependency and a
 * network call, and the county geometry already in this repo is projected screen
 * coordinates rather than latitude and longitude, so it cannot be used to derive
 * a point. Until a coordinate is entered, dispatch ranks this technician by
 * workload and name and says on screen that it is doing so, rather than showing
 * a distance nobody measured.
 *
 * It is a thirty second job once per technician, and it is honest about being
 * one.
 */
export function BaseForm({
  techId,
  baseCity,
  baseCounty,
  lat,
  lng,
}: {
  techId: string;
  baseCity: string | null;
  baseCounty: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState(baseCity ?? "");
  const [county, setCounty] = useState(baseCounty ?? "");
  const [latitude, setLatitude] = useState(lat === null ? "" : String(lat));
  const [longitude, setLongitude] = useState(lng === null ? "" : String(lng));

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-[var(--secondary)]">
          {baseCity || baseCounty
            ? `Based in ${[baseCity, baseCounty ? `${baseCounty} County` : null].filter(Boolean).join(", ")}`
            : "No base recorded"}
          {lat !== null && lng !== null
            ? ", with coordinates"
            : ", so offers are ranked by workload only"}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] hover:border-slate"
        >
          Set base
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await post({
            action: "set_tech_base",
            techId,
            baseCity: city,
            baseCounty: county,
            lat: latitude === "" ? null : Number(latitude),
            lng: longitude === "" ? null : Number(longitude),
          });
          setOpen(false);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`city-${techId}`} className="block text-[13.5px] font-semibold text-[var(--navy)]">
            Base city
          </label>
          <input
            id={`city-${techId}`}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor={`county-${techId}`} className="block text-[13.5px] font-semibold text-[var(--navy)]">
            Base county
          </label>
          <input
            id={`county-${techId}`}
            value={county}
            onChange={(e) => setCounty(e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor={`lat-${techId}`} className="block text-[13.5px] font-semibold text-[var(--navy)]">
            Latitude
          </label>
          <input
            id={`lat-${techId}`}
            type="number"
            step="any"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="27.8006"
            className={`${field} mt-1.5`}
          />
        </div>
        <div>
          <label htmlFor={`lng-${techId}`} className="block text-[13.5px] font-semibold text-[var(--navy)]">
            Longitude
          </label>
          <input
            id={`lng-${techId}`}
            type="number"
            step="any"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="-97.3964"
            className={`${field} mt-1.5`}
          />
        </div>
      </div>

      <p className="mt-2 max-w-[70ch] text-[12.5px] leading-[1.5] text-[var(--secondary)]">
        Coordinates are optional and nothing looks them up. With them, offers are ranked by workload
        and then by distance. Without them, by workload alone, and the dispatch screen says so.
      </p>

      {error ? (
        <p role="alert" className="mt-2 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[var(--tap-target)] items-center justify-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[13.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "Saving" : "Save base"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-4 text-[13.5px] font-semibold text-[var(--navy)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Approving and paying.
 *
 * WHY VOID IS HERE AND WHY IT IS NOT A DELETE
 * -------------------------------------------
 * A pay entry written in error has to be reversible, and reversing it by
 * deleting the row would leave no trace that a technician was once told they
 * were owed something. Void is a status. The row stays, and so does the record
 * of somebody deciding it was wrong.
 */
export function LedgerActions({
  rows,
}: {
  rows: { id: string; techName: string; amount: string; status: string; note: string | null; fileId: string | null }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mark(status: "approved" | "paid" | "void") {
    setBusy(true);
    setError(null);
    try {
      await post({ action: "set_ledger_status", ids: selected, status });
      setSelected([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul className="divide-y divide-limestone-line">
        {rows.map((row) => (
          <li key={row.id}>
            <label className="flex min-h-[52px] cursor-pointer items-center gap-3 py-2.5">
              <input
                type="checkbox"
                checked={selected.includes(row.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, row.id] : prev.filter((id) => id !== row.id),
                  )
                }
                className="h-5 w-5 shrink-0 accent-[var(--navy)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-[var(--navy)]">
                  {row.techName}, {row.amount}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[var(--secondary)]">
                  {row.status}
                  {row.note ? `, ${row.note}` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" className="mt-3 text-[13.5px] font-semibold text-[var(--red)]">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {(["approved", "paid", "void"] as const).map((status) => (
          <button
            key={status}
            type="button"
            disabled={busy || selected.length === 0}
            onClick={() => void mark(status)}
            className="inline-flex min-h-[44px] items-center rounded-[3px] border border-[var(--border)] px-3 text-[13.5px] font-semibold text-[var(--navy)] hover:border-slate disabled:opacity-50"
          >
            Mark {status}
          </button>
        ))}
      </div>
    </div>
  );
}
