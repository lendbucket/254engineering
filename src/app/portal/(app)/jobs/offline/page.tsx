import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { OfflineDay } from "./OfflineDay";

export const dynamic = "force-dynamic";

/**
 * THE JOB WITH NO SIGNAL. Robert's T2, 2026-11-07: "The assigned technician
 * opens the checklist and captures photos with no signal."
 *
 * This page renders nothing from the database. It is fetched while there is
 * signal (src/components/portal/DayPackSync.tsx) so the field service worker
 * holds a copy, and the worker shows that copy in place of any jobs screen that
 * cannot be reached (src/app/field-sw.js/route.ts). What it shows comes from the
 * day pack the phone already holds (src/lib/field-day-store.ts), and only when
 * that pack belongs to the technician this page was rendered for.
 *
 * Captures made here go into the same queue the job page uses and upload when
 * signal returns. Submitting needs signal, which the screen says.
 *
 * Not in the navigation: nobody chooses this screen. The worker shows it when
 * the network cannot.
 */
export default async function OfflineJobsPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "offers.list_own")) notFound();
  return <OfflineDay techId={actor.id} />;
}
