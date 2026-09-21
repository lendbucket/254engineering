import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { WindstormInquiryForm } from "@/components/forms/WindstormInquiryForm";
import { Eyebrow, Rule } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { WINDSTORM_CERTIFIABLE_AFTER_YEAR } from "@/lib/windstorm-inquiry";

/**
 * ===========================================================================
 * THE WINDSTORM BRIEF, FOR AN EXISTING BUILDING.
 * Operator ruling, 2026-09-20. NOT IN THE SITEMAP AND NOT IN THE NAVIGATION.
 * ===========================================================================
 *
 * **This page is complete and is advertised to nobody.** The route
 * `/api/windstorm-inquiry` validates a brief and then refuses to accept it,
 * because `eng_windstorm_inquiries` does not exist yet and a migration on
 * `main` is never pending. The table waits for a sitting with the operator at
 * a keyboard.
 *
 * The operator's ruling on why it is built anyway, and why it is unlisted:
 * **the questions are settled and the persistence is not.** The engineer of
 * record answered what to ask on 2026-09-20; the table is where answers go.
 * Building the questions now is real work that does not need the migration.
 * Publishing a form the firm cannot answer is worse than not publishing one,
 * even with an honest message, so this is left out of `sitemap.ts`, out of the
 * navigation, and marked `noindex` until the table lands.
 *
 * WHAT THE SITTING TURNS ON, in one place so nobody has to reconstruct it:
 * add the migration, add `src/lib/ops-windstorm-inquiries.ts`, replace the
 * route's refusal with the insert, build `/portal/windstorm-inquiries` **with
 * its `roleFor` entry in the same commit**, add this path to `sitemap.ts`, link
 * it from the windstorm service page, and drop the `noindex` below.
 *
 * WHY IT IS A BRIEF RATHER THAN THE LEAD FORM. The same argument the design
 * brief makes about itself. New and ongoing construction is a defined
 * deliverable at a published price: a person says which and where, and the firm
 * knows what it is being asked for. An existing building is not. Whether it can
 * be certified at all turns on its age, on what is already covered up, and on
 * whether the openings meet the standard, and none of those survives a free
 * text message column where nothing can constrain them.
 */
export const metadata: Metadata = {
  ...buildMetadata({
    title: "Windstorm Certification for an Existing Building | 254 Engineering",
    description:
      "An existing building that was never certified is looked at one property at a time. Tell us when it was built, what is covered up, and what has been done.",
    path: "/windstorm-inquiry",
  }),
  /*
   * NOINDEX UNTIL IT CAN ACCEPT A BRIEF. A page that ranks and then refuses
   * every submission spends the firm's credibility to collect nothing, and the
   * person who found it has no way to know the form was never going to work.
   */
  robots: { index: false, follow: false },
};

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Windstorm WPI-8", path: "/services/windstorm-wpi-8" },
  { name: "Existing building", path: "/windstorm-inquiry" },
];

export default function WindstormInquiryPage() {
  return (
    <>
      <PageHeader
        crumbs={crumbs}
        eyebrow="Windstorm"
        title="An existing building that was never certified"
        lede="New and ongoing construction is inspected in sequence and carries a published price. A building that is already finished and covered is a different piece of work, and whether it can be certified at all is not knowable from a price list."
      />

      <Container>
        <div className="mx-auto max-w-[760px] pb-16">
          <Eyebrow>What decides it</Eyebrow>
          <Rule />
          <div className="mt-5 space-y-4 text-[0.98rem] leading-[1.7] text-slate-muted">
            <p>
              Three things, and the engineer of record is plain about all three. Only buildings
              constructed after {WINDSTORM_CERTIFIABLE_AFTER_YEAR} can be certified. The
              construction that would be inspected is already covered, so parts of it have to be
              opened up before anything can be verified. And where the doors and windows do not
              meet the opening protection standard, they may need replacing before a certification
              is possible at all.
            </p>
            <p>
              Any one of those can change what the work is, or end it. That is why this is scoped
              one property at a time and quoted after a conversation, and why the honest answer is
              sometimes that the building cannot be certified. You are better served hearing that
              in a reply than after a visit.
            </p>
          </div>

          <div className="mt-10">
            <Eyebrow>The brief</Eyebrow>
            <Rule />
            <p className="mt-5 mb-8 text-[0.98rem] leading-[1.7] text-slate-muted">
              Answer what you know. Where you do not know, say so: an unanswered question is worth
              more than a guess, because a guess about the year a building went up or what is behind
              the sheathing is the kind of thing that gets discovered on a roof.
            </p>
            <WindstormInquiryForm />
          </div>
        </div>
      </Container>
    </>
  );
}
