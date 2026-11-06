import "server-only";
import { requestContext } from "./ops-auth";
import { writeAuditOrRefuse } from "./ops-audit";
import type { Actor } from "./ops-authz";

/**
 * THE RECORD OF AN EXPORT IS WRITTEN BEFORE THE FILE IS MADE, OR THE FILE IS NOT
 * MADE. Office audit F14 and F20, 2026-11-02 (issue #1 comment 6585009173), low
 * findings built under Robert's ruling of the same day.
 *
 * Four CSV routes handed out names, emails, phones, addresses and prices and
 * recorded nothing, and api/portal/exports recorded with writeAudit, which logs
 * and carries on when the write fails, so "every export is audited" was usual
 * rather than true. A person taking the firm's records off the platform is an
 * event worth being able to reconstruct later, so the audit row goes first
 * through writeAuditOrRefuse and a failed write refuses the export.
 *
 * Returns null when the row is written, or the sentence to refuse with.
 */
export async function auditExportOrRefuse(
  actor: Actor,
  action: string,
  summary: string,
  entityId: string | null = null,
): Promise<string | null> {
  const context = await requestContext();
  const written = await writeAuditOrRefuse({
    actor,
    action,
    entityType: "export",
    entityId,
    summary,
    ...context,
  });
  return written.ok ? null : `${written.error} No file was made.`;
}
