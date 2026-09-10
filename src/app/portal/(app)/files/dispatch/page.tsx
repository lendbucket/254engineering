import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { dispatchPlans } from "@/lib/ops-bulk-dispatch";
import { EmptyState, PageHead } from "@/components/portal/surfaces";
import { BulkDispatchClient } from "./BulkDispatchClient";

export const dynamic = "force-dynamic";

/**
 * Reviewing N dispatch plans before any offer goes out.
 *
 * Phase 12 Section 4, Section 1, operator ruling at gate 1. The Files screen
 * sends a selection here; this builds one plan per file, server side, through
 * the same dispatchContext the single file panel uses, and the dispatcher picks
 * per file.
 *
 * WHY THE PLANS ARE BUILT HERE AND NOT ASKED FOR BY THE BROWSER
 * --------------------------------------------------------------
 * A plan names which technicians may be offered the work and what each is
 * owed. A browser that could ask for a plan could ask for one about a file it
 * may not see, and the ids arrive from a query string. So the plans are built
 * on the server against the scoped read, and the browser receives only what the
 * actor was already allowed to know.
 */
export default async function BulkDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const actor = await currentActor();
  if (!actor) notFound();
  if (!can(actor, "offers.dispatch")) notFound();

  const params = await searchParams;
  const ids = (params.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const outcome = ids.length ? await dispatchPlans({ ...actor, email: actor.email }, ids) : null;

  return (
    <>
      <PageHead
        eyebrow="Work"
        title="Dispatch"
        lede="One plan per file, in the order you selected them. Nothing is preselected: the single file panel does not choose a technician for you and neither does this."
      />

      {!outcome ? (
        <EmptyState
          title="No files selected"
          body="Choose files on the Files screen and press Dispatch."
        />
      ) : !outcome.ok ? (
        <EmptyState title="That could not be reviewed" body={outcome.error} />
      ) : outcome.plans.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          body="None of the selected files came back. That happens when your role cannot see them, or when they no longer exist."
        />
      ) : (
        <>
          {/*
            ASKED FOR AGAINST RETURNED, the same rule the export follows. A file
            missing from a review screen reads as a file that was fine.
          */}
          {outcome.plans.length !== ids.length && (
            <p className="mb-4 rounded-[4px] border border-[var(--border)] bg-[var(--canvas)] p-3 text-[13px] text-[var(--secondary)]">
              {ids.length} file{ids.length === 1 ? "" : "s"} were selected and {outcome.plans.length} came
              back. A selected file is missing here when your role cannot see it, or when it no longer exists.
            </p>
          )}
          <BulkDispatchClient plans={outcome.plans} />
        </>
      )}

      <p className="mt-6">
        <Link href="/portal/files" className="text-[13.5px] font-semibold text-[var(--navy)] underline">
          Back to the files
        </Link>
      </p>
    </>
  );
}
