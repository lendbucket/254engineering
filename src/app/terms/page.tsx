import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { Prose } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { business } from "@/config/business";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Use and Site Conditions | 254 Engineering",
  description:
    "The terms governing use of this website, what it is and is not, how an engagement is formed, and the limits on everything published here. Read the terms.",
  path: "/terms",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Terms", path: "/terms" },
];

const EFFECTIVE = "16 August 2026";

export default function TermsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Legal"
        title="Terms of use"
        lede={`The terms governing use of ${business.domain}. Effective ${EFFECTIVE}.`}
        crumbs={crumbs}
      />

      <section>
        <Container width="prose">
          <div className="py-14 sm:py-18">
            <Prose>
              <h2>Agreement to these terms</h2>
              <p>
                This website is operated by {business.legalName}, a Texas limited liability company
                operating as {business.name}. By using it you agree to these terms. If you do not
                agree with them, do not use the site.
              </p>

              <h2>What this website is</h2>
              <p>
                This site describes the firm, the services it is built to deliver, and the geography
                it covers. It is general information about engineering services in Texas.
              </p>
              <p>
                <strong>It is not engineering advice.</strong> Nothing on this website is a
                professional engineering opinion, a recommendation about a specific structure, or a
                substitute for an inspection of a particular property by a licensed engineer.
                Conditions vary by site in ways that general information cannot account for, and the
                pages describing soils, wind, and permitting across Texas are written to explain how
                the work differs by region, not to tell you what is true at your address.
              </p>
              <p>
                <strong>No engineer and client relationship is created by this website.</strong>{" "}
                Reading these pages, submitting a form, joining the waitlist, or exchanging email
                does not by itself create a professional relationship or place this firm in
                responsible charge of anything. An engagement begins only under a signed written
                agreement identifying the scope and the engineer in responsible charge.
              </p>

              <h2>Firm registration status</h2>
              <p>
                The firm&apos;s registration with the Texas Board of Professional Engineers and Land
                Surveyors is pending. Until that registration is active, this firm does not offer or
                perform engineering services in Texas, and no page of this website should be read as
                an offer to do so. The footer of every page states the current status, and it changes
                when the status does.
              </p>

              <h2>No guaranteed outcomes</h2>
              <p>
                Nothing on this site promises an engineering opinion in advance of the work that
                produces it. This firm does not guarantee that any inspection will produce a
                particular conclusion, that any certification will be issued, that any permit will be
                approved, that any authority having jurisdiction will accept a document, or that any
                lender, insurer, or other party will act in a particular way in response to one.
              </p>
              <p>
                An engineer&apos;s obligation runs to the facts and to the public. A firm that promised a
                result before performing the work would be promising something it is not entitled to
                deliver.
              </p>

              <h2>Insurance matters</h2>
              <p>
                This firm does not solicit insurance claims, does not act as a public adjuster, and
                does not advise on the value of a claim or on coverage under a policy. Where damage
                is investigated, the deliverable is a factual determination of cause and extent
                reasoned from evidence. It is prepared to the same standard whichever party
                commissioned it, and it is not written to advance the interests of the party paying
                for it.
              </p>

              <h2>Independent contractors</h2>
              <p>
                Field inspection work described on the careers pages is performed by independent
                contractors, not employees. An independent contractor accepts or declines each
                dispatched assignment, is paid a flat rate per completed inspection, controls the
                manner and means of performing the work within the requirements of the applicable
                written protocol, supplies their own vehicle and equipment, and is responsible for
                their own taxes, insurance, and business expenses.
              </p>
              <p>
                Nothing on this website is an offer of employment or a promise of any particular
                volume of work. Certification on a service protocol is required before a first
                assignment on that service, and certification is not itself an engagement.
              </p>

              <h2>Submissions you make</h2>
              <p>
                Do not submit confidential, privileged, or sensitive information through the forms on
                this site. Until an engagement exists there is no confidentiality obligation of the
                kind an engagement creates, and an unsolicited submission relating to a dispute could
                affect the firm&apos;s ability to act in that matter.
              </p>
              <p>
                You are responsible for the accuracy of what you submit. Automated, bulk, and
                fraudulent submissions are prohibited, as is any use of this site to harvest contact
                details or to interfere with its operation.
              </p>

              <h2>Intellectual property</h2>
              <p>
                The content, structure, and design of this website are the property of{" "}
                {business.legalName}. You may read it, print it, and quote from it with attribution.
                You may not republish it wholesale, use it to train a substitute for it, or present it
                as your own.
              </p>

              <h2>Third party links</h2>
              <p>
                Where this site links to a state agency, a federal program, or another organization,
                that is for reference. This firm does not control those sites and is not responsible
                for their content. Requirements published by an authority having jurisdiction are
                authoritative from that authority, not from this summary of them.
              </p>

              <h2>Disclaimer and limitation of liability</h2>
              <p>
                This website is provided as is. To the fullest extent permitted by Texas law,{" "}
                {business.legalName} disclaims all warranties relating to the website, express or
                implied, including warranties of merchantability, fitness for a particular purpose,
                accuracy, and uninterrupted availability.
              </p>
              <p>
                To the fullest extent permitted by law, {business.legalName} is not liable for
                indirect, incidental, consequential, special, or punitive damages arising out of your
                use of this website, or for any decision taken in reliance on general information
                published here rather than on a sealed engineering deliverable prepared for your
                property. This limitation applies to the website. It does not purport to limit the
                professional responsibility that attaches to sealed engineering work performed under
                a written agreement, which is governed by that agreement and by Texas law.
              </p>

              <h2>Governing law and venue</h2>
              <p>
                These terms are governed by the laws of the State of Texas, without regard to its
                conflict of laws rules. Any dispute arising out of them or out of use of this website
                is subject to the exclusive jurisdiction of the state and federal courts located in
                Texas.
              </p>

              <h2>Changes</h2>
              <p>
                These terms may be updated. The effective date at the top of the page changes when
                they do, and continued use of the site after a change means you accept the updated
                terms.
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
                See also the <Link href="/privacy">privacy policy</Link>.
              </p>
            </Prose>
          </div>
        </Container>
      </section>
    </>
  );
}
