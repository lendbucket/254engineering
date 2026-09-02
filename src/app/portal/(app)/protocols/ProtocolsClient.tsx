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

/**
 * The check questions on a protocol.
 *
 * WHY THEY LIVE ON THE PROTOCOL AND NOT ON A SEPARATE SCREEN
 * ----------------------------------------------------------
 * The engineer who decides what a technician must capture is the one who decides
 * what they must understand about capturing it. Those are one act on one
 * document, and splitting them into two screens produces protocols with no
 * questions, which is a certification gate with no door.
 *
 * The rationale is required rather than optional. It is the only thing a
 * technician who gets the question wrong receives, and a check that fails
 * somebody without telling them why has taught nothing.
 */
export function QuestionEditor({
  templateId,
  questions,
  editable,
}: {
  templateId: string;
  questions: { id: string; prompt: string; options: string[]; correctIndex: number; rationale: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [rationale, setRationale] = useState("");

  async function send(payload: Record<string, unknown>) {
    const res = await fetch("/api/portal/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !body?.ok) throw new Error(body?.error ?? "That did not work.");
  }

  return (
    <div>
      <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">
        Certification check
      </p>
      <p className="mt-1.5 max-w-[70ch] text-[13px] leading-[1.55] text-slate-muted">
        A technician cannot be offered work on this service line until they answer all of these
        correctly. Retakes are free and a wrong answer shows your reasoning, so write the reasoning
        as if it is the only thing they will read about that item, because it is.
      </p>

      {questions.length === 0 ? (
        <p className="mt-3 text-[13.5px] leading-[1.5] text-slate-muted">
          No questions yet. A protocol can be published without them, and until they exist nobody can
          certify against it, so nobody can be dispatched on this line.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-limestone-line">
          {questions.map((q, i) => (
            <li key={q.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-slate">
                    {i + 1}. {q.prompt}
                  </p>
                  <ul className="mt-1.5 flex flex-col gap-0.5">
                    {q.options.map((o, index) => (
                      <li
                        key={o}
                        className={`text-[13px] leading-[1.5] ${
                          index === q.correctIndex ? "font-semibold text-slate" : "text-slate-muted"
                        }`}
                      >
                        {index === q.correctIndex ? "Correct: " : ""}
                        {o}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 max-w-[65ch] text-[13px] leading-[1.5] text-slate-muted">
                    Shown when wrong: {q.rationale}
                  </p>
                </div>
                {editable ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await send({ action: "remove_question", templateId, questionId: q.id });
                      router.refresh();
                    }}
                    className="inline-flex min-h-[44px] shrink-0 items-center rounded-[3px] border border-limestone-line px-3 text-[13px] font-semibold text-slate-muted hover:border-slate hover:text-slate"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {editable ? (
        <form
          className="mt-5 border-t border-limestone-line pt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await send({
                action: "add_question",
                templateId,
                prompt,
                options: options.filter((o) => o.trim()),
                correctIndex,
                rationale,
              });
              setPrompt("");
              setOptions(["", ""]);
              setCorrectIndex(0);
              setRationale("");
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "That did not work.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="text-[12px] font-bold tracking-[0.1em] text-brass-ink uppercase">Add a question</p>

          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label htmlFor="q-prompt" className={label}>
                The question
              </label>
              <input
                id="q-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                placeholder="There is no attic access. What do you do?"
                className={`${field} mt-1.5`}
              />
            </div>

            <fieldset>
              <legend className={label}>Options, and which one is right</legend>
              <div className="mt-1.5 flex flex-col gap-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct"
                      checked={correctIndex === index}
                      onChange={() => setCorrectIndex(index)}
                      aria-label={`Option ${index + 1} is correct`}
                      className="h-5 w-5 shrink-0 accent-[#1d2a35]"
                    />
                    <input
                      value={option}
                      onChange={(e) =>
                        setOptions((prev) => prev.map((o, i) => (i === index ? e.target.value : o)))
                      }
                      placeholder={`Option ${index + 1}`}
                      className={field}
                    />
                    {options.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setOptions((prev) => prev.filter((_, i) => i !== index));
                          if (correctIndex >= index && correctIndex > 0) setCorrectIndex(correctIndex - 1);
                        }}
                        className="inline-flex min-h-[44px] shrink-0 items-center px-2 text-[13px] font-semibold text-slate-muted"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {options.length < 6 ? (
                <button
                  type="button"
                  onClick={() => setOptions((prev) => [...prev, ""])}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-[3px] border border-limestone-line px-3 text-[13px] font-semibold text-slate"
                >
                  Another option
                </button>
              ) : null}
            </fieldset>

            <div>
              <label htmlFor="q-rationale" className={label}>
                Why the right answer is right
              </label>
              <input
                id="q-rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                required
                placeholder="Photograph the obstruction so the engineer can see why there is no deck shot."
                className={`${field} mt-1.5`}
              />
              <p className="mt-1.5 text-[12.5px] leading-[1.5] text-slate-muted">
                Shown to anybody who gets this wrong. It is the only thing they receive.
              </p>
            </div>
          </div>

          <Problem message={error} />

          <button type="submit" disabled={busy} className={`${button} mt-4`}>
            {busy ? "Adding" : "Add question"}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-[13px] leading-[1.55] text-slate-muted">
          Questions cannot be edited on a published protocol, for the same reason its items cannot.
          Draft the next version.
        </p>
      )}
    </div>
  );
}
