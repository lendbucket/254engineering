"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, fieldClass, ghostClass, labelClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * THE PIPELINE'S CONTROLS. Robert's sales CRM ruling of 2026-11-02, item R4.
 *
 * Every stage move, from a drag or from the "Move to" select beside each card,
 * goes to one route with the stage the card showed, and the library refuses a
 * company that has moved since. The select is there because a drag alone
 * cannot be done from a keyboard or reliably on a phone.
 */

export type BoardCard = {
  id: string;
  company: string;
  verticalLabel: string;
  score: number;
  ownerName: string | null;
  nextAction: string | null;
};
export type BoardColumnView = { stage: string; label: string; count: number; more: number; acceptsDrop: boolean; cards: BoardCard[] };

const MOVE_ROUTE = "/api/portal/crm";

async function move(prospectId: string, from: string, to: string) {
  return postJson(MOVE_ROUTE, { action: "move_stage", prospectId, from, to });
}

export function Board({ columns, listHref }: { columns: BoardColumnView[]; listHref: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<{ id: string; from: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const targets = columns.filter((c) => c.acceptsDrop);

  async function moveTo(id: string, from: string, to: string) {
    if (!to || to === from) return;
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await move(id, from, to);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      router.refresh();
      return;
    }
    setDone(String(result.said ?? "Moved."));
    router.refresh();
  }

  return (
    <div>
      <Problem message={error} />
      <Done message={done} />
      {/* The columns scroll inside their own region at any width, so the page itself never scrolls sideways. */}
      <div role="region" aria-label="Stage board" tabIndex={0} className="mt-3 overflow-x-auto pb-2">
        <ol className="grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4">
          {columns.map((col) => (
            <li
              key={col.stage}
              aria-label={`${col.label}, ${col.count}`}
              onDragOver={(e) => {
                if (!col.acceptsDrop || !dragging || dragging.from === col.stage) return;
                e.preventDefault();
                setOver(col.stage);
              }}
              onDragLeave={() => setOver((o) => (o === col.stage ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragging && col.acceptsDrop) void moveTo(dragging.id, dragging.from, col.stage);
                setDragging(null);
              }}
              className={`flex min-h-[200px] flex-col border-t-2 bg-[var(--canvas)] p-3 ${over === col.stage ? "border-[var(--navy)]" : "border-[var(--row-rule)]"}`}
            >
              <h2 className="text-[15px] font-bold text-[var(--ink)]">
                {col.label} <span className="font-normal text-[var(--secondary)]">{col.count.toLocaleString("en-US")}</span>
              </h2>
              {!col.acceptsDrop ? <p className="mt-1 text-[13px] text-[var(--secondary)]">Reached by converting and by the first order.</p> : null}
              {col.cards.length === 0 ? (
                <p className="mt-3 text-[14px] text-[var(--secondary)]">None at this stage.</p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {col.cards.map((card) => (
                    <li
                      key={card.id}
                      draggable={col.acceptsDrop && !busy}
                      onDragStart={() => setDragging({ id: card.id, from: col.stage })}
                      onDragEnd={() => setDragging(null)}
                      /* A rule above each card, not a box: V10 draws rows, never bordered boxes. */
                      className="border-t border-[var(--row-rule)] bg-white p-3 text-[14px]"
                    >
                      <Link href={`/portal/crm/${card.id}`} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--navy)] underline">
                        {card.company}
                      </Link>
                      <p className="text-[var(--ink)]">{card.verticalLabel}, score {card.score}</p>
                      <p className="text-[var(--secondary)]">{card.ownerName ?? "Nobody yet"}{card.nextAction ? `. Next: ${card.nextAction}` : ""}</p>
                      {col.acceptsDrop ? (
                        <div className="mt-2">
                          <label htmlFor={`move-${card.id}`} className="block text-[13px] font-semibold text-[var(--ink)]">Move to</label>
                          <select
                            id={`move-${card.id}`}
                            value=""
                            disabled={busy}
                            onChange={(e) => void moveTo(card.id, col.stage, e.target.value)}
                            className={`${fieldClass} mt-1`}
                          >
                            <option value="">Choose a stage</option>
                            {targets.filter((t) => t.stage !== col.stage).map((t) => (
                              <option key={t.stage} value={t.stage}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {col.more ? (
                <p className="mt-3 text-[14px] text-[var(--ink)]">
                  {col.more.toLocaleString("en-US")} more at this stage.{" "}
                  <Link href={`${listHref}${listHref.includes("?") ? "&" : "?"}stage=${col.stage}`} className="font-semibold text-[var(--navy)] underline">See them in the list</Link>
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/** The ticked rows on the list, read from the page's checkboxes. */
function picked(): string[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input[data-crm-pick]:checked")).map((i) => i.value);
}

export function PickAll() {
  return (
    <label className="inline-flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
      <input
        type="checkbox"
        className="h-5 w-5"
        onChange={(e) => document.querySelectorAll<HTMLInputElement>("input[data-crm-pick]").forEach((i) => (i.checked = e.target.checked))}
      />
      Tick every company on this page
    </label>
  );
}

export function PickRow({ id, company }: { id: string; company: string }) {
  return <input type="checkbox" data-crm-pick value={id} aria-label={`Tick ${company}`} className="h-5 w-5" />;
}

export function BulkBar({ canAssign, people }: { canAssign: boolean; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [tag, setTag] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(payload: Record<string, unknown>) {
    const ids = picked();
    if (ids.length === 0) return setError("Tick at least one company first.");
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(MOVE_ROUTE, { ...payload, ids });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? "Done."));
    router.refresh();
  }

  return (
    <div className="mb-4 flex flex-wrap items-end gap-4 border-y border-[var(--row-rule)] py-3 print:hidden">
      <PickAll />
      <div className="min-w-[200px]">
        <label htmlFor="bulk-tag" className={labelClass}>Tag the ticked companies</label>
        <div className="mt-1.5 flex gap-2">
          <input id="bulk-tag" value={tag} onChange={(e) => setTag(e.target.value)} className={fieldClass} />
          <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "bulk_tag", tag })}>Add tag</button>
        </div>
      </div>
      {canAssign ? (
        <div className="min-w-[220px]">
          <label htmlFor="bulk-owner" className={labelClass}>Assign the ticked companies to</label>
          <div className="mt-1.5 flex gap-2">
            <select id="bulk-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={fieldClass}>
              <option value="">Nobody</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button type="button" disabled={busy} className={primaryClass} onClick={() => void act({ action: "bulk_assign", ownerId })}>Assign</button>
          </div>
          <button type="button" disabled={busy} className={`${ghostClass} mt-2`} onClick={() => void act({ action: "bulk_assign_by_territory" })}>
            Assign by territory instead
          </button>
        </div>
      ) : null}
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

/**
 * Reassign one company from its page (R5: "ops_manager and admin reassign
 * singly or in bulk"). Shown only to a holder of crm.assign; the route asks the
 * same grant and writes the "Assigned to" entry in the company's history.
 */
export function AssignCompany({ prospectId, ownerId, people }: { prospectId: string; ownerId: string | null; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [next, setNext] = useState(ownerId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(MOVE_ROUTE, { ...payload, ids: [prospectId] });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? "Done."));
    router.refresh();
  }

  return (
    <div className="print:hidden">
      <label htmlFor={`assign-${prospectId}`} className={labelClass}>Owner</label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <select id={`assign-${prospectId}`} value={next} onChange={(e) => setNext(e.target.value)} className={fieldClass}>
          <option value="">Nobody</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button type="button" disabled={busy} className={primaryClass} onClick={() => void act({ action: "bulk_assign", ownerId: next })}>Reassign</button>
        <button type="button" disabled={busy} className={ghostClass} onClick={() => void act({ action: "bulk_assign_by_territory" })}>By territory</button>
      </div>
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}

export function SaveViewForm({ view, params }: { view: "board" | "list"; params: Record<string, string | undefined> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(MOVE_ROUTE, { action: "save_view", name, view, query: params });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(`Saved as "${name.trim()}".`);
    setName("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px]">
        <label htmlFor="view-name" className={labelClass}>Save this view as</label>
        <input id="view-name" value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} mt-1.5`} />
      </div>
      <button type="button" disabled={busy} className={primaryClass} onClick={() => void save()}>Save view</button>
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

export function DeleteViewButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline"
        onClick={async () => {
          const result = await postJson(MOVE_ROUTE, { action: "delete_view", id });
          if (!result.ok) return setError(result.error);
          router.refresh();
        }}
        aria-label={`Delete the view ${name}`}
      >
        Delete
      </button>
      <Problem message={error} />
    </>
  );
}

/** The company page's stage control: the same route and the same stale-move refusal as the board. */
export function MoveStage({ prospectId, stage, targets }: { prospectId: string; stage: string; targets: { stage: string; label: string }[] }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[200px]">
        <label htmlFor="company-stage" className={labelClass}>Move to</label>
        <select id="company-stage" value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldClass} mt-1.5`}>
          <option value="">Choose a stage</option>
          {targets.filter((t) => t.stage !== stage).map((t) => (
            <option key={t.stage} value={t.stage}>{t.label}</option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={busy || !to}
        className={primaryClass}
        onClick={async () => {
          setBusy(true);
          setError(null);
          setDone(null);
          const result = await move(prospectId, stage, to);
          setBusy(false);
          if (!result.ok) return setError(result.error);
          setDone(String(result.said ?? "Moved."));
          setTo("");
          router.refresh();
        }}
      >
        Move
      </button>
      <div className="w-full">
        <Problem message={error} />
        <Done message={done} />
      </div>
    </div>
  );
}

/** The company's notes: write one (with @ mentions of anybody in them), or bring a colleague in. */
export function CompanyNotes({ prospectId, joined, people }: { prospectId: string; joined: boolean; people: { id: string; name: string }[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [personId, setPersonId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>, said: string) {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await postJson(MOVE_ROUTE, { ...payload, prospectId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setDone(String(result.said ?? said));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {!joined ? (
        <div>
          <p className="text-[14px] text-[var(--ink)]">You are not in this company&apos;s notes yet. Opening them adds you, and your first note starts them if nobody has.</p>
          <button type="button" disabled={busy} className={`${ghostClass} mt-2`} onClick={() => void send({ action: "join_notes" }, "You are in this company's notes.")}>
            Open the notes
          </button>
        </div>
      ) : null}
      <div>
        <label htmlFor="note-body" className={labelClass}>Write a note</label>
        <textarea id="note-body" rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={`${fieldClass} mt-1.5`} />
        <p className="mt-1 text-[13px] text-[var(--secondary)]">Type @ and a colleague&apos;s name to mention somebody in these notes; they are told.</p>
        <button
          type="button"
          disabled={busy || !body.trim()}
          className={`${primaryClass} mt-2`}
          onClick={async () => {
            await send({ action: "post_note", body }, "Note saved.");
            setBody("");
          }}
        >
          Save the note
        </button>
      </div>
      {people.length ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px]">
            <label htmlFor="note-person" className={labelClass}>Bring a colleague into the notes</label>
            <select id="note-person" value={personId} onChange={(e) => setPersonId(e.target.value)} className={`${fieldClass} mt-1.5`}>
              <option value="">Choose a person</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy || !personId} className={ghostClass} onClick={() => void send({ action: "add_to_notes", profileId: personId }, "Added.")}>
            Add
          </button>
        </div>
      ) : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
