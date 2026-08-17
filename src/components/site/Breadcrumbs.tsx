import Link from "next/link";
import type { Crumb } from "@/lib/schema";

/**
 * The visible breadcrumb trail.
 *
 * Paired with BreadcrumbList schema on every page that renders it, and the same
 * array feeds both, so the trail a person sees and the trail a crawler reads
 * cannot describe different hierarchies. That divergence is a common and
 * completely invisible SEO defect: markup that claims a nesting the navigation
 * does not have.
 *
 * The current page is the last crumb and is not a link. Linking a page to itself
 * is a dead control that assistive technology still announces as a link.
 */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-[0.82rem] text-slate-muted">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-slate">
                  {crumb.name}
                </span>
              ) : (
                <>
                  <Link href={crumb.path} className="transition-colors hover:text-slate">
                    {crumb.name}
                  </Link>
                  <span aria-hidden="true" className="text-limestone-line">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
