import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { Prose } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy | 254 Engineering Services",
  description:
    "How 254 Engineering Services collects, uses, and retains personal information submitted through this website, and the rights Texas residents have over it.",
  path: "/privacy",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Privacy", path: "/privacy" },
];

/**
 * The effective date is a constant, not a build timestamp.
 *
 * A policy whose date moves every time the site is redeployed tells a reader
 * nothing about when the terms last changed, which is the only thing the date is
 * for. Change it by hand when the document changes.
 */
const EFFECTIVE = "16 August 2026";

export default function PrivacyPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Legal"
        title="Privacy policy"
        lede={`How ${business.legalName} handles personal information submitted through this website. Effective ${EFFECTIVE}.`}
        crumbs={crumbs}
      />

      <section>
        <Container width="prose">
          <div className="py-14 sm:py-18">
            <Prose>
              <h2>Who this policy covers</h2>
              <p>
                This policy applies to {business.legalName}, a Texas limited liability company
                operating as {business.name}, and to information collected through{" "}
                {business.domain}. It does not cover any other website, including sites operated
                under affiliated brands, each of which publishes its own policy.
              </p>

              <h2>What is collected</h2>
              <p>
                Information you provide directly. The contact form, the waitlist form, and both
                careers application forms collect what you type into them. Depending on the form
                that includes your name, email address, telephone number, the city you are in, the
                service you are asking about, and whatever you write in the message field.
              </p>
              <p>
                The careers applications collect more, because the role requires it. The
                Professional Engineer application collects your Texas PE license number, your
                disciplines, whether you hold a windstorm inspection appointment from the Texas
                Department of Insurance, and your availability. The field inspection technician
                application collects the counties you are willing to serve, your work background,
                whether you hold an FAA Part 107 remote pilot certificate, and whether you have a
                reliable vehicle.
              </p>
              <p>
                Information collected automatically with a submission. When a form is submitted, the
                page it was submitted from, the referring page if your browser sent one, and your
                browser's user agent string are stored alongside it. That is used to understand
                which pages produce enquiries and to identify automated submissions.
              </p>
              <p>
                <strong>What is not collected.</strong> This site sets no advertising cookies, runs
                no third party advertising or social media tracking pixels, and does not build
                behavioral profiles of visitors. There is no account system, so no passwords are
                stored. Payment details are never collected through this website.
              </p>

              <h2>How it is used</h2>
              <ul>
                <li>To reply to an enquiry, and to carry on the correspondence it starts.</li>
                <li>
                  To contact people who joined the waitlist once firm registration with the Texas
                  Board of Professional Engineers and Land Surveyors is active.
                </li>
                <li>To evaluate applications for the two careers tracks and to contact applicants.</li>
                <li>
                  To maintain business records of enquiries and applications, and to meet the record
                  keeping obligations that apply to a professional engineering firm.
                </li>
                <li>To detect and discard automated form submissions.</li>
              </ul>
              <p>
                Information submitted through this site is not sold, rented, or traded. It is not
                shared with advertisers or data brokers, and it is not used to send marketing
                unrelated to what you contacted the firm about.
              </p>

              <h2>Where it is stored, and who can reach it</h2>
              <p>
                Form submissions are stored in a hosted PostgreSQL database operated by Supabase.
                Every table this site writes to has row level security enabled with no access
                policies, which means the database refuses read and write access to every client
                role. Access is possible only through a server side credential held by this firm,
                and there is no browser accessible database key anywhere in this website.
              </p>
              <p>
                Notification email is delivered by Resend. The website is hosted by Vercel, which
                records ordinary server request logs. Each of those providers processes information
                on this firm's behalf under their own terms.
              </p>
              <p>
                Within the firm, submissions are reachable by the people who need them to do the
                work: whoever replies to enquiries, and whoever reviews applications.
              </p>

              <h2>How long it is kept</h2>
              <ul>
                <li>
                  <strong>Enquiries and waitlist entries.</strong> Kept while they are useful for the
                  correspondence and for business records, and reviewed periodically. An entry is
                  deleted on request.
                </li>
                <li>
                  <strong>Applications.</strong> Kept for as long as the application is live plus a
                  reasonable period afterward, so that a candidate can be reconsidered when a
                  suitable role opens. Deleted on request.
                </li>
                <li>
                  <strong>Engineering records.</strong> Records relating to engineering work, once
                  the firm is performing it, are retained for the periods required of a registered
                  engineering firm in Texas. Those obligations sit above a deletion request, and this
                  policy does not promise otherwise.
                </li>
              </ul>

              <h2>Your rights</h2>
              <p>
                Texas residents have rights under the Texas Data Privacy and Security Act, including
                the right to confirm whether this firm processes your personal data, to access it, to
                correct inaccuracies, to obtain a copy in a portable format, and to have it deleted.
                You also have the right to opt out of sale of personal data and of targeted
                advertising. This firm does neither, so there is nothing to opt out of, and the
                right is stated here so that you know it exists rather than because it is being
                exercised.
              </p>
              <p>
                To make a request, email{" "}
                <a href={`mailto:${business.email}`}>{business.email}</a> and say what you want done.
                A response follows within the time the statute allows. If a request is declined you
                will be told why, and you may appeal that decision by replying to the same address;
                an appeal is answered in writing.
              </p>

              <h2>Children</h2>
              <p>
                This site is for business use and is not directed at children. Personal information
                is not knowingly collected from anyone under 18. If you believe a child has submitted
                information through this site, email the address above and it will be deleted.
              </p>

              <h2>Security, stated honestly</h2>
              <p>
                Data is transmitted over HTTPS, the database is closed to client access as described
                above, and credentials are held server side only. No system is perfectly secure, and
                a policy that promised otherwise would be making a claim nobody can keep. What this
                firm commits to is that the protections described here are actually in place, and
                that a breach affecting personal information will be notified as Texas law requires.
              </p>

              <h2>Changes to this policy</h2>
              <p>
                If this policy changes, the effective date at the top of the page changes with it.
                Material changes to how information already collected is used will be notified to
                the address it was collected with.
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
