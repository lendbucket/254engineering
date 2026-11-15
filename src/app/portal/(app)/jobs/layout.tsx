import { FieldAppWorker } from "@/components/portal/FieldAppWorker";
import { DayPackSync } from "@/components/portal/DayPackSync";
import { currentActor } from "@/lib/ops-auth";
import { carriesDayPack } from "@/lib/ops-field";

/**
 * The technician's jobs screens, the one place the field app's service worker
 * is registered (mobile phase 1, ruling 13 of 2026-10-27). The pages beneath
 * keep their own guards; this layout adds the registration, and the day pack
 * kept on the phone for offline start (Robert's T2, 2026-11-07), which asks the
 * server for the caller's own jobs.
 *
 * THE DAY PACK IS MOUNTED ONLY FOR WHOEVER THE SERVER WILL GIVE ONE TO
 * (carriesDayPack, the server's own test). The every-role walk of 2026-11-14
 * found the administrator's My jobs asking on every load and logging a 400.
 */
export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  const actor = await currentActor();
  return (
    <>
      <FieldAppWorker />
      {carriesDayPack(actor) ? <DayPackSync /> : null}
      {children}
    </>
  );
}
