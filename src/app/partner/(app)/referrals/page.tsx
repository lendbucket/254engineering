import { currentPartner } from "@/lib/partner-auth";
import { partnerReferrals, REFERRAL_LABEL } from "@/lib/ops-partner-portal";
import { money } from "@/lib/ops-money";
import {
  AbsentChip,
  DataTable,
  EmptyState,
  Panel,
  RestrictedMode,
  StatusPill,
  type Column,
} from "@/components/portal/design";
import type { Referral } from "@/lib/ops-partner-portal";

export const dynamic = "force-dynamic";

/**
 * What this partner sent, and what each one has earned.
 *
 * WHAT IS NOT ON THIS SCREEN
 * --------------------------
 * The property address, the client, the file, its status, the engineer's
 * decision, and any document. A partner sees the facts of their own referral
 * and their own money; the engineering is the firm's and the client's.
 *
 * The reasoning for each exclusion is in docs/partner-portal.md, and
 * partner-audit asserts that no query in ops-partner-portal.ts names a
 * forbidden column, so this is a rule with a check behind it rather than a
 * habit.
 *
 * WHY THE STATE WORDS ARE NOT THE ORDER'S OWN
 * -------------------------------------------
 * The order machine's states describe the firm's work. Repeating them would
 * tell a partner more about a client's engagement than they have any business
 * knowing. These five say what a partner actually needs: has it been paid for,
 * is it done, did the money go back.
 */
export default async function PartnerReferrals() {
  const principal = await currentPartner();
  if (!principal) return null;

  const referrals = await partnerReferrals(principal);

  const columns: Column<Referral>[] = [
    {
      key: "reference",
      header: "Order",
      cell: (r) => <span className="font-mono font-semibold">{r.reference}</span>,
    },
    {
      key: "placed",
      header: "Placed",
      cell: (r) =>
        r.placedAt
          ? new Date(r.placedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "not recorded",
    },
    {
      key: "state",
      header: "State",
      cell: (r) => (
        <StatusPill
          tone={
            r.state === "returned"
              ? "failed"
              : r.state === "complete"
                ? "good"
                : r.state === "received"
                  ? "inert"
                  : "in-motion"
          }
        >
          {REFERRAL_LABEL[r.state]}
        </StatusPill>
      ),
    },
    {
      key: "basis",
      header: "Order value",
      numeric: true,
      /*
       * Shown only where a commission was computed from it. Under a flat fee no
       * basis was used, and printing the order value anyway would be telling a
       * partner what a client paid for a reason that does not exist.
       */
      cell: (r) =>
        r.basisCents === null ? <AbsentChip>shown when it is earned</AbsentChip> : money(r.basisCents),
    },
    {
      key: "earned",
      header: "Earned",
      numeric: true,
      cell: (r) =>
        r.waiting && r.earnedCents === null ? (
          <AbsentChip>owed, figure not yet known</AbsentChip>
        ) : r.earnedCents === null ? (
          <AbsentChip>not yet</AbsentChip>
        ) : (
          <span className="font-semibold">{money(r.earnedCents)}</span>
        ),
    },
  ];

  return (
    <>
      <RestrictedMode />

      <div>
        <h1 className="font-display text-[20px] leading-[1.2] font-bold text-[var(--navy)]">Referrals</h1>
        <p className="mt-1.5 max-w-[70ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          Every order credited to your code. A commission is earned when the firm delivers the work,
          not when the order is placed, so an order here can be underway and have earned nothing
          yet.
        </p>
      </div>

      <Panel>
        <DataTable
          caption="Orders credited to this partner"
          columns={columns}
          rows={referrals}
          total={referrals.length}
          empty={
            <EmptyState
              title="No referrals yet"
              body="An order appears here when somebody follows your link or gives your code at checkout. Nothing is credited retrospectively, so a referral made before your code existed will not appear."
            />
          }
        />
      </Panel>

      <Panel title="How credit is decided">
        <ul className="flex flex-col gap-2 text-[13.5px] leading-[1.6] text-[var(--ink)]">
          <li>A click on your link or your code given at checkout both count as a touch.</li>
          <li>The most recent touch within thirty days of the order wins.</li>
          <li>
            A typed code beats a click on the same day, because somebody saying your name is a
            stronger signal than a cookie.
          </li>
          <li>
            An existing customer placing another order is not credited. The programme pays for
            bringing business, not for being the last link somebody clicked.
          </li>
        </ul>
        <p className="mt-3 max-w-[70ch] text-[12.5px] leading-[1.6] text-[var(--secondary)]">
          Every touch is kept, including the ones that did not win. If you think an order should
          have been yours, ask the firm and they can show you the touch that beat it and when it
          happened.
        </p>
      </Panel>
    </>
  );
}
