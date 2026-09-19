import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { PageHeader } from "@/components/site/PageHeader";
import { DesignInquiryForm } from "@/components/forms/DesignInquiryForm";
import { Eyebrow, Rule } from "@/components/ui/primitives";
import { buildMetadata } from "@/lib/seo";
import { JsonLd, breadcrumbSchema } from "@/lib/schema";
import { isPrelaunch, notYetAcceptingEngagements, registrationStatement } from "@/lib/launch";

export const metadata: Metadata = buildMetadata({
  title: "Structural Design Brief for Texas Projects | 254 Engineering",
  description:
    "Tell us what is being built, what has to be produced, and the date it is needed. Send the brief and an engineer reads it within one business day.",
  path: "/design-inquiry",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Design inquiry", path: "/design-inquiry" },
];

/**
 * THE DESIGN BRIEF.
 *
 * WHY DESIGN GETS A FORM OF ITS OWN WHEN EVERY OTHER LINE USES THE LEAD FORM.
 *
 * The other eight service lines are a defined deliverable on a property: a
 * person says which one and where, and the firm knows what it is being asked
 * for. Design is not. "Sealed plans for an addition" and "a review of somebody
 * else's design for a remediation" are different pieces of work with different
 * hours, and no amount of free text in a message column lets anybody quote the
 * second from the first.
 *
 * So this collects a brief. 0050 holds it in its own table for the same reason,
 * and argues it at length: a lead is a contact and this is a brief.
 *
 * NO PRICE ON THIS PAGE, AND THAT IS THE SPECIFICATION RATHER THAN THE GATE.
 * Design is hourly with a fixed fee quoted from the engineer's own estimate and
 * a minimum engagement. Even with the gate open there is no number this page
 * could honestly print, because the number depends on the answers the form is
 * collecting. A page that printed one would be quoting before reading.
 *
 * THE GATE STILL APPLIES TO EVERYTHING ELSE ON IT. While the firm is not
 * accepting engagements the page says so in its own header, because a brief
 * somebody sends in good faith deserves to know what happens to it.
 */
export default function DesignInquiryPage() {
  const prelaunch = isPrelaunch();

  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />

      <PageHeader
        eyebrow="Design"
        title="Tell us what you are building"
        lede={
          prelaunch
            ? [
                "Send the brief and an engineer will read it and come back to you.",
                notYetAcceptingEngagements(),
                registrationStatement(),
              ]
                .filter(Boolean)
                .join(" ")
            : "Send the brief and an engineer will read it and come back to you within one business day."
        }
        crumbs={crumbs}
      />

      <section className="border-b border-limestone-line">
        <Container>
          <div className="grid gap-12 py-[clamp(48px,7vw,88px)] lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <Eyebrow>What happens to this</Eyebrow>
              <Rule className="mt-5" />

              <ul className="mt-9 space-y-6">
                {[
                  {
                    title: "An engineer reads it, not a form handler",
                    body: "Design work cannot be scoped from a dropdown. What you write here is read by somebody who will have to stand behind the drawings, and the first reply is a conversation about scope rather than a figure.",
                  },
                  {
                    title: "You are not being quoted yet",
                    body: "Design is charged by the hour against a fixed fee agreed in advance, and that fee comes from the engineer's own estimate of the work once he understands it. No page can produce that number and this one does not pretend to.",
                  },
                  {
                    title: "Three answers may change the answer",
                    body: "An open insurance claim, active litigation, or an existing adverse report from another engineer each change what can properly be produced. You are asked about all three up front so that the conversation happens before anybody has paid for anything.",
                  },
                  {
                    title: "Nothing here is a commitment",
                    body: "Sending a brief is not an order and creates no engagement. It is the start of a conversation, and if the firm cannot take the work you will be told plainly and pointed somewhere that can.",
                  },
                ].map((item) => (
                  <li key={item.title}>
                    <p className="font-display text-[18px] leading-[1.3] font-bold text-slate">
                      {item.title}
                    </p>
                    <p className="mt-2 text-[0.98rem] leading-[1.7] text-slate-muted">{item.body}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7">
              <DesignInquiryForm />
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
