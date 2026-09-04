import { PrimaryButton, SecondaryButton } from "@/components/portal/design";

/**
 * The portal's not found, which is also its refusal.
 *
 * THIS SCREEN CARRIES TWO MEANINGS AND MUST NOT DISTINGUISH THEM
 * --------------------------------------------------------------
 * Every gated route in this portal answers notFound() when a role may not see
 * it, so this page renders for two different situations: a route that genuinely
 * does not exist, and a route that exists and is not yours. security-audit
 * asserts those two are indistinguishable from outside, and the operator ruled
 * at gate 0 that the prototype's 403 is dropped for exactly this reason. A
 * screen saying "you do not have permission to view this" confirms the page
 * exists to somebody who should not know it does.
 *
 * The copy below is therefore written to be true of both. It lists what could
 * be the case without asserting which, which is the same shape as the
 * prototype's own 404 copy and is honest rather than evasive: those really are
 * the possibilities, and the platform really does not intend to say more.
 *
 * The 403's visual treatment is carried here, so nothing about the design work
 * is lost even though the screen is not.
 */
export default function PortalNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-[var(--page-gutter)] py-10">
      <div className="w-full max-w-[520px] rounded-[var(--radius-card)] border border-[var(--border)] bg-white px-6 py-8 text-center sm:px-8">
        <p className="portal-column-header">Not found</p>

        <h1 className="mt-2 font-display text-[17px] leading-[1.3] font-bold text-[var(--navy)]">
          That page is not here
        </h1>

        <p className="mx-auto mt-3 max-w-[46ch] text-[13.5px] leading-[1.6] text-[var(--secondary)]">
          It does not exist, it was moved or merged into another record, the link is stale, or it is
          not available to your role. Search finds files by address, client, or reference.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <PrimaryButton href="/portal">Back to the dashboard</PrimaryButton>
          <SecondaryButton href="/portal/files">Search files</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
