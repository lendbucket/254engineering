import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can } from "@/lib/ops-authz";
import { awaitingVerification } from "@/lib/ops-credential-submissions";
import { calendarDateLabel, firmDateLabel } from "@/lib/firm-calendar";
import { EmptyState, ErrorState, PageHead, Panel } from "@/components/portal/surfaces";
import { VerificationQueue } from "../techs/VerificationQueue";

export const dynamic = "force-dynamic";

/**
 * CREDENTIAL REVIEW, WITHOUT THE PAY LEDGER. technicians.onboard, 2026-10-20.
 *
 * The verification queue already lives on /portal/techs, and that screen also
 * carries every technician's pay, which neither staff level may see. So the
 * queue is here on its own, the same component and the same read. The verify
 * and reject actions behind it check technicians.onboard against the
 * credential owner being a field technician.
 */
export default async function CredentialsPage() {
  const actor = await currentActor();
  if (!actor || !can(actor, "technicians.onboard")) notFound();
  const queue = await awaitingVerification();

  return (
    <>
      <PageHead
        eyebrow="People"
        title="Credential review"
        lede="Credentials field technicians submitted themselves: the type, the issuing state and the expiry. Dispatch counts none of them until one is verified here."
        actions={
          <Link href="/portal/onboarding" className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--navy)] underline">
            Onboarding
          </Link>
        }
      />
      <Panel title={`Awaiting verification${queue && queue.length ? ` (${queue.length})` : ""}`}>
        {queue === null ? (
          <ErrorState title="The submissions could not be read" body="This is not an empty queue. Reload in a minute; if it persists, tell an administrator." />
        ) : queue.length === 0 ? (
          <EmptyState
            title="Nothing is waiting"
            body="When a technician submits a credential from their own screen, it appears here to be checked against the document they hold."
          />
        ) : (
          <VerificationQueue
            rows={queue.map((s) => ({
              id: s.id,
              name: s.name,
              label: s.label,
              detail: [s.issuingState ? `Issued in ${s.issuingState}` : null, s.expiresOn ? `expires ${calendarDateLabel(s.expiresOn)}` : "no expiry"]
                .filter(Boolean)
                .join(", "),
              submitted: firmDateLabel(s.submittedAt) ?? "on an unrecorded date",
            }))}
          />
        )}
      </Panel>
    </>
  );
}
