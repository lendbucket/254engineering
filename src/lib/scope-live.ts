import "server-only";
import { SCOPE_PENDING } from "@data/catalog";
import { business } from "@/config/business";
import { SIGNABLE_PROTOCOLS } from "@/content/protocols/signable";
import { signatureStatus } from "./protocol-sign";
import { resolveDeliverable } from "./scope-quote";
import { captureError, ENVIRONMENT } from "./ops-observability";
import { queueEmail } from "./ops-jobs";
import { scopeReadFailedAlert } from "./email-templates";

/**
 * A SERVICE PAGE'S DELIVERABLE, AS THE SIGNED RECORD STANDS WHEN THE PAGE IS
 * RENDERED. Robert, 17:31 Central 2026-10-31 (queue item 15), amended at 18:04.
 *
 * /services/[slug] and /llms-full.txt are prerendered, so this runs at build
 * and again when the jobs cron revalidates a page after a void
 * (scope-revalidate.ts), never on a public view. What it shows is decided by
 * resolveDeliverable (scope-quote.ts):
 *
 *   - a live signature on one of the protocol's offered versions: the quote;
 *   - a successful read finding it voided or unsigned: SCOPE_PENDING;
 *   - a failed read: the quote, as the code's in-force record has it, plus an
 *     error event and an office alert naming the page.
 *
 * WHAT IT DOES NOT DO. It decides nothing about whether the line can be
 * ordered; the order flow and the money door read that themselves and close on
 * an unknown (line-gate.ts, ruling 11). And a placed order keeps the scope it
 * was bought under: the order page and its emails read the catalogue, not this.
 */
export async function deliverableAsSigned(deliverable: readonly string[], page: string): Promise<string[]> {
  const outcome = await resolveDeliverable(
    deliverable,
    (documentNumber) =>
      Promise.all(
        SIGNABLE_PROTOCOLS.filter((p) => p.documentNumber === documentNumber).map((p) =>
          signatureStatus(documentNumber, p.version),
        ),
      ),
    SCOPE_PENDING,
  );
  if (outcome.failed) await reportFailedRead(page, outcome.failed.documentNumber, outcome.failed.why);
  return outcome.deliverable;
}

/*
 * The error event and the office alert. Neither may stop the page rendering:
 * each is attempted on its own and a failure to record is logged, because the
 * page showing the code's record is the ruled answer whatever happens here.
 */
async function reportFailedRead(page: string, documentNumber: string, why: string): Promise<void> {
  const message = `The signature read for ${page} (${documentNumber}) failed, so the page shows the code's in-force scope: ${why}`;
  try {
    await captureError(new Error(message), { kind: "scope-read", route: page, level: "error", extra: { documentNumber } });
  } catch (err) {
    console.error(`[scope-live] the error event was not recorded: ${err instanceof Error ? err.message : String(err)}`);
  }
  try {
    const queued = await queueEmail(
      scopeReadFailedAlert({
        page,
        documentNumber,
        why,
        pageUrl: `${business.url}${page}`,
        environment: ENVIRONMENT,
      }),
    );
    if (!queued.ok) console.error(`[scope-live] the office alert for ${page} was not queued: ${queued.error}`);
  } catch (err) {
    console.error(`[scope-live] the office alert for ${page} was not queued: ${err instanceof Error ? err.message : String(err)}`);
  }
}
