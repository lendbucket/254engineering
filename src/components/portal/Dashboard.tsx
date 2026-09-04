import Link from "next/link";
import type { Attention, MoneyTile, Tile } from "@/lib/ops-dashboard";
import { isKnown, money } from "@/lib/ops-money";

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
 * tiles each with its own coloured rule was nine lines competing for attention
 * and none of them survivable at a glance: the eye cannot rank nine things.
 *
 * The state moves entirely into the FIGURE, which is where somebody looks
 * anyway. A tile that needs attention has a coloured number; the rest are navy.
 * That leaves at most a couple of coloured things on the screen, which is the
 * number a person can actually act on.
 */
const NUMBER_TONE: Record<Tile["tone"], string> = {
  neutral: "text-[var(--navy)]",
  good: "text-[var(--navy)]",
  warn: "text-[var(--gold-deep)]",
  bad: "text-[var(--red)]",
};

export function CountTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((tile) => (
        <Link
          key={tile.label}
          href={tile.href}
          className="block rounded-[var(--radius-card)] border border-[var(--border)] bg-white p-4 transition-colors hover:bg-[var(--row-hover)]"
        >
          <p className={`font-display text-[30px] leading-none font-bold ${NUMBER_TONE[tile.tone]}`}>
            {tile.count}
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.35] font-semibold text-[var(--navy)]">{tile.label}</p>
          <p className="mt-1.5 text-[12px] leading-[1.45] text-[var(--secondary)]">{tile.note}</p>
        </Link>
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
          className="rounded-[4px] border border-[var(--border)] bg-white p-4"
        >
          <p className="text-[13.5px] font-semibold text-[var(--navy)]">{tile.label}</p>
          <p
            className={`mt-1.5 font-display text-[24px] leading-none font-bold ${
              isKnown(tile.value) ? "text-[var(--navy)]" : "text-[var(--secondary)]"
            }`}
          >
            {money(tile.value)}
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
      <div className="rounded-[4px] border border-dashed border-[var(--border)] px-5 py-8 text-center">
        <p className="text-[15px] font-semibold text-[var(--navy)]">Nothing needs you right now</p>
        <p className="mx-auto mt-2 max-w-[52ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          Overdue work, missing figures and expiring credentials appear here when they exist. An
          empty list means the checks ran and found nothing, not that nothing was checked.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item.label}>
          <Link
            href={item.href}
            className="block rounded-[4px] border border-[var(--border)] bg-white px-4 py-3 transition-colors hover:bg-[var(--canvas)]/50"
          >
            <p className="text-[13.5px] font-semibold text-[var(--navy)]">{item.label}</p>
            <p className="mt-1 max-w-[74ch] text-[13.5px] leading-[1.55] text-[var(--secondary)]">{item.detail}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
