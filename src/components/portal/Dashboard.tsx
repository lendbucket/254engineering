import type { ReactNode } from "react";
import Link from "next/link";
import type { Attention, Breakdown, MoneyTile, Tile } from "@/lib/ops-dashboard";
import { isKnown, money, moneyOr } from "@/lib/ops-money";

/**
 * A link when there is somewhere to go, and a plain element when there is not.
 *
 * ops-dashboard's pruneUnreachableLinks drops the href of any tile whose
 * destination this actor cannot open. Found overnight on 2026-09-10: an
 * administrator's "Waiting on an engineer" tile linked at the review queue,
 * which is gated on holdsLicence, and clicking it landed on "That page is not
 * here". The count is worth showing and the destination is not theirs.
 *
 * The HOVER treatment is passed separately and applied only to the link, on
 * purpose. A surface that lights up under a pointer and then does nothing is
 * the same lie one step quieter.
 */
function Card({
  href,
  className,
  hover,
  children,
}: {
  href?: string;
  className: string;
  hover: string;
  children: ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={`${className} ${hover}`}>
      {children}
    </Link>
  );
}

/**
 * The dashboard's three kinds of tile.
 *
 * WHY COUNTS AND MONEY ARE TWO COMPONENTS
 * ---------------------------------------
 * A count of zero is a fact: nothing is in the queue. A money figure of null is
 * the absence of a fact: nobody has entered the price. They render differently
 * on purpose, and keeping them in one component is how the second eventually
 * gets rendered like the first.
 *
 * CountTile only ever receives a number. MoneyTile is the only thing here that
 * can print "not set", and it is the only thing that ever should.
 */

/*
 * THE COLOURED TOP RULE ON EVERY TILE IS GONE.
 *
 * The standards file rules out accent borders on cards, and a dashboard of nine
 * tiles each with its own coloured rule was every line competing for attention
 * and none of them survivable at a glance: the eye cannot rank nine things.
 *
 * The state moves entirely into the FIGURE, which is where somebody looks
 * anyway. A tile that needs attention has a coloured number; the rest are navy.
 * That leaves at most a couple of coloured things on the screen, which is the
 * number a person can actually act on.
 */
const NUMBER_TONE: Record<Tile["tone"], string> = {
  neutral: "text-[var(--ink)]",
  good: "text-[var(--ink)]",
  warn: "text-[var(--ink)]",
  bad: "text-[var(--ink)]",
};

export function CountTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        /*
          A TILE WITH NOWHERE TO GO IS STILL A TILE.

          ops-dashboard's pruneUnreachableLinks removes the href when this actor
          cannot open the destination. An administrator's "Waiting on an
          engineer" count is worth showing and the review queue is not theirs to
          open, so it renders as a card rather than as a link to a 404.

          The hover treatment goes with the link, because a surface that
          responds to a pointer and does nothing is the same lie one step
          quieter.
        */
        <Card
          key={tile.label}
          href={tile.href}
          className="block py-1"
          hover="active:opacity-70"
        >
          {/*
            A count that is not known says so, in the same shape MoneyFigure
            uses for an absent figure. Rendering `null` here would print nothing
            at all and read as a tile that had not loaded, which is the failure
            ops-money.ts:36 names: an empty space is the one thing somebody will
            eventually decide means zero.
          */}
          {tile.count === null ? (
            <p className="text-[26px] leading-none font-semibold text-[var(--faint)] italic">
              not known
            </p>
          ) : (
            <p className={`text-[26px] leading-none font-semibold ${NUMBER_TONE[tile.tone]}`}>
              {tile.count}
            </p>
          )}
          <p className="mt-2 text-[13px] leading-[1.35] font-semibold text-[var(--ink)]">{tile.label}</p>
          <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--faint)]">{tile.note}</p>
        </Card>
      ))}
    </div>
  );
}

/**
 * Money, where absent is a visible state.
 *
 * An unknown figure prints "not set" in the same weight as a real one, and the
 * note underneath says what would have to happen for it to become a number. It
 * is deliberately not a dash and not an empty space, because both read as a
 * rendering fault and somebody eventually decides they mean zero.
 */
export function MoneyTiles({ tiles }: { tiles: MoneyTile[] }) {
  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="py-1"
        >
          <p className="text-[13px] font-semibold text-[var(--ink)]">{tile.label}</p>
          <p
            className={`mt-1.5 text-[26px] leading-none font-semibold ${
              isKnown(tile.value) ? "text-[var(--ink)]" : "text-[var(--secondary)]"
            }`}
          >
            {moneyOr(tile.value, tile.absent)}
          </p>
          <p className="mt-2 max-w-[46ch] text-[12px] leading-[1.5] text-[var(--secondary)]">{tile.note}</p>
        </div>
      ))}
    </div>
  );
}

export function AttentionList({ items }: { items: Attention[] }) {
  if (items.length === 0) {
    return (
      <div>
        <p className="text-[15px] font-semibold text-[var(--ink)]">Nothing needs you right now</p>
        <p className="mt-2 max-w-[52ch] text-[14px] leading-[1.6] text-[var(--secondary)]">
          Overdue work, missing figures and expiring credentials appear here when they exist. An
          empty list means the checks ran and found nothing, not that nothing was checked.
        </p>
      </div>
    );
  }

  return (
    <ul className="border-t border-[var(--row-rule)]">
      {items.map((item) => (
        <li key={item.label}>
          <Card
            href={item.href}
            className="block border-b border-[var(--row-rule)] py-3"
            hover="active:opacity-70"
          >
            <p className="text-[14px] font-semibold text-[var(--ink)]">{item.label}</p>
            <p className="mt-1 max-w-[74ch] text-[14px] leading-[1.55] text-[var(--secondary)]">{item.detail}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/**
 * A grouped answer, rendered as rows rather than as a number.
 *
 * The absent-versus-zero rule again, one level down and in two places. `rows`
 * null is a query that could not run and says so; an empty array is a query
 * that ran and found nothing, which is a result. A row's own `count` can be
 * null for the same reason a tile's can.
 *
 * The bar is a proportion of the largest row and carries no number of its own,
 * because a bar somebody can read a value off is a second figure that can
 * disagree with the one beside it.
 */
export function BreakdownList({ breakdown }: { breakdown: Breakdown }) {
  if (breakdown.rows === null) {
    return (
      <p className="text-[14px] text-[var(--faint)] italic">
        This could not be read, which is not the same as there being nothing. Tell an administrator.
      </p>
    );
  }

  if (breakdown.rows.length === 0) {
    return (
      <p className="text-[14px] text-[var(--secondary)]">
        The query ran and found nothing. That is a result rather than a gap.
      </p>
    );
  }

  const largest = Math.max(...breakdown.rows.map((r) => r.count ?? 0), 1);

  return (
    <ul className="flex flex-col gap-2">
      {breakdown.rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <Card
              href={breakdown.href}
              className="text-[14px] font-semibold text-[var(--navy)]"
              hover="underline-offset-2 hover:underline"
            >
              {row.label}
            </Card>
            <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-[var(--navy)]">
              {row.count === null ? (
                <span className="text-[14px] font-normal text-[var(--faint)] italic">not known</span>
              ) : (
                row.count
              )}
            </span>
          </div>
          <div className="w-full border-b-[3px] border-[var(--row-rule)]" aria-hidden="true">
            <div
              className="-mb-[3px] border-b-[3px] border-[var(--navy)]"
              style={{ width: `${Math.round(((row.count ?? 0) / largest) * 100)}%` }}
            />
          </div>
          <p className="text-[12px] text-[var(--secondary)]">{row.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/**
 * What a dashboard was asked to show and could not.
 *
 * The operator's ruling of 2026-09-08 says a figure the grants do not cover is
 * REPORTED rather than fixed by widening a grant. The same holds when it is the
 * schema that does not carry the fact, and this is where both land.
 *
 * It is a panel on the screen rather than a comment in the source on purpose.
 * The person who ruled that a customer service dashboard shows what a customer
 * is waiting for should be able to see, on the screen, that the platform has
 * never recorded that and what was shown instead.
 */
export function NotComputable({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) {
    return (
      <p className="text-[14px] text-[var(--secondary)]">
        Everything this screen was asked to show, it can compute.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reasons.map((reason) => (
        <li key={reason} className="text-[13px] leading-[1.5] text-[var(--secondary)]">
          {reason}
        </li>
      ))}
    </ul>
  );
}
