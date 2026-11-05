import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import OnboardingNotFound from "./not-found";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { findByToken, itemsFor } from "@/lib/onboarding";
import { checklistFor, firmItemLabels, ROLE_LABELS } from "@/content/onboarding-checklists";
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
 * still needs a valid 43 character token to see anything but the "not active"
 * page (a 404 until Q14 of 2026-11-02; see below).
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
  title: "Onboarding | 254 Engineering",
  /* Its own description rather than the home page's (site audit issue 12, 2026-11-02). */
  description: "The onboarding steps 254 Engineering sent to you, one link per person.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  /*
   * RENDERED HERE, NOT THROWN. Robert's ruling Q14 of 2026-11-02, from the live
   * site audit (issue #1, 6585009543, issue 10): /onboarding/not-a-real-token
   * answered 404 with an EMPTY server body, `<html id="__next_error__">`, and
   * the "not active" copy only inside the RSC payload, so a visitor without
   * JavaScript saw a blank page under the home page's title. notFound() thrown
   * from this page's shell takes Next's error recovery path
   * (node_modules/next/dist/server/app-render/app-render.js, getErrorRSCPayload),
   * which sends that empty shell and leaves the not-found UI to the client.
   * Returning the same component makes its copy part of the server HTML. The
   * response is then 200 with noindex, the way /order/[reference] already
   * answers a dead link; every failure still reads identically, which is the
   * property not-found.tsx exists for.
   */
  const onboarding = await findByToken(token);
  if (!onboarding) return <OnboardingNotFound />;

  // A completed onboarding is closed. The same page as an invalid token: there
  // is nothing left to do here and nothing to be gained by confirming it exists.
  if (onboarding.status === "complete") return <OnboardingNotFound />;

  const rows = await itemsFor(onboarding.id);
  const definitions = checklistFor(onboarding.role);

  // Only what this person is asked to do. Operator verified items are filtered
  // out here, on the server, rather than hidden in the component: an item that
  // never reaches the browser cannot be revealed by reading the page source.
  const personRows = rows.filter((r) => r.actor === "person");

  return (
    <>
      <section className="bg-slate-ink">
        <Container>
          <div className="max-w-3xl py-14 sm:py-20">
            <p className="font-sans text-[0.72rem] font-semibold tracking-[0.22em] text-brass-light uppercase">
              Onboarding
            </p>
            <span
              aria-hidden="true"
              className="mt-6 block h-px w-20 bg-brass"
            />
            <h1 className="font-display text-[2rem] leading-[1.1] font-bold text-slate-fg sm:text-[2.7rem]">
              Welcome, {onboarding.person_name.split(" ")[0]}
            </h1>
            <p className="mt-7 text-[1.05rem] leading-[1.75] text-slate-fg-muted">
              A few documents before your first assignment as a{" "}
              {ROLE_LABELS[onboarding.role]}. Each one saves the moment it
              uploads, so you can stop at any point and come back to this same
              link.
            </p>
            <p className="mt-6 text-[0.98rem] leading-[1.7] text-slate-fg-muted">
              You are never asked to type a social security, account, or routing
              number into this site. Tax and pay paperwork is completed in Gusto,
              not here, and no copy of an ID or an I-9 is kept on this site.
            </p>
          </div>
        </Container>
      </section>

      <OnboardingFlow
        token={token}
        role={onboarding.role}
        status={onboarding.status}
        firmItems={firmItemLabels(onboarding.role)}
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
      {/* The training courses, Robert's ruling P3 of 2026-11-01: a field technician graduates from both before enrollment. */}
      {onboarding.role === "field_tech" ? (
        <section className="border-b border-limestone-line">
          <Container>
            <div className="max-w-3xl py-12">
              <p className="text-[0.98rem] leading-[1.75] text-slate">
                Beside these documents there are two short training courses to finish before the firm can enroll you.{" "}
                <Link
                  href={`/onboarding/${token}/training`}
                  className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass-ink"
                >
                  Open your training courses
                </Link>
                .
              </p>
            </div>
          </Container>
        </section>
      ) : null}
      {/* The support contact. Inside the page rather than in a second footer:
          the root layout already renders one, and this needs to sit with the
          flow rather than under the site's regulatory band. */}
      <section className="border-b border-limestone-line bg-limestone-sunk">
        <Container>
          <div className="max-w-3xl py-12">
            <p className="text-[0.98rem] leading-[1.75] text-slate-muted">
              Something not working, or a document you cannot produce? Write to{" "}
              <a
                href={`mailto:${business.email}`}
                className="font-medium text-slate underline decoration-brass underline-offset-4 transition-colors hover:text-brass-ink"
              >
                {business.email}
              </a>{" "}
              and say what is in the way. Nothing here is a test.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}
