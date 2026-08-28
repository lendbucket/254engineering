import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-data";
import { getOnboarding, itemsFor } from "@/lib/onboarding";
import { getVerification } from "@/lib/admin-onboarding";
import { signedOnboardingUrl } from "@/lib/onboarding-uploads";
import { AdminShell, Chip, Panel } from "@/components/admin/shell";
import { ReviewControls } from "./ReviewControls";

export const dynamic = "force-dynamic";

/**
 * One onboarding, reviewed.
 *
 * DOCUMENT LINKS ARE MINTED HERE, NOT STORED
 * ------------------------------------------
 * eng-onboarding is private and these are identity documents. A signed URL is
 * generated at render time and lives ten minutes, so a link that leaks from a
 * browser history or a shoulder is dead by the time anybody uses it. The page is
 * force-dynamic so a cached render can never serve one operator's signatures to
 * the next request.
 *
 * This is also why no document URL travels in the submitted notification email:
 * that message carries a link to this page, and the page mints the signature
 * once somebody has proved they are signed in.
 */
export default async function OnboardingDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const record = await getOnboarding(id);
  if (!record) notFound();

  const items = await itemsFor(id);
  const verification = await getVerification(id);

  const withUrls = await Promise.all(
    items.map(async (item) => ({
      ...item,
      url: item.storage_key ? await signedOnboardingUrl(item.storage_key) : null,
    })),
  );

  return (
    <AdminShell
      title={record.person_name}
      lede={`${record.role === "engineer" ? "Professional Engineer" : "Field Inspection Technician"}. Invited ${new Date(record.invited_at).toDateString()}. Document links expire ten minutes after this page loaded.`}
    >
      <div className="grid gap-[18px] lg:grid-cols-3">
        <Panel title="Person" className="lg:col-span-1">
          <dl className="space-y-3 text-[14.5px]">
            {[
              ["Email", record.email],
              ["Phone", record.phone ?? "Not given"],
              ["Status", record.status],
              ["Submitted", record.submitted_at ? new Date(record.submitted_at).toDateString() : "Not yet"],
              ["Notes", record.notes ?? "None"],
            ].map(([term, value]) => (
              <div key={term}>
                <dt className="text-[11.5px] font-bold tracking-[0.1em] text-brass-ink uppercase">
                  {term}
                </dt>
                <dd className="mt-1 break-words text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <div className="lg:col-span-2">
          <ReviewControls
            onboardingId={id}
            status={record.status}
            identityVerifiedAt={verification.identity_verified_at}
            i9ExaminedAt={verification.i9_examined_at}
            items={withUrls.map((i) => ({
              itemKey: i.item_key,
              label: i.label,
              status: i.status,
              url: i.url,
              rejectedReason: i.rejected_reason,
            }))}
          />
        </div>
      </div>

      <Panel title="Checklist state" className="mt-[18px]">
        <ul className="space-y-2">
          {withUrls.map((i) => (
            <li key={i.item_key} className="flex flex-wrap items-center gap-3 text-[14.5px]">
              <Chip status={i.status} />
              <span className="font-semibold text-slate">{i.label}</span>
              {i.rejected_reason ? (
                <span className="text-slate-muted">Reason: {i.rejected_reason}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </Panel>
    </AdminShell>
  );
}
