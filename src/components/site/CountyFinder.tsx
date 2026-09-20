"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/**
 * FIND ONE COUNTY, RATHER THAN SCROLL PAST 254.
 *
 * Operator ruling, 2026-09-18, after the board started measuring rendered
 * height and /coverage came back at 19,241px, which is 22.8 phone screens and
 * the only page over its ceiling.
 *
 * His reasoning, and it is a better argument than the ceiling was: "254 counties
 * is inherent length only if the page has to list all 254 at once, and it does
 * not. A reader is looking for one county." He refused an exemption and asked
 * for the reader-first version first.
 *
 * SO THE DEFAULT STATE SHOWS NO LIST AT ALL. The region groups above this
 * component are the answer for somebody browsing; this is the answer for
 * somebody who knows their county and wants to know which region it is in and
 * whether it is covered. Typing three letters answers that in one screen
 * instead of twelve.
 *
 * THE FULL LIST IS STILL REACHABLE AND STILL COMPLETE, behind one control,
 * because the page's own claim is that all 254 are covered and a claim whose
 * evidence is hidden from everybody is a weaker claim. It is one tap, and the
 * tap is what keeps the page inside its ceiling.
 *
 * WHY A CLIENT COMPONENT WHEN ALMOST NOTHING ELSE HERE IS ONE. Filtering 254
 * strings is the one interaction on this site that genuinely cannot be done on
 * the server without a round trip per keystroke, and a round trip per keystroke
 * to filter a list that fits in four kilobytes would be worse in every way.
 */
export type FinderCounty = {
  name: string;
  regionName: string;
  regionSlug: string;
};

export function CountyFinder({ counties }: { counties: FinderCounty[] }) {
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (trimmed.length === 0) return [];
    return counties.filter((c) => c.name.toLowerCase().includes(trimmed));
  }, [counties, trimmed]);

  const visible = matches;

  return (
    <div className="mt-9">
      <label htmlFor="county-finder" className="block text-[0.94rem] font-semibold text-slate">
        Find your county
      </label>
      <input
        id="county-finder"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Start typing a county name"
        autoComplete="off"
        /*
         * 16px minimum on the font size, which is not a style preference: iOS
         * zooms the viewport on focus for anything smaller, and a page that
         * zooms when you tap the search box is a page that then scrolls
         * sideways, which is the thing the sibling audit exists to prevent.
         */
        className="mt-2.5 block min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-4 text-[16px] text-slate placeholder:text-slate-muted focus:border-brass focus:outline-none"
      />

      {/*
        THE FULL LIST IS NOT THIS COMPONENT'S JOB, AND THAT IS A CORRECTION.
        The first version carried a "show all" button here, which would have put
        all 254 rows behind client state and therefore out of the server
        rendered HTML entirely.
        `coverage-audit` asserts the hub lists every one of the 254 in its
        VISIBLE TEXT, and it is right to: the page's whole claim is that all 254
        are covered, and a claim whose evidence exists only after JavaScript
        runs is a weaker claim. Hiding them that way would have broken a real
        check for a real reason and looked like a layout decision.
        So the list stays server rendered inside a native disclosure on the page
        itself. A collapsed `details` element does not lay its content out, so
        it costs nothing in height, it needs no JavaScript, and every county is
        in the document either way. This component does the one thing that
        genuinely needs a client: searching.
      */}
      <p aria-live="polite" className="mt-3 text-[0.88rem] text-slate-muted">
        {trimmed.length > 0
          ? `${matches.length} of ${counties.length} match "${query.trim()}"`
          : `${counties.length} counties, grouped by region above and listed in full below`}
      </p>

      {trimmed.length > 0 && matches.length === 0 ? (
        <p className="mt-6 text-[0.95rem] leading-[1.7] text-slate-muted">
          No Texas county matches that. Every one of the {counties.length} is covered, so if you are
          sure of the name it is worth checking the spelling.
        </p>
      ) : null}

      {visible.length > 0 ? (
        <ul className="mt-6 grid gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((county) => (
            <li
              key={county.name}
              className="flex items-center justify-between gap-3 border-b border-limestone-line"
            >
              <span className="py-2.5 text-[0.94rem] text-slate">{county.name}</span>
              {/* The padding is on the link rather than the row, so the region
                  name is a 44px tall target instead of a 19px one. */}
              <Link
                href={`/coverage/${county.regionSlug}`}
                className="flex min-h-[44px] shrink-0 items-center font-sans text-[0.8rem] text-slate-muted underline decoration-limestone-line underline-offset-4 transition-colors hover:text-slate hover:decoration-brass"
              >
                {county.regionName}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
