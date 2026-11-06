"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * THE TERRITORIES SCREEN'S CONTROLS. Robert's sales CRM ruling of 2026-11-02,
 * item R5. Every act goes to one route, which asks crm.assign and audits first.
 * The county picker is grouped by the coverage map's regions, each region a
 * section that opens on a tap, so it works on a phone as well as a desk; a
 * county in another territory is shown with that territory's name and cannot
 * be ticked here.
 */

const ROUTE = "/api/portal/crm/territories";

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function act(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(ROUTE, payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setDone(String(result.said ?? "Done."));
    router.refresh();
    return true;
  }
  return { busy, error, done, act };
}

export function NewTerritoryForm() {
  const [name, setName] = useState("");
  const { busy, error, done, act } = useAct();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[240px]">
        <label htmlFor="new-territory" className={labelClass}>Territory name</label>
        <input id="new-territory" value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button type="button" disabled={busy} className={primaryClass} onClick={async () => { if (await act({ action: "create", name })) setName(""); }}>
        Create territory
      </button>
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

export function RenameTerritory({ territoryId, name }: { territoryId: string; name: string }) {
  const [value, setValue] = useState(name);
  const { busy, error, done, act } = useAct();
  return (
    <div>
      <label htmlFor={`rename-${territoryId}`} className={labelClass}>Name</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input id={`rename-${territoryId}`} value={value} onChange={(e) => setValue(e.target.value)} className={fieldClass} />
        <button type="button" disabled={busy || value.trim() === name} className={ghostClass} onClick={() => void act({ action: "rename", territoryId, name: value })}>Rename</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function HolderControls({
  territoryId,
  holders,
  people,
}: {
  territoryId: string;
  holders: { id: string; name: string; active: boolean }[];
  people: { id: string; name: string }[];
}) {
  const [pick, setPick] = useState("");
  const { busy, error, done, act } = useAct();
  const held = new Set(holders.map((h) => h.id));
  const choices = people.filter((p) => !held.has(p.id));
  return (
    <div>
      <p className={labelClass}>Who holds it</p>
      {holders.length === 0 ? (
        <p className="mt-1.5 text-[14px] text-[var(--ink)]">Nobody yet. Give it to a rep below; until then its new imports stay unassigned.</p>
      ) : (
        <ul className="mt-1.5 grid gap-2">
          {holders.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 text-[14px] text-[var(--ink)]">
              <span>{h.name}{h.active ? "" : " (suspended, skipped in the turn)"}</span>
              <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "set_holder", territoryId, profileId: h.id, holds: false })}>
                Take off
              </button>
            </li>
          ))}
        </ul>
      )}
      {choices.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[200px]">
            <label htmlFor={`holder-${territoryId}`} className={labelClass}>Give it to</label>
            <select id={`holder-${territoryId}`} value={pick} onChange={(e) => setPick(e.target.value)} className={`${fieldClass} mt-1.5`}>
              <option value="">Choose a person</option>
              {choices.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy || !pick} className={primaryClass} onClick={async () => { if (await act({ action: "set_holder", territoryId, profileId: pick, holds: true })) setPick(""); }}>
            Give territory
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-[var(--secondary)]">Everybody who works the sales list already holds it.</p>
      )}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function CountyPicker({
  territoryId,
  chosen,
  others,
  regions,
}: {
  territoryId: string;
  chosen: string[];
  /** County to the name of the other territory that holds it. */
  others: Record<string, string>;
  regions: { slug: string; name: string; counties: string[] }[];
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(chosen));
  const { busy, error, done, act } = useAct();
  const changed = picked.size !== chosen.length || chosen.some((c) => !picked.has(c));

  function toggle(county: string) {
    setPicked((before) => {
      const next = new Set(before);
      if (next.has(county)) next.delete(county);
      else next.add(county);
      return next;
    });
  }

  return (
    <div>
      <p className={labelClass}>Counties, by region</p>
      <p className="mt-1 text-[14px] text-[var(--secondary)]">{picked.size} chosen. Open a region to tick its counties.</p>
      <div className="mt-3 grid gap-2">
        {regions.map((r) => {
          const inRegion = r.counties.filter((c) => picked.has(c)).length;
          return (
            <details key={r.slug} className="border border-[var(--row-rule)]">
              <summary className="flex min-h-[44px] cursor-pointer items-center px-3 text-[14px] font-semibold text-[var(--ink)]">
                {r.name} ({inRegion} of {r.counties.length})
              </summary>
              <fieldset className="grid gap-1 px-3 pb-3 sm:grid-cols-2">
                <legend className="sr-only">Counties in {r.name}</legend>
                {r.counties.map((c) => {
                  const elsewhere = others[c];
                  return (
                    <label key={c} className={`flex min-h-[44px] items-center gap-2 text-[14px] ${elsewhere ? "text-[var(--secondary)]" : "text-[var(--ink)]"}`}>
                      <input type="checkbox" className="h-5 w-5" checked={picked.has(c)} disabled={Boolean(elsewhere)} onChange={() => toggle(c)} />
                      <span>{c}{elsewhere ? `, in ${elsewhere}` : ""}</span>
                    </label>
                  );
                })}
              </fieldset>
            </details>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !changed} className={primaryClass} onClick={() => void act({ action: "set_counties", territoryId, counties: [...picked] })}>
          Save counties
        </button>
        {changed ? (
          <button type="button" disabled={busy} className={ghostClass} onClick={() => setPicked(new Set(chosen))}>Undo changes</button>
        ) : null}
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
