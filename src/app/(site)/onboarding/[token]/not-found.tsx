import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { business } from "@/config/business";

/**
 * What an invalid invite link shows.
 *
 * ONE PAGE FOR FOUR DIFFERENT FAILURES, ON PURPOSE
 * ------------------------------------------------
 * A malformed token, an unknown token, an expired token, and a completed
 * onboarding all land here with a 404. They read identically because telling
 * them apart is exactly the disclosure the token scheme exists to prevent:
 * "this link has expired" confirms that the link was real, which tells somebody
 * probing the route that the token space is worth guessing at.
 *
 * WHY IT IS NOT JUST THE SITE 404
 * -------------------------------
 * Because the most likely person reading it is not an attacker. It is a new hire
 * whose link aged out, on a phone, who was asked to do something and now cannot.
 * The site's generic "page not found" would be accurate and useless to them.
 *
 * So this reveals nothing and still helps: it says what to do next without
 * confirming that anything was ever here. The sentence is written to be true
 * whether the token was real or invented.
 */
export default function OnboardingNotFound() {
  return (
    <section className="bg-slate-ink">
      <Container>
        <div className="max-w-2xl py-24 sm:py-32">
          <p className="font-sans text-[0.72rem] font-semibold tracking-[0.24em] text-brass-light uppercase">
            Onboarding
          </p>
          <span aria-hidden="true" className="mt-6 block h-px w-20 bg-brass" />

          <h1 className="mt-8 font-display text-[2.1rem] leading-[1.1] font-bold text-slate-fg sm:text-[2.8rem]">
            This link is not active
          </h1>

          <p className="mt-7 text-[1.05rem] leading-[1.75] text-slate-fg-muted">
            Onboarding links are issued to one person and stop working after fourteen days. If you
            were sent one and it has stopped working, a new link can be issued straight away.
          </p>

          <p className="mt-6 text-[1.05rem] leading-[1.75] text-slate-fg-muted">
            Write to{" "}
            <a
              href={`mailto:${business.email}`}
              className="font-medium text-slate-fg underline decoration-brass underline-offset-4 transition-colors hover:text-brass-light"
            >
              {business.email}
            </a>{" "}
            from the address the link was sent to, and say which role you are joining for.
          </p>

          <p className="mt-10">
            <Link
              href="/"
              className="font-sans text-[0.96rem] font-semibold text-brass-light underline decoration-brass decoration-2 underline-offset-[6px] transition-colors hover:text-slate-fg"
            >
              Go to the {business.name} home page
            </Link>
          </p>
        </div>
      </Container>
    </section>
  );
}
