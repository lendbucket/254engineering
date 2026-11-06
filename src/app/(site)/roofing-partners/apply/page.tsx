import type { Metadata } from "next";
import { PageHeader } from "@/components/site/PageHeader";
import { RooferSignUpForm } from "@/components/forms/RooferSignUpForm";
import { ButtonLink } from "@/components/ui/primitives";
import { Callout } from "@/components/ui/section";
import { Container } from "@/components/ui/Container";
import { business } from "@/config/business";
import { displayPhone, founder, telHref } from "@/config/contact";
import { BOOK_A_CALL_URL } from "@/content/book-a-call";
import { selfServiceSignUpClosedSentence, selfServiceSignUpOpen } from "@/lib/launch";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { buildMetadata } from "@/lib/seo";

/**
 * STEP ONE: CREATE YOUR PARTNER ACCOUNT. Robert's rework of 2026-11-06.
 *
 * It read like a job application and asked everything before giving anything.
 * Now it asks four things and opens the account; the email link sets the
 * password and signs them in, and the work, insurance and references are a
 * checklist inside the account that blocks nothing. A supplier opening an
 * account, in the words on the page and on the button.
 *
 * The side box is something useful rather than a name: Robert's phone as a
 * tap to call link, his email, and the booking link.
 */
export const metadata: Metadata = buildMetadata({
  title: "Create Your Roofing Partner Account | 254 Engineering",
  description:
    "Open a roofing partner account in four answers: company, owner, email and phone. Finish your profile inside, and the firm approves every partner. Start today.",
  path: "/roofing-partners/apply",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Roofing partners", path: "/roofing-partners" },
  { name: "Create your account", path: "/roofing-partners/apply" },
];

export default function RooferSignUpPage() {
  const phone = displayPhone();
  const tel = telHref();
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <PageHeader
        crumbs={crumbs}
        eyebrow="Roofing partners"
        title="Create your partner account"
        lede="Four answers and your account is open. Finish your profile inside it whenever you are ready."
      />
      <section className="bg-limestone">
        <Container>
          <div className="grid gap-8 py-[clamp(36px,6vw,72px)] lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-[4px] border border-limestone-line border-t-4 border-t-brass bg-white p-[clamp(20px,3vw,36px)]">
              {/* Door 1's own condition (0043, cleared 2026-09-28): the form shows only while public sign up is open, as /account/sign-up does. */}
              {selfServiceSignUpOpen() ? (
                <RooferSignUpForm />
              ) : (
                <p role="status" className="text-[16px] leading-[1.7] text-slate-ink">
                  {selfServiceSignUpClosedSentence()} To talk about a partner account in the meantime, call or email{" "}
                  {founder.name}.
                </p>
              )}
            </div>
            <aside className="flex flex-col gap-5 lg:pt-2">
              <Callout label="Talk to a person" title={founder.name}>
                {phone && tel ? (
                  <>
                    Call{" "}
                    <a href={tel} className="font-semibold whitespace-nowrap text-slate underline">
                      {phone}
                    </a>
                    , or email{" "}
                  </>
                ) : (
                  <>Email </>
                )}
                <a href={`mailto:${business.email}`} className="font-semibold text-slate underline">
                  {business.email}
                </a>
                .
                <span className="mt-4 block">
                  <ButtonLink href={BOOK_A_CALL_URL} tone="secondary" newTab>
                    Book a call
                  </ButtonLink>
                </span>
              </Callout>
              <Callout label="Inside your account" title="Finish your profile">
                Your work, your general liability cover with its certificate, and two references. Each part saves on its
                own, and none of it stops you signing in.
              </Callout>
            </aside>
          </div>
        </Container>
      </section>
    </>
  );
}
