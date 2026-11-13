import Link from "next/link";
import { Eyebrow } from "@/components/ui/primitives";
import type { Insight } from "@/content/insights";

/**
 * One post as an index lists it: eyebrow, title, summary, date and sources.
 * Shared by the insights hub and each section page, so the two cannot drift.
 */

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function InsightEntry({ post, heading = "h2" }: { post: Insight; heading?: "h2" | "h3" }) {
  const H = heading;
  return (
    <li className="py-9">
      <Eyebrow>{post.eyebrow}</Eyebrow>
      <H className="mt-3 text-[1.4rem] leading-[1.3] font-semibold text-slate sm:text-[1.6rem]">
        <Link href={`/insights/${post.slug}`} className="transition-colors hover:text-brass-ink">
          {post.h1}
        </Link>
      </H>
      <p className="mt-4 text-[1.01rem] leading-[1.72] text-slate-muted">{post.summary}</p>
      <p className="mt-4 font-sans text-[0.85rem] text-slate-muted">
        <time dateTime={post.datePublished}>{longDate(post.datePublished)}</time>
        <span aria-hidden="true" className="px-2">
          /
        </span>
        {post.sources.length} primary sources cited
      </p>
    </li>
  );
}
