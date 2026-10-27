"use client";

import { useState } from "react";
import type { WindstormCountyAnswer } from "@/content/windstorm-county-tool";

/**
 * PICK A COUNTY, READ THE ANSWER. Every answer is computed on the server by
 * windstormCountyAnswer() and arrives here as data, so this component decides
 * nothing: it shows the one answer for the county chosen.
 *
 * A native select rather than a search box, because the set is closed and
 * exact: 254 names, each answered, with no partial match to explain. 16px
 * text and a 48px control for the same reasons CountyFinder gives.
 */
export function WindstormCountyCheck({
  answers,
  source,
}: {
  answers: WindstormCountyAnswer[];
  source: { url: string; checked: string };
}) {
  const [county, setCounty] = useState("");
  const answer = answers.find((a) => a.county === county) ?? null;

  return (
    <div className="mt-8 max-w-[68ch]">
      <label htmlFor="windstorm-county" className="block text-[0.94rem] font-semibold text-slate">
        County
      </label>
      <select
        id="windstorm-county"
        value={county}
        onChange={(e) => setCounty(e.target.value)}
        className="mt-2.5 block min-h-[48px] w-full rounded-[3px] border border-limestone-line bg-white px-4 text-[16px] text-slate focus:border-brass focus:outline-none"
      >
        <option value="">Choose a county</option>
        {answers.map((a) => (
          <option key={a.county} value={a.county}>
            {a.county}
          </option>
        ))}
      </select>

      <div aria-live="polite">
        {answer ? (
          <p className="mt-6 text-[1.02rem] leading-[1.75] text-slate" data-windstorm-status={answer.status}>
            {answer.text}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-[0.9rem] leading-[1.7] text-slate-muted">
        The list is the Texas Department of Insurance&apos;s, read on {source.checked} from{" "}
        <a href={source.url} className="underline underline-offset-4" rel="noopener">
          its windstorm questions page
        </a>
        . The department&apos;s page is the authority if the two ever differ.
      </p>
    </div>
  );
}
