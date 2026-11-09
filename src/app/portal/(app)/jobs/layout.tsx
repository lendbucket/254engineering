import { FieldAppWorker } from "@/components/portal/FieldAppWorker";
import { DayPackSync } from "@/components/portal/DayPackSync";

/**
 * The technician's jobs screens, the one place the field app's service worker
 * is registered (mobile phase 1, ruling 13 of 2026-10-27). The pages beneath
 * keep their own guards; this layout adds the registration, and the day pack
 * kept on the phone for offline start (Robert's T2, 2026-11-07), which asks the
 * server for the caller's own jobs and is refused for anybody else.
 */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FieldAppWorker />
      <DayPackSync />
      {children}
    </>
  );
}
