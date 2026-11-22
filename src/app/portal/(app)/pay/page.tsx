import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { payLedger, techNamesRead } from "@/lib/ops-field";
import { ownProductionPay } from "@/lib/ops-engineer";
import { isKnown } from "@/lib/ops-money";
import { payFigures } from "@/lib/pay-figures";
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
import { formatInFirmZone } from "@/lib/firm-calendar";

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
  void: { label: "Void", tone: "inert", means: "Canceled. It is kept rather than deleted." },
};

/*
 * THE WORDS OF THE TECHNICIAN'S PAGE, AND OF THE SAME LEDGER READ BY THE FIRM.
 * TECH_COPY is the page as it always read; FIRM_COPY is for whoever holds
 * ledger.read_all (the every-role walk of 2026-11-14).
 */
const TECH_COPY = {
  eyebrow: "Field",
  title: "Your pay",
  lede: "A flat rate per job, written to the ledger when you submit the evidence and independent of what the engineer decides. Read from the ledger, not recalculated here.",
  owed: "Owed to you",
  paid: "Paid to date",
  panel: "One row per job. The status says where it has got to, and nothing here is estimated.",
  emptyTitle: "Nothing on your ledger yet",
  emptyBody:
    "An entry is written the moment you submit the evidence for a job you accepted, at the flat rate that was on the offer. It does not wait on the engineer's decision.",
};
const FIRM_COPY: typeof TECH_COPY = {
  eyebrow: "Billing",
  title: "Technician pay",
  lede: "Every technician's pay: a flat rate per job, written to the ledger when the technician submits the evidence and independent of what the engineer decides. Read from the ledger, not recalculated here.",
  owed: "Owed to technicians",
  paid: "Paid to technicians",
  panel: "One row per job, for every technician. The status says where it has got to, and nothing here is estimated.",
  emptyTitle: "No technician pay written yet",
  emptyBody:
    "An entry is written when a technician submits the evidence for a job they accepted, at the flat rate on the offer. Approving and paying entries is done on Billing.",
};

const WHEN = (iso: string) =>
  (formatInFirmZone(iso, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) ?? "");

/*
 * THE ENGINEER IS PAID PRODUCTION, NOT A FIELD RATE. Part 1 finding 7, Robert's
 * answer 1 of 2026-11-14. The engineer holds ledger.read_own, so "Your pay"
 * opened payLedger, the technician's ledger, under the technician's eyebrow and
 * wording, and read $0.00 for ever while his production credit sat on
 * Responsible charge. His own production rows are his pay; the words below are
 * the charge log's own account of when it is written.
 */
const ENGINEER_STATUS: Record<string, { label: string; tone: StatusTone; means: string }> = {
  pending: { label: "Written", tone: "pending", means: "Recorded when you decided the review. Waiting on approval." },
  approved: { label: "Approved", tone: "in-motion", means: "Approved for payment and not yet paid." },
  paid: { label: "Paid", tone: "good", means: "Paid." },
  void: { label: "Void", tone: "inert", means: "Canceled. It is kept rather than deleted." },
};

async function EngineerPay({ actor }: { actor: Awaited<ReturnType<typeof currentActor>> }) {
  const read = await ownProductionPay(actor);
  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow="Engineering" title="Your pay" />
        <RestrictedMode />
        <p role="alert" className="text-[13.5px] leading-[1.55] text-[var(--ink)]">
          {read.error} So no figure is shown: this is a failed read, not a ledger with nothing on it. Reload the page in a
          moment.
        </p>
      </>
    );
  }
  const rows = read.rows;
  /* One rule for owed and paid (pay-figures.ts): void is neither, a demonstration file moves nothing. */
  const { owedCents: owed, paidCents: paid } = payFigures(rows);
  const unpriced = rows.filter((r) => !isKnown(r.amount_cents)).length;

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Your pay"
        lede="Production credit for each review you decide, written when you decide it. A file you decline pays the same as one you seal. Read from the ledger, not recalculated here."
      />

      <RestrictedMode />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure label="Owed to you" value={<MoneyFigure value={owed} />} note="Written or approved, not yet paid." />
        <Figure label="Paid to date" value={<MoneyFigure value={paid} />} note="Marked paid by the office." />
        <Figure label="Entries" value={String(rows.length)} note="Most recent first." />
      </div>

      <ExclusionNote excluded={unpriced} of="amount" />

      <Panel
        title="Every entry"
        description="One row per review you decided. The status says where it has got to, and nothing here is estimated. Time and the month's charge log are on Responsible charge."
      >
        {rows.length === 0 ? (
          <EmptyState
            title="Nothing on your ledger yet"
            body="An entry is written when you decide a review, if a production rate exists for that service line."
          />
        ) : (
          <ul className="divide-y divide-[var(--row-rule)]">
            {rows.map((row) => {
              const s = ENGINEER_STATUS[row.status] ?? { label: row.status, tone: "inert" as StatusTone, means: "" };
              return (
                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">{row.note ?? "Review"}</span>
                    <span className="font-display text-[15px] font-bold text-[var(--navy)]">
                      <MoneyFigure value={row.amount_cents} />
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <StatusPill tone={s.tone}>{s.label}</StatusPill>
                    <span className="text-[12px] text-[var(--secondary)]">
                      {row.period ?? "no period"} · written {WHEN(row.created_at)}
                    </span>
                  </div>
                  {s.means ? <p className="mt-1 text-[12px] leading-[1.5] text-[var(--secondary)]">{s.means}</p> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

export default async function PayPage() {
  const actor = await currentActor();
  if (!can(actor, "ledger.read_own") && !can(actor, "ledger.read_all")) notFound();

  /* The engineer's own pay is his production ledger (Part 1 finding 7). Everybody else's view is unchanged. */
  if (actor?.role === "engineer") return <EngineerPay actor={actor} />;

  /*
   * THE FIRM'S VIEW SPEAKS TO THE FIRM. The every-role walk of 2026-11-14 found
   * the administrator, who reads every technician's ledger (ledger.read_all),
   * told "Your pay", "Owed to you" and "when you submit the evidence". The rows
   * and figures are the same read; only the words change. A technician never
   * holds ledger.read_all, so a technician's page is word for word as before.
   */
  const copy = can(actor, "ledger.read_all") ? FIRM_COPY : TECH_COPY;

  const read = await payLedger(actor);

  /*
   * A FAILED READ IS NOT AN EMPTY LEDGER (audit finding F24, 2026-10-24). The
   * comment below is right that no entries is a known zero; a read that failed
   * knows nothing, so no figure is shown at all.
   */
  if (!read.ok) {
    return (
      <>
        <PageHead eyebrow={copy.eyebrow} title={copy.title} />
        <RestrictedMode />
        <p role="alert" className="text-[13.5px] leading-[1.55] text-[var(--ink)]">
          {read.error} So no figure is shown: this is a failed read, not a ledger with nothing on it. Reload the page in a
          moment.
        </p>
      </>
    );
  }
  const rows = read.rows;

  /*
   * Summed by status rather than netted into one figure.
   *
   * "You are owed $240" and "you have been paid $840" are two different facts
   * and a technician needs both. A single net number would answer neither, and
   * an absent amount is excluded rather than counted as nothing, which is the
   * same rule the rest of the platform follows.
   */
  /* One rule for owed and paid, shared with the dashboards (pay-figures.ts, 2026-10-10). */
  const { owedCents: owed, paidCents: paid } = payFigures(rows);

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

  /*
   * WHOSE ROW IT IS, ON THE FIRM'S VIEW ONLY. Robert's answer 9 of 2026-11-21:
   * the administrator reads every technician's rows, and none said whose it
   * was. A technician's own page is unchanged, because every row is theirs.
   * A failed read of the names is said once, above the list, rather than
   * leaving rows that name nobody as if that were known.
   */
  const firmView = copy === FIRM_COPY;
  const names = firmView ? await techNamesRead(rows.map((r) => r.tech_id)) : null;
  const whose = (techId: string) => {
    if (!firmView || names === null) return null;
    return names.get(techId) || "A technician with no profile name on file";
  };

  return (
    <>
      <PageHead eyebrow={copy.eyebrow} title={copy.title} lede={copy.lede} />
      {firmView && names === null && rows.length > 0 ? (
        <p role="alert" className="text-[13.5px] leading-[1.55] text-[var(--ink)]">
          The technicians&rsquo; names could not be read, so the rows below do not say whose pay each one is. The amounts
          and totals are unaffected. Reload the page in a moment.
        </p>
      ) : null}

      <RestrictedMode />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Figure
          label={copy.owed}
          value={<MoneyFigure value={owed} />}
          note="Written or approved, not yet paid."
        />
        <Figure
          label={copy.paid}
          value={<MoneyFigure value={paid} />}
          note="Marked paid by the office."
        />
        <Figure label="Entries" value={String(rows.length)} note="Most recent first." />
      </div>

      <ExclusionNote excluded={unpriced} of="amount" />

      <Panel title="Every entry" description={copy.panel}>
        {rows.length === 0 ? (
          <EmptyState
            title={copy.emptyTitle}
            body={copy.emptyBody}
            action={
              copy === FIRM_COPY ? (
                <Link href="/portal/billing" className="inline-flex min-h-[44px] items-center text-[13.5px] font-semibold text-[var(--navy)] underline">
                  Open Billing
                </Link>
              ) : undefined
            }
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
                  {whose(row.tech_id) ? (
                    <p data-pay-person className="mb-1 text-[13.5px] font-semibold text-[var(--navy)]">
                      {whose(row.tech_id)}
                    </p>
                  ) : null}
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
