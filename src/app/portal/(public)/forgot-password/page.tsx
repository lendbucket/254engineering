import type { Metadata } from "next";
import { ForgotPasswordNotice } from "@/components/portal/ForgotPasswordNotice";

export const metadata: Metadata = {
  title: "Reset your password | 254 Engineering",
};

/**
 * Staff password reset: the page "Forgot your password?" opens. Robert's answer
 * 1 of 2026-11-08. It tells the reader an administrator sends a reset link and
 * gives the support address; it sends and resets nothing. Open to a signed out
 * visitor by design (OPEN_PATHS in src/proxy.ts, OPEN_BY_DESIGN in
 * security-audit), because the person reading it cannot sign in.
 */
export default function PortalForgotPasswordPage() {
  return (
    <ForgotPasswordNotice
      label="Operations portal"
      who="An administrator"
      signInHref="/portal/login"
    />
  );
}
