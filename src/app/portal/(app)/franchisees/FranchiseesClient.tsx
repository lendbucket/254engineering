"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * THE FRANCHISEE RECORD'S CONTROLS (0126). Robert's overnight orders of
 * 2026-11-10, platform item X1. Every act goes to one route, which asks
 * franchise.manage (admin alone) and audits first. Staff and admin only.
 */

const ROUTE = "/api/portal/franchisees";

function useAct() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function act(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(ROUTE, payload);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return null;
    }
    setDone(String(result.said ?? "Done."));
    router.refresh();
    return result as Record<string, unknown>;
  }
  return { busy, error, done, act, router };
}

export function NewFranchiseeForm() {
  const [name, setName] = useState("");
  const { busy, error, done, act, router } = useAct();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[280px]">
        <label htmlFor="new-franchisee" className={labelClass}>Legal name, as registered</label>
        <input id="new-franchisee" value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button
        type="button"
        disabled={busy}
        className={primaryClass}
        onClick={async () => {
          const made = await act({ action: "create", legalName: name });
          if (made && typeof made.id === "string") {
            setName("");
            router.push(`/portal/franchisees?id=${made.id}`);
          }
        }}
      >
        Add franchisee
      </button>
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

export function OfficeForm({
  id,
  office,
}: {
  id: string;
  office: { street: string | null; city: string | null; postalCode: string | null; phone: string | null };
}) {
  const [street, setStreet] = useState(office.street ?? "");
  const [city, setCity] = useState(office.city ?? "");
  const [postalCode, setPostalCode] = useState(office.postalCode ?? "");
  const [phone, setPhone] = useState(office.phone ?? "");
  const { busy, error, done, act } = useAct();
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="office-street" className={labelClass}>Street address</label>
          <input id="office-street" value={street} onChange={(e) => setStreet(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="office-city" className={labelClass}>City</label>
          <input id="office-city" value={city} onChange={(e) => setCity(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="office-postal" className={labelClass}>Postal code</label>
          <input id="office-postal" inputMode="numeric" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
        <div>
          <label htmlFor="office-phone" className={labelClass}>Office phone</label>
          <input id="office-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${fieldClass} mt-1.5`} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={primaryClass} onClick={() => void act({ action: "office", id, street, city, postalCode, phone })}>
          Save office
        </button>
      </div>
      <p className="mt-2 text-[13px] text-[var(--secondary)]">Clear all three address boxes to remove the address. The phone is kept as +1 and ten digits.</p>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function StatusForm({ id, status }: { id: string; status: "onboarding" | "operating" | "ended" }) {
  const [reason, setReason] = useState("");
  const { busy, error, done, act } = useAct();
  if (status === "ended") return <p className="text-[14px] text-[var(--secondary)]">Ended. An ended record is kept as it is and is not reopened.</p>;
  const other = status === "onboarding" ? "operating" : "onboarding";
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "status", id, to: other })}>
          {other === "operating" ? "Mark operating" : "Back to onboarding"}
        </button>
      </div>
      <div className="mt-4">
        <label htmlFor="end-reason" className={labelClass}>Why it ended</label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input id="end-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
          <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "status", id, to: "ended", reason })}>
            End this franchisee
          </button>
        </div>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function TerritoryControls({
  id,
  held,
  options,
  ended,
}: {
  id: string;
  held: { id: string; name: string }[];
  options: { id: string; name: string; heldBy: { id: string; name: string } | null }[];
  ended: boolean;
}) {
  const free = options.filter((o) => !o.heldBy);
  const [choice, setChoice] = useState(free[0]?.id ?? "");
  const { busy, error, done, act } = useAct();
  return (
    <div>
      {held.length ? (
        <ul className="divide-y divide-[var(--row-rule)]">
          {held.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-[15px] text-[var(--ink)]">{t.name}</span>
              <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "territory", id, territoryId: t.id, holds: false })}>
                Take off
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--secondary)]">Holds no territory yet. Choose one below. Territories are made on the sales territories screen.</p>
      )}
      {!ended ? (
        free.length ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[240px]">
              <label htmlFor="give-territory" className={labelClass}>Give a territory nobody holds</label>
              <select id="give-territory" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${fieldClass} mt-1.5`}>
                {free.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            <button type="button" disabled={busy || !choice} className={primaryClass} onClick={() => void act({ action: "territory", id, territoryId: choice, holds: true })}>
              Give territory
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-[var(--secondary)]">Every sales territory is held by a franchisee, or none has been made yet.</p>
        )
      ) : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

const ROLE_WORD: Record<string, string> = { field_tech: "Technician", rep: "Rep", franchisee_owner: "Owner" };

export function MemberControls({
  id,
  people,
  options,
  ended,
}: {
  id: string;
  people: { id: string; name: string; role: string }[];
  options: { id: string; name: string; role: string; belongsTo: { id: string; name: string } | null }[];
  ended: boolean;
}) {
  const free = options.filter((o) => !o.belongsTo);
  const [choice, setChoice] = useState(free[0]?.id ?? "");
  const { busy, error, done, act } = useAct();
  return (
    <div>
      {people.length ? (
        <ul className="divide-y divide-[var(--row-rule)]">
          {people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-[15px] text-[var(--ink)]">
                {p.name} <span className="text-[13px] text-[var(--secondary)]">{ROLE_WORD[p.role] ?? p.role}</span>
              </span>
              <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "member", id, profileId: p.id, belongs: false })}>
                Take off
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-[var(--secondary)]">No people yet. Add a technician or rep below; their portal accounts are made on the people screen.</p>
      )}
      {!ended ? (
        free.length ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[240px]">
              <label htmlFor="give-member" className={labelClass}>Add a technician or rep who belongs to no franchisee</label>
              <select id="give-member" value={choice} onChange={(e) => setChoice(e.target.value)} className={`${fieldClass} mt-1.5`}>
                {free.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}, {ROLE_WORD[o.role] ?? o.role}</option>
                ))}
              </select>
            </div>
            <button type="button" disabled={busy || !choice} className={primaryClass} onClick={() => void act({ action: "member", id, profileId: choice, belongs: true })}>
              Add person
            </button>
          </div>
        ) : (
          <p className="mt-3 text-[14px] text-[var(--secondary)]">Every technician and rep already belongs to a franchisee.</p>
        )
      ) : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
