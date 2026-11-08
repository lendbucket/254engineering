import { business } from "@/config/business";
import { SignInFrame } from "@/components/portal/SignInFrame";

/**
 * "FORGOT YOUR PASSWORD?" FOR STAFF AND PARTNERS. Robert's answer 1 of
 * 2026-11-08 (issue #1, 6724956292): on the staff and partner sign-in pages the
 * link opens a short page saying an administrator sends a reset link, with the
 * support address. Customers keep their own self-service flow.
 *
 * It is information and nothing else: no form, no endpoint, nothing that sends
 * or resets, because a self-service reset for staff and partners is new
 * security behaviour and is its own full-lane item. The address is the one
 * firm inbox Robert reads, read from `business`, never typed.
 */
export function ForgotPasswordNotice({
  label,
  who,
  signInHref,
}: {
  label: "Operations portal" | "Partner program";
  /** Who sends the link, in the reader's terms. */
  who: string;
  signInHref: string;
}) {
  return (
    <SignInFrame label={label}>
      <h1 className="font-display text-[24px] leading-[1.25] font-bold text-[var(--navy)]">
        Reset your password
      </h1>
      <p className="mt-5 text-[16px] leading-[1.6] text-[var(--ink)]">
        {who} sends a link to set a new password. Write to{" "}
        <a
          href={`mailto:${business.email}`}
          className="font-semibold text-[var(--navy)] underline underline-offset-2"
        >
          {business.email}
        </a>{" "}
        from the address you sign in with.
      </p>
      <p className="mt-7">
        <a
          href={signInHref}
          className="inline-flex min-h-[var(--tap-target)] items-center text-[15px] font-semibold text-[var(--navy)] underline underline-offset-2"
        >
          Back to sign in
        </a>
      </p>
    </SignInFrame>
  );
}
