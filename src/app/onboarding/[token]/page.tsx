import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Wordmark } from "@/components/brand/Wordmark";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { findByToken, itemsFor } from "@/lib/onboarding";
import { checklistFor, ROLE_LABELS } from "@/content/onboarding-checklists";
import { business } from "@/config/business";

/**
 * The invite flow.
 *
 * NOT STATIC, NOT INDEXED, NOT IN THE SITEMAP
 * -------------------------------------------
 * `dynamic = "force-dynamic"` because the page is a function of a credential
 * that must be checked on every request. A cached render of this route would be
 * one person's checklist served to whoever asked next.
 *
 * The robots metadata is belt and braces. The route is also disallowed in
 * robots.txt and absent from the sitemap, so all three signals agree, and none
 * of them is what actually protects it: a crawler that ignored every one of them
 * still needs a valid 43 character token to see anything but a 404.
 *
 * WHY THE READ HAPPENS HERE AND NOT IN AN API ROUTE
 * -------------------------------------------------
 * The checklist is fetched server side and passed down as props. There is no
 * endpoint that returns an onboarding, because an endpoint is a thing that can
 * be called with somebody else's identifier. The only way to see this data is to
 * render this page with a token that resolves to it.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Onboarding | 254 Engineering Services",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const onboarding = await findByToken(token);
  if (!onboarding) notFound();

  // A completed onboarding is closed. Same 404 as an invalid token: there is
  // nothing left to do here and nothing to be gained by confirming it exists.
  if (onboarding.status === "complete") notFound();

  const rows = await itemsFor(onboarding.id);
  const definitions = checklistFor(onboarding.role);

  // Only what this person is asked to do. Operator verified items are filtered
  // out here, on the server, rather than hidden in the component: an item that
  // never reaches the browser cannot be revealed by reading the page source.
  const personRows = rows.filter((r) => r.actor === "person");

  return (
    <div className="flex min-h-screen flex-col bg-limestone">
      <header className="bg-slate-ink">
        <Container>
          <div className="flex items-center justify-between py-6">
            <Wordmark onDark />
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.2em] text-brass-light uppercase">
              Onboarding
            </p>
          </div>
        </Container>
        <div aria-hidden="true" className="h-px bg-brass" />
      </header>

      <main className="flex-1">
        <section className="bg-slate-ink">
          <Container>
            <div className="max-w-3xl py-14 sm:py-20">
              <h1 className="font-display text-[2rem] leading-[1.1] font-bold text-slate-fg sm:text-[2.7rem]">
                Welcome, {onboarding.person_name.split(" ")[0]}
              </h1>
              <p className="mt-7 text-[1.05rem] leading-[1.75] text-slate-fg-muted">
                A few documents before your first assignment as a{" "}
                {ROLE_LABELS[onboarding.role]}. Each one saves the moment it uploads, so you can
                stop at any point and come back to this same link.
              </p>
              <p className="mt-6 text-[0.98rem] leading-[1.7] text-slate-fg-muted">
                You are never asked to type a social security, account, or routing number into this
                site. Where a form involves one, you upload the completed document and nothing is
                read out of it.
              </p>
            </div>
          </Container>
        </section>

        <OnboardingFlow
          token={token}
          role={onboarding.role}
          status={onboarding.status}
          items={personRows.map((r) => ({
            key: r.item_key,
            label: r.label,
            status: r.status,
            rejectedReason: r.rejected_reason,
          }))}
          definitions={definitions
            .filter((d) => d.actor === "person")
            .map((d) => ({
              key: d.key,
              label: d.label,
              help: d.help,
              step: d.step,
              reference: d.reference,
              fields: d.fields,
              acknowledgeOnly: d.acknowledgeOnly,
            }))}
        />
      </main>

      <footer className="bg-slate-ink">
        <Container>
          <div className="py-10">
            <p className="text-[0.92rem] leading-[1.7] text-slate-fg-muted">
              Something not working, or a document you cannot produce? Write to{" "}
              <a
                href={`mailto:${business.email}`}
                className="font-medium text-slate-fg underline decoration-brass underline-offset-4 transition-colors hover:text-brass-light"
              >
                {business.email}
              </a>{" "}
              and say what is in the way. Nothing here is a test.
            </p>
          </div>
        </Container>
      </footer>
    </div>
  );
}
