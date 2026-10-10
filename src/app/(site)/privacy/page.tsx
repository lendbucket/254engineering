import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { Prose } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";
import { VISITOR_TTL_DAYS } from "@/lib/ops-partners";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy and Texas Data Rights | 254 Engineering",
  description:
    "How this firm collects, uses, and retains personal information submitted through this website, and the rights Texas residents hold over it. Read the policy.",
  path: "/privacy",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Privacy", path: "/privacy" },
];

/**
 * ===========================================================================
 * DRAFT, AWAITING COUNSEL. Operator ruling, 2026-10-10 (gap 10 of the product
 * audit): the policy is rewritten against what the platform does, and this
 * branch is NOT merged until the operator's attorney has read it.
 * ===========================================================================
 *
 * The policy of 16 August 2026 described a site with no accounts, no payments
 * and a waitlist. It said "There is no account system, so no passwords are
 * stored", said nothing of the partner referral cookie or the session cookies,
 * and said engineering records would be kept "once the firm is performing it".
 * Each statement below was read against the code on 2026-10-10, and the
 * comment beside it names where. The legal framing is the attorney's to decide;
 * the facts are the code's.
 *
 * The effective date is a constant, not a build timestamp, and it is set when
 * counsel approves the text.
 */
const EFFECTIVE = "the date counsel approves this draft";

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        lede={`How ${business.legalName} handles personal information on this website and in its portals. Effective ${EFFECTIVE}.`}
        crumbs={crumbs}
      />

      <section>
        <Container width="prose">
          <div className="py-[clamp(48px,7vw,88px)]">
            <Prose>
              <h2>Who this policy covers</h2>
              <p>
                This policy applies to {business.legalName}, a Texas limited liability company
                operating as {business.name}, and to information collected through {business.domain},
                its customer account area, its partner portal and its staff portal. It also covers
                enquiries sent through the websites of its affiliated brands, Sealed Engineering and
                Stamp My Plans, because those enquiries are delivered to and stored by this firm.
              </p>

              <h2>What is collected</h2>
              {/* src/components/forms/LeadForm.tsx, src/components/careers/ApplicationFlow.tsx */}
              <p>
                <strong>Enquiries.</strong> The contact form, the design and windstorm briefs, and
                enquiries forwarded from the affiliated brands collect what you type: your name, email
                address, telephone number, the property or project, the service you are asking about,
                and your message.
              </p>
              {/* src/lib/ops-intake.ts, src/lib/payments-stripe.ts */}
              <p>
                <strong>Orders.</strong> An order records the property address and county, the
                service and deliverable, your name, email address and telephone number, the answers
                you give about the property, and the price. Card payments are taken on a checkout
                page hosted by Stripe. Your card number is entered on Stripe&apos;s page and is never
                received or stored by this firm; what this firm stores is the amount, whether the
                payment succeeded, and Stripe&apos;s reference for it, and the same for any refund.
              </p>
              {/* src/lib/customer-session.ts, src/lib/partner-session.ts, src/lib/ops-session.ts, src/lib/ops-mfa.ts */}
              <p>
                <strong>Accounts.</strong> Customers, referral partners and staff can hold an account.
                An account stores the email address, a name, and a password, which is kept by the
                authentication service as a one way hash and is never readable by this firm. Staff
                accounts may also hold a second factor, stored encrypted.
              </p>
              {/* the evidence bucket and eng_documents: 0002, 0061, 0062 */}
              <p>
                <strong>Work on a property.</strong> When an inspection is carried out, the technician
                records photographs, measurements and notes about the property, and the engineer
                records a determination and any letter that is sealed. These are kept in private
                storage that no public link reaches.
              </p>
              {/* src/components/careers/ApplicationFlow.tsx */}
              <p>
                <strong>Applications.</strong> The careers applications collect what the role
                requires: for the engineer seat, your Texas PE license number, disciplines and
                availability; for the technician seat, the counties you will serve, your background,
                and whether you hold a remote pilot certificate and a reliable vehicle.
              </p>
              {/* src/lib/ops-audit.ts, eng_audit_events */}
              <p>
                <strong>A record of actions.</strong> Signing in, and the actions taken in the
                portals, are recorded with the time, the account, the IP address and the browser&apos;s
                user agent. When a form is submitted, the page it came from and the referring page
                are stored with it.
              </p>

              <h2>Cookies</h2>
              {/* src/lib/ops-partners.ts VISITOR_COOKIE; the three session cookies */}
              <p>
                This website sets no advertising cookies and runs no advertising or social media
                tracking. It sets these:
              </p>
              <ul>
                <li>
                  A session cookie when you sign in to the customer area, the partner portal or the
                  staff portal, which keeps you signed in and ends when you sign out or it expires.
                </li>
                <li>
                  A referral cookie, <code>eng_ref</code>, when you arrive through a referral
                  partner&apos;s link. It holds a random key, not your name or email address, and it
                  lasts {VISITOR_TTL_DAYS} days, so that an order you place in that time can be
                  credited to the partner who referred you.
                </li>
              </ul>

              <h2>How it is used</h2>
              <ul>
                <li>To answer an enquiry and to carry on the correspondence it starts.</li>
                <li>To take, carry out, and deliver an order, and to take or refund its payment.</li>
                <li>To keep you signed in, and to keep accounts secure.</li>
                <li>To credit a referral partner for an order they referred.</li>
                <li>To evaluate applications and to contact applicants.</li>
                <li>
                  To keep the records a professional engineering firm keeps, and to detect and discard
                  automated submissions.
                </li>
              </ul>
              <p>
                Personal information is not sold, rented, or traded, and it is not shared with
                advertisers or data brokers.
              </p>

              <h2>Who processes it for the firm</h2>
              <p>
                Data is stored in a hosted PostgreSQL database and private file storage operated by
                Supabase. Email is delivered by Resend. Card payments are processed by Stripe. The
                website is hosted by Vercel, which keeps ordinary request logs. Each processes
                information on this firm&apos;s behalf under its own terms. A referral partner sees
                the orders credited to them, and not your name, email address, telephone number or
                property address.
              </p>

              <h2>How long it is kept</h2>
              {/* src/lib/retention-policy.ts */}
              <p>
                Enquiries and applications are kept while they are useful and deleted on request. The
                record of engineering work, of money, and of actions taken in the portals is kept
                permanently: the database refuses to delete it, because a sealed engineering
                document, a payment, and the trail of who did what have to be answerable years later.
                A deletion request removes what can be removed and says plainly what cannot.
              </p>

              <h2>Your rights</h2>
              <p>
                Texas residents have rights under the Texas Data Privacy and Security Act, including
                the right to confirm whether this firm processes your personal data, to access it, to
                correct it, to obtain a copy, and to have it deleted, subject to the records above
                that the firm must keep. This firm does not sell personal data or use it for targeted
                advertising. To make a request, email{" "}
                <a href={`mailto:${business.email}`}>{business.email}</a>. A response follows within
                the time the statute allows; if a request is declined you will be told why, and you
                may appeal by replying to the same address.
              </p>

              <h2>Children</h2>
              <p>
                This website is for business use and is not directed at children. Personal
                information is not knowingly collected from anyone under 18.
              </p>

              <h2>Security, stated honestly</h2>
              <p>
                Data is transmitted over HTTPS, the database refuses access to every browser, and its
                credentials are held on the server only. No system is perfectly secure. What this
                firm commits to is that the protections described here are in place, and that a
                breach affecting personal information is notified as Texas law requires.
              </p>

              <h2>Changes to this policy</h2>
              <p>
                When this policy changes, the effective date at the top changes with it.
              </p>

              <h2>Contact</h2>
              <p>
                {business.legalName}
                <br />
                Texas, United States
                <br />
                <a href={`mailto:${business.email}`}>{business.email}</a>
              </p>
              <p>
                See also the <Link href="/terms">terms of use</Link> for this website.
              </p>
            </Prose>
          </div>
        </Container>
      </section>
    </>
  );
}
