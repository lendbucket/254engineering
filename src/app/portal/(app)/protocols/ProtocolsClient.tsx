"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EvidenceKind } from "@/lib/ops-evidence";

/**
 * The authoring controls.
 *
 * Every one of them posts to /api/portal/field and then refreshes, rather than
 * keeping a local copy of the protocol in React state. The server is the only
 * thing that knows whether an item key collided or whether the protocol was
 * published from another tab in the last thirty seconds, and a form that
 * optimistically shows an item that was actually rejected is a form that lies.
 */

const field =
  "min-h-[44px] w-full rounded-[3px] border border-limestone-line bg-white px-3 text-[16px] text-slate outline-none focus:border-slate";
const label = "block text-[13px] font-semibold text-slate";
const button =
  "inline-flex min-h-[44px] items-center justify-center rounded-[3px] bg-brass px-4 text-[14px] font-bold text-slate-ink transition-colors hover:bg-brass-light disabled:opacity-50";

async function post(payload: Record<string, unknown>) {
  const res = await fetch("/api/portal/field", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; id?: string } | null;
  if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not work.");
  return body;
}

function Problem({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 text-[13px] leading-[1.5] font-semibold text-[#a3241c]">
      {message}
    </p>
  );
}

export function NewProtocolForm({
  services,
  existing,
}: {
  services: { slug: string; name: string }[];
  existing: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceSlug, setServiceSlug] = useState(services[0]?.slug ?? "");
  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [copyFromId, setCopyFromId] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={button}>
        Draft a protocol
      </button>
    );
  }

  return (
    <form
      className="rounded-[4px] border border-limestone-line bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const body = await post({
            action: "create_protocol",
            serviceSlug,
            name,
            summary,
            copyFromId: copyFromId || null,
          });
          setOpen(false);
          setName("");
          setSummary("");
          router.push(`/portal/protocols?id=${body.id}`);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">New protocol</p>

      <div className="mt-3 flex flex-col gap-3">
        <div>
          <label htmlFor="p-service" className={label}>
            Service line
          </label>
          <select
            id="p-service"
            value={serviceSlug}
            onChange={(e) => setServiceSlug(e.target.value)}
            className={`${field} mt-1.5`}
          >
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="p-name" className={label}>
            Name
          </label>
          <input
            id="p-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Windstorm evidence, coastal"
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <label htmlFor="p-summary" className={label}>
            What this protocol is for (optional)
          </label>
          <input
            id="p-summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={`${field} mt-1.5`}
          />
        </div>

        {existing.length > 0 ? (
          <div>
            <label htmlFor="p-copy" className={label}>
              Start from an existing protocol (optional)
            </label>
            <select
              id="p-copy"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
              className={`${field} mt-1.5`}
            >
              <option value="">Start empty</option>
              {existing.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-muted">
              Copies every item. This is how a version two normally starts: change two items out of
              fifteen rather than retyping the other thirteen.
            </p>
          </div>
        ) : null}
      </div>

      <Problem message={error} />

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Creating" : "Create draft"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-4 text-[14px] font-semibold text-slate"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const KINDS: { value: EvidenceKind; label: string; hint: string }[] = [
  { value: "photo", label: "Photograph", hint: "The camera opens. Can require several frames." },
  { value: "measurement", label: "Measurement", hint: "A number, with a unit and an expected range." },
  { value: "reading", label: "Instrument reading", hint: "A number from a meter or gauge." },
  { value: "document", label: "Document", hint: "A file the technician is handed on site." },
  { value: "note", label: "Written note", hint: "Text. Whitespace does not count as a note." },
];

function AddItem({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<EvidenceKind>("photo");
  const [itemLabel, setItemLabel] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [instructions, setInstructions] = useState("");
  const [required, setRequired] = useState(true);
  const [unit, setUnit] = useState("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [minCount, setMinCount] = useState("");

  const numeric = kind === "measurement" || kind === "reading";

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await post({
            action: "add_protocol_item",
            templateId,
            itemKey: itemKey || itemLabel,
            kind,
            label: itemLabel,
            instructions,
            required,
            unit: numeric ? unit : null,
            minValue: numeric && minValue !== "" ? Number(minValue) : null,
            maxValue: numeric && maxValue !== "" ? Number(maxValue) : null,
            minCount: kind === "photo" && minCount !== "" ? Number(minCount) : null,
          });
          setItemLabel("");
          setItemKey("");
          setInstructions("");
          setUnit("");
          setMinValue("");
          setMaxValue("");
          setMinCount("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : "That did not work.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Add an item</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="i-label" className={label}>
            What the technician sees
          </label>
          <input
            id="i-label"
            value={itemLabel}
            onChange={(e) => setItemLabel(e.target.value)}
            required
            placeholder="All four elevations of the structure"
            className={`${field} mt-1.5`}
          />
        </div>

        <div>
          <label htmlFor="i-kind" className={label}>
            Kind
          </label>
          <select
            id="i-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as EvidenceKind)}
            className={`${field} mt-1.5`}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-muted">
            {KINDS.find((k) => k.value === kind)?.hint}
          </p>
        </div>

        <div>
          <label htmlFor="i-key" className={label}>
            Key (optional)
          </label>
          <input
            id="i-key"
            value={itemKey}
            onChange={(e) => setItemKey(e.target.value)}
            placeholder="derived from the label"
            className={`${field} mt-1.5`}
          />
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-muted">
            How this item is identified in the record. Stable across versions, so a review can
            compare the same item between them.
          </p>
        </div>

        {kind === "photo" ? (
          <div>
            <label htmlFor="i-count" className={label}>
              Frames required
            </label>
            <input
              id="i-count"
              type="number"
              min={1}
              inputMode="numeric"
              value={minCount}
              onChange={(e) => setMinCount(e.target.value)}
              placeholder="1"
              className={`${field} mt-1.5`}
            />
          </div>
        ) : null}

        {numeric ? (
          <>
            <div>
              <label htmlFor="i-unit" className={label}>
                Unit
              </label>
              <input
                id="i-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="in12"
                className={`${field} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="i-min" className={label}>
                Expected minimum
              </label>
              <input
                id="i-min"
                type="number"
                step="any"
                inputMode="decimal"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className={`${field} mt-1.5`}
              />
            </div>
            <div>
              <label htmlFor="i-max" className={label}>
                Expected maximum
              </label>
              <input
                id="i-max"
                type="number"
                step="any"
                inputMode="decimal"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className={`${field} mt-1.5`}
              />
            </div>
          </>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor="i-instructions" className={label}>
            Instructions for the technician (optional)
          </label>
          <input
            id="i-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Stand back far enough that the roof line and the ground are both in frame."
            className={`${field} mt-1.5`}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="flex min-h-[44px] items-center gap-2.5 text-[14px] text-slate">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-5 w-5 accent-[#1d2a35]"
            />
            Required. The package cannot be submitted without it.
          </label>
        </div>
      </div>

      <Problem message={error} />

      <button type="submit" disabled={busy} className={`${button} mt-4`}>
        {busy ? "Adding" : "Add item"}
      </button>
    </form>
  );
}

function RemoveItem({ templateId, itemId }: { templateId: string; itemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post({ action: "remove_protocol_item", templateId, itemId });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex min-h-[44px] shrink-0 items-center rounded-[3px] border border-limestone-line px-3 text-[13px] font-semibold text-slate-muted hover:border-slate hover:text-slate"
    >
      {busy ? "Removing" : "Remove"}
    </button>
  );
}

export const ItemEditor = { Add: AddItem, Remove: RemoveItem };

export function PublishButton({ id, itemCount }: { id: string; itemCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Publish</p>
      <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[1.55] text-slate-muted">
        Publishing makes this the protocol every new job in this service line is worked to, and
        retires the version it replaces. After that it cannot be edited, only superseded.
      </p>
      <Problem message={error} />
      <button
        type="button"
        disabled={busy || itemCount === 0}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await post({ action: "publish_protocol", id });
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That did not work.");
          } finally {
            setBusy(false);
          }
        }}
        className={`${button} mt-3`}
      >
        {busy ? "Publishing" : "Publish this protocol"}
      </button>
      {itemCount === 0 ? (
        <p className="mt-2 text-[13px] text-slate-muted">
          Add at least one required item first. An empty checklist is one a technician can never
          finish.
        </p>
      ) : null}
    </div>
  );
}
