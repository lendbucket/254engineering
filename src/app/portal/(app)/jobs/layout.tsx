import { FieldAppWorker } from "@/components/portal/FieldAppWorker";

/**
 * The technician's jobs screens, the one place the field app's service worker
 * is registered (mobile phase 1, ruling 13 of 2026-10-27). The pages beneath
 * keep their own guards; this layout adds nothing but the registration.
 */
export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <FieldAppWorker />
      {children}
    </>
  );
}
