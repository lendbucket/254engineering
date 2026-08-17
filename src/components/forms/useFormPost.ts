"use client";

import { useCallback, useState } from "react";

/**
 * The shared submit behaviour for every form on the site.
 *
 * WHY THE FORMS POST JSON RATHER THAN USING A SERVER ACTION
 * ---------------------------------------------------------
 * A Server Action would be fewer moving parts. It would also be invisible to
 * scripts/forms-audit.mjs, which drives these forms in a real browser and
 * asserts on the request body that leaves the page. The whole value of that
 * harness is that it proves the answer a person typed is the answer that travels,
 * and an action's payload is an implementation detail it cannot read. A JSON POST
 * to a named route is observable, so it stays.
 *
 * `submitting` guards double submission, which on a form with an email
 * notification means two emails and two rows for one person.
 */
export type FormState = {
  status: "idle" | "submitting" | "success" | "error";
  errors: Record<string, string>;
  message: string | null;
};

export function useFormPost(endpoint: string) {
  const [state, setState] = useState<FormState>({ status: "idle", errors: {}, message: null });

  /**
   * Reject locally, without a request.
   *
   * This is what makes the client validation real rather than decorative. The
   * first run of scripts/forms-audit.mjs found every form posting its invalid
   * submission and rendering the server's 422 response: the errors looked
   * correct, so nothing on screen showed the defect. What it cost was a round
   * trip for every typo, a row of noise in the request log, and a route doing
   * validation work for input that never had to leave the page.
   *
   * The server still validates everything. A form is an HTTP endpoint and anyone
   * can post to it, so this is the fast path, never the gate.
   */
  const fail = useCallback((errors: Record<string, string>) => {
    setState({ status: "error", errors, message: null });
  }, []);

  const submit = useCallback(
    async (payload: Record<string, unknown>) => {
      setState({ status: "submitting", errors: {}, message: null });
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            // Captured here rather than on the server because the server sees the
            // route it is handling, not the page the person was reading.
            landingPath: typeof window !== "undefined" ? window.location.pathname : undefined,
            referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
          }),
        });

        if (res.ok) {
          setState({ status: "success", errors: {}, message: null });
          return true;
        }

        const body = (await res.json().catch(() => ({}))) as {
          errors?: Record<string, string>;
          message?: string;
        };

        setState({
          status: "error",
          errors: body.errors ?? {},
          // A 422 with field errors needs no banner, the fields carry it. Anything
          // else does, because otherwise the button just stops working and the
          // person is left guessing.
          message: body.errors
            ? null
            : (body.message ??
              "That did not go through. Try again, or email us directly and we will pick it up."),
        });
        return false;
      } catch {
        setState({
          status: "error",
          errors: {},
          message:
            "That did not go through, and it looks like a connection problem rather than anything you entered. Try again in a moment.",
        });
        return false;
      }
    },
    [endpoint],
  );

  return { state, submit, fail };
}

/** Read a form element into a plain object of trimmed strings. */
export function readForm(form: HTMLFormElement): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") out[key] = value.trim();
  }
  return out;
}
