import { notFound } from "next/navigation";
import Link from "next/link";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { launchMode } from "@/lib/launch";
import { deliverableBlockedForDisplay } from "@/lib/line-gate";
import { CATALOG, catalogFor } from "@data/catalog";
import { fieldsFor, INTAKE_GROUPS, INTAKE_GROUP_LABEL, type IntakeField } from "@data/intake-fields";
import { PageHead } from "@/components/portal/surfaces";
import {
  CALL_SCRIPTS,
  CALL_TYPES,
  SHUT_GATE_LINE,
  type CallType,
  type ScriptLine,
} from "@/content/call-scripts";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

/**
 * THE PRINTABLE CALL SCRIPT (C7). Robert's rulings of 2026-11-14 on issue #1.
 *
 * The rep's lines are the approved words in src/content/call-scripts.ts. The
 * service's questions are fieldsFor(service, deliverable), the one definition
 * New job asks from, so a printed script and the form cannot disagree; the
 * "Getting in" questions print under the access line rather than twice.
 *
 * LINE 9 IS ALWAYS SAID WHERE THE DELIVERABLE CAN BE ORDERED NOW. Robert's
 * correction to the roof script: the not taking payment sentence is only for a
 * gate that is shut. Shut here means what the order page shows for this
 * deliverable (deliverableBlockedForDisplay), so a held deliverable, such as the
 * real estate letter, prints the shut sentence even when the firm is open.
 *
 * files.create, New job's own permission: the script is for the person taking
 * the call. notFound rather than a 403, the standing rule.
 */
export default async function CallScriptPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; deliverable?: string }>;
}) {
  const actor = await currentActor();
  if (!actor || !can(actor, "files.create")) notFound();

  const params = await searchParams;
  const type: CallType = CALL_TYPES.includes(params.type as CallType) ? (params.type as CallType) : "roof";
  const script = CALL_SCRIPTS[type];

  /* A deliverable the caller chose, "<service>/<tier>", for the three scripts that do not fix one. */
  const chosen = (() => {
    const [serviceSlug, tier] = String(params.deliverable ?? "").split("/");
    return serviceSlug && tier && catalogFor(serviceSlug, tier) ? { serviceSlug, tier } : null;
  })();
  const deliverable = script.deliverable ?? chosen ?? { serviceSlug: "roof-inspections", tier: "standard" };
  const entry = catalogFor(deliverable.serviceSlug, deliverable.tier);
  if (!entry) notFound();

  const fields = fieldsFor(deliverable.serviceSlug, deliverable.tier).filter((f) => f.id !== "copy_to");
  const asked = fields.filter((f) => f.group !== "access");
  const access = fields.filter((f) => f.group === "access");
  const blocked = await deliverableBlockedForDisplay(entry, launchMode());

  const choosable = CATALOG.filter((e) => e.orderType !== "quote");

  return (
    <div className="portal-sections flex flex-col gap-6">
      <PageHead
        eyebrow="Work"
        title="Call script"
        lede="What to say on the call, in the approved words, with the service's own questions in the order New job asks them."
        actions={<PrintButton />}
      />

      <form method="get" className="flex flex-wrap items-end gap-4 print:hidden">
        <label className="flex flex-col gap-1 text-[14px] font-semibold text-[var(--ink)]">
          Who is calling
          <select name="type" defaultValue={type} className="min-h-[44px] rounded-[2px] border border-[var(--border)] bg-white px-3 text-[14px] font-normal">
            {CALL_TYPES.map((t) => (
              <option key={t} value={t}>
                {CALL_SCRIPTS[t].title}
              </option>
            ))}
          </select>
        </label>
        {script.deliverable ? null : (
          <label className="flex flex-col gap-1 text-[14px] font-semibold text-[var(--ink)]">
            What they need
            <select
              name="deliverable"
              defaultValue={`${deliverable.serviceSlug}/${deliverable.tier}`}
              className="min-h-[44px] rounded-[2px] border border-[var(--border)] bg-white px-3 text-[14px] font-normal"
            >
              {choosable.map((e) => (
                <option key={`${e.serviceSlug}/${e.tier}`} value={`${e.serviceSlug}/${e.tier}`}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center rounded-[2px] bg-[var(--navy)] px-4 text-[14px] font-semibold text-white"
        >
          Show the script
        </button>
        <Link href="/portal/intake" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
          Back to New job
        </Link>
      </form>

      <section aria-labelledby="script-title" className="max-w-[72ch]">
        <h2 id="script-title" className="text-[20px] font-semibold text-[var(--ink)]">
          {script.title}
        </h2>
        <p className="mt-1 text-[14px] text-[var(--secondary)]">For: {entry.name}</p>
        {blocked ? (
          <p className="mt-2 text-[14px] text-[var(--ink)]">
            This cannot be ordered now, so the last line is the one for a shut gate. {blocked}
          </p>
        ) : null}
        <ScriptLines lines={script.lines} asked={asked} access={access} blocked={blocked !== null} />
      </section>
    </div>
  );
}

function ScriptLines({
  lines,
  asked,
  access,
  blocked,
  start = 1,
}: {
  lines: ScriptLine[];
  asked: IntakeField[];
  access: IntakeField[];
  blocked: boolean;
  start?: number;
}) {
  return (
    <ol start={start} className="mt-4 flex list-decimal flex-col gap-4 pl-6">
      {lines.map((line, i) => (
        <li key={i} className="text-[16px] leading-[1.6] text-[var(--ink)]">
          {line.segments.map((s, j) =>
            "say" in s ? (
              <p key={j} className="font-semibold">
                &ldquo;{line.payment && blocked ? SHUT_GATE_LINE : s.say}&rdquo;
              </p>
            ) : (
              <p key={j} className="text-[14px] text-[var(--secondary)]">
                {s.do}
              </p>
            ),
          )}
          {line.questions ? <Questions fields={asked} /> : null}
          {line.access ? <Questions fields={access} /> : null}
          {line.continues ? (
            <ScriptLines
              lines={CALL_SCRIPTS[line.continues.script].lines.slice(line.continues.fromLine - 1)}
              asked={asked}
              access={access}
              blocked={blocked}
              start={line.continues.fromLine}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** The questions as New job asks them, grouped as it groups them. A label is read word for word. */
function Questions({ fields }: { fields: IntakeField[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="mt-2 flex flex-col gap-3 border-l-2 border-[var(--border)] pl-4">
      {INTAKE_GROUPS.map((group) => {
        const inGroup = fields.filter((f) => f.group === group);
        if (inGroup.length === 0) return null;
        return (
          <div key={group}>
            <p className="text-[14px] font-semibold text-[var(--secondary)]">{INTAKE_GROUP_LABEL[group]}</p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {inGroup.map((f) => (
                <li key={f.id} className="text-[15px] leading-[1.55] text-[var(--ink)]">
                  {f.label}
                  {f.kind === "file" ? <span className="text-[var(--secondary)]"> (they can send this)</span> : null}
                  {f.options?.length ? <span className="block text-[14px] text-[var(--secondary)]">Choices: {f.options.join("; ")}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
