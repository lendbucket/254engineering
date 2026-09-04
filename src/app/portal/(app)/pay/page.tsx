import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { payLedger } from "@/lib/ops-field";
import { isKnown } from "@/lib/ops-money";
import { PageHead } from "@/components/portal/surfaces";
import {
  Figure,
  MoneyFigure,
  Panel,
  StatusPill,
  EmptyState,
  ExclusionNote,
  RestrictedMode,
  type StatusTone,
} from "@/components/portal/design";

export const dynamic = "force-dynamic";

/**
 * What a technician has earned, and what has actually been paid.
 *
 * WHY THIS SCREEN EXISTS
 * ----------------------
 * Operator ruling, 2026-09-04: a technician who cannot see what they have
 * earned asks by text message. The dashboard already shows two totals; this is
 * the ledger those totals are made of, which is what somebody opens when the
 * total is not the number they expected.
 *
 * It reads payLedger, which decides visibility itself: a technician sees their
 * own rows and nobody else's, and an administrator sees everybody's. That rule
 * predates this screen and is not restated here, because a second copy of a
 * permission is a second thing to keep in step.
 *
 * WHAT THE WORDING HAS TO BE CAREFUL ABOUT
 * ----------------------------------------
 * The design's standards file says technicians are "paid flat-rate on
 * submission". They are not: the entitlement is WRITTEN on submission, before
 * any engineer has looked at the package, and an operator approves and pays it
 * afterwards. The prototype's own pay screen says "written on submission" and
 * is correct where the standards file is not, so this screen follows the
 * prototype. Telling somebody they have been paid when a row says pending is
 * the kind of thing that gets a firm a reputation.
 */

const STATUS: Record<string, { label: string; tone: StatusTone; means: string }> = {
  pending: {
    label: "Written",
    tone: "pending",
    means: "Recorded when you submitted the evidence. Waiting on approval.",
  },
  approved: {
    label: "Approved",
    tone: "in-motion",
    means: "Approved for payment and not yet paid.",
  },
  paid: { label: "Paid", tone: "good", means: "Paid." },
  void: { label: "Void", tone: "inert", means: "Cancelled. It is kept rather than deleted." },
};

const WHEN = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default async function PayPage() {
  const actor = await currentActor();
  if (!can(actor, "ledger.read_own") && !can(actor, "ledger.read_all")) notFound();

  const rows = await payLedger(actor);

  /*
   * Summed by status rather than netted into one figure.
   *
   * "You are owed $240" and "you have been paid $840" are two different facts
   * and a technician needs both. A single net number would answer neither, and
   * an absent amount is excluded rather than counted as nothing, which is the
   * same rule the rest of the platform follows.
   */
  const sum = (status: string) =>
    rows
      .filter((r) => r.status === status && isKnown(r.amount_cents))
      .reduce((total, r) => total + r.amount_cents, 0);

  const owed = sum("pending") + sum("approved");
  const paid = sum("paid");

  /*
   * AN EMPTY LEDGER IS ZERO, NOT ABSENT, AND I HAD THAT BACKWARDS.
   *
   * The first version passed null to MoneyFigure when there were no rows, so a
   * technician with nothing on their ledger was told their pay was "not set".
   * That is the exact distinction this platform spends three modules
   * protecting, used the wrong way round: "not set" means nobody entered a
   * figure, and no entries means the figure is known and it is zero.
   *
   * What IS absent is a row whose amount was never recorded. Those are excluded
   * from the totals rather than counted as nothing, and the footnote says so,
   * which is the rule money-audit has enforced since Phase 5.
   */
  const unpriced = rows.filter((r) => !isKnown(r.amount_cents)).length;

  return (
    <>
      <PageHead
        eyebrow="Field"
        title="Your pay"
        lede="A flat rate per job, written to the ledger when you submit the evidence and independent of what the engineer decides. Read from the ledger, not recalculated here."
      />

      <RestrictedMode />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure
          label="Owed to you"
          value={<MoneyFigure value={owed} />}
          note="Written or approved, not yet paid."
        />
        <Figure
          label="Paid to date"
          value={<MoneyFigure value={paid} />}
          note="Marked paid by the office."
        />
        <Figure label="Entries" value={String(rows.length)} note="Most recent first." />
      </div>

      <ExclusionNote excluded={unpriced} of="amount" />

      <Panel
        title="Every entry"
        description="One row per job. The status says where it has got to, and nothing here is estimated."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing on your ledger yet"
            body="An entry is written the moment you submit the evidence for a job you accepted, at the flat rate that was on the offer. It does not wait on the engineer's decision."
          />
        ) : (
          <ul className="divide-y divide-[var(--row-rule)]">
            {rows.map((row) => {
              const s = STATUS[row.status] ?? {
                label: row.status,
                tone: "inert" as StatusTone,
                means: "",
              };
              return (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                      {row.note ?? "Job"}
                    </span>
                    <span className="font-display text-[15px] font-bold text-[var(--navy)]">
                      <MoneyFigure value={row.amount_cents} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    <span className="text-[12px] text-[var(--secondary)]">
                      {row.period} · written {WHEN(row.created_at)}
                    </span>
                  </div>
                  {s.means ? (
                    <p className="mt-1 text-[12px] leading-[1.5] text-[var(--secondary)]">{s.means}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
