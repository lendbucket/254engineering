import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { isSuppressed, suppress, tokenValid } from "@/lib/marketing-suppression";

export const dynamic = "force-dynamic";

/**
 * Unsubscribing from marketing, in one click.
 *
 * WHY IT ACTS ON A GET RATHER THAN ASKING FOR A CONFIRMATION
 * -----------------------------------------------------------
 * A confirmation step reads as reluctance, and a person who has decided to stop
 * hearing from a firm should not have to argue with it. The link is signed, so
 * the only way to arrive here with a valid token is to have been sent one.
 *
 * The usual objection to acting on a GET is prefetchers and scanners following
 * links, and it is a real one. It costs a suppression that the person did not
 * ask for, which is a failure in the direction of sending them LESS mail than
 * they wanted rather than more. Against that: a confirmation button that a
 * scanner cannot press is also a button a person on a mail client that strips
 * JavaScript cannot press. The quieter failure wins.
 *
 * WHAT THIS PAGE DELIBERATELY DOES NOT OFFER
 * -------------------------------------------
 * A way to stop transactional email. There is none, and the page says so rather
 * than staying silent about it: somebody who paid for a document keeps
 * receiving news about that document, and a person who expected this page to
 * switch everything off should learn that here rather than by missing a receipt.
 */

export const metadata: Metadata = {
  title: "Email preferences | 254 Engineering",
  robots: { index: false, follow: false, nocache: true },
};

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string }>;
}) {
  const { e, t } = await searchParams;
  const email = (e ?? "").trim();
  const token = (t ?? "").trim();

  /*
   * One message for a missing token, a wrong one and a malformed address. The
   * page must not become a way to ask whether an address is on the firm's list:
   * distinguishing "not signed" from "signed but unknown" would answer that.
   */
  const valid = email !== "" && tokenValid(email, token);

  let done = false;
  let failed = false;

  if (valid) {
    if (await isSuppressed(email)) {
      done = true;
    } else {
      const result = await suppress(email, "clicked the unsubscribe link in an email");
      done = result.ok;
      failed = !result.ok;
    }
  }

  return (
    <Container>
      <div className="mx-auto max-w-[640px] px-4 py-16">
        {!valid ? (
          <>
            <h1 className="font-display text-[24px] leading-[1.25] font-bold text-[var(--navy)]">
              This link does not open a preference
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--ink)]">
              The link may have been mistyped, or it may have been changed on the way here. Reply to
              any email from the firm and it will be sorted out by a person.
            </p>
          </>
        ) : failed ? (
          <>
            <h1 className="font-display text-[24px] leading-[1.25] font-bold text-[var(--navy)]">
              That could not be recorded
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--ink)]">
              Nothing has changed, so you would still receive announcements. Reply to the email you
              came from and a person will take you off the list by hand.
            </p>
          </>
        ) : done ? (
          <>
            <h1 className="font-display text-[24px] leading-[1.25] font-bold text-[var(--navy)]">
              You are off the announcement list
            </h1>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--ink)]">
              {email} will not receive announcements from 254 Engineering. It takes effect now
              rather than in a few days.
            </p>
            <p className="mt-4 text-[15px] leading-[1.65] text-[var(--ink)]">
              You will still receive email about anything you have ordered: the confirmation, the
              engineer&apos;s decision, and what happens to your money if they cannot seal it. Those
              are not announcements and there is no way to switch them off, because they are how the
              firm tells you about your own work.
            </p>
          </>
        ) : null}
      </div>
    </Container>
  );
}
