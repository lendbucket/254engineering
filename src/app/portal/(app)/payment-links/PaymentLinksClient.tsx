"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Done, Problem, ghostClass, postJson, primaryClass } from "@/components/portal/staff-kit";

/**
 * One way to be paid for one job: send a payment link, or invoice the account.
 * It posts to the door that already exists, which asks every question again, so
 * a refusal there reaches the person in its own words. What is asked before
 * sending names the amount and where it goes, because once sent the customer
 * holds it.
 */
export function BillButton({
  fileId,
  fileNumber,
  action,
  label,
  available,
  because,
  amount,
  email,
}: {
  fileId: string;
  fileNumber: string;
  action: "send_payment_link" | "invoice_account";
  label: string;
  available: boolean;
  because: string | null;
  amount: string | null;
  email: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const question =
    action === "send_payment_link"
      ? `Send ${email ?? "the client"} a payment link for ${amount ?? "this job"} against ${fileNumber}?`
      : `Invoice ${fileNumber} at ${amount ?? "its price"} to the client's account? It joins the account's next statement.`;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          disabled={!available || busy}
          className={action === "send_payment_link" ? primaryClass : ghostClass}
          onClick={async () => {
            if (!window.confirm(question)) return;
            setBusy(true);
            setError(null);
            const result = await postJson("/api/portal/files", { action, fileId });
            setBusy(false);
            if (!result.ok) return setError(result.error);
            const reference = typeof result.reference === "string" ? result.reference : "the order";
            setDone(
              action === "send_payment_link"
                ? `Sent. ${reference} is waiting for payment, and the customer has the link by email.`
                : `Invoiced against ${reference}. It joins the account's next statement.`,
            );
            router.refresh();
          }}
        >
          {busy ? "Working" : label}
        </button>
      </div>
      {!available && because ? <p className="text-[14px] leading-[1.5] text-[var(--secondary)]">{because}</p> : null}
      <Problem message={error} />
      <Done message={done} />
    </div>
  );
}
