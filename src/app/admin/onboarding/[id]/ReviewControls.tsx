"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/primitives";
import { Chip, Panel } from "@/components/admin/shell";

type Item = {
  itemKey: string;
  label: string;
  status: string;
  url: string | null;
  rejectedReason: string | null;
};

/**
 * The review controls.
 *
 * REJECTION REQUIRES A REASON
 * ---------------------------
 * The person on the other end sees this. A rejected item with no reason is a
 * checklist that has gone backwards for no stated cause, and the only recourse
 * is to email and ask, which defeats the point of a portal. The button stays
 * disabled until something is typed.
 *
 * THE TWO VERIFICATION CHECKS ARE NOT PART OF THE CHECKLIST
 * ---------------------------------------------------------
 * Identity confirmed on the video call, and I-9 Section 2 examined. Neither can
 * be satisfied by an upload, because both are things federal procedure requires
 * a human to do live. They sit apart from the items for that reason rather than
 * as a layout preference, and they record when rather than whether.
 *
 * EVERY ACTION REPORTS ITS OUTCOME
 * --------------------------------
 * A control that looks like it worked and did not is worse than one that
 * visibly failed, because the operator moves on believing the record changed.
 */
export function ReviewControls({
  onboardingId,
  status,
  identityVerifiedAt,
  i9ExaminedAt,
  items,
}: {
  onboardingId: string;
  status: string;
  identityVerifiedAt: string | null;
  i9ExaminedAt: string | null;
  items: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  /*
   * Optimistic state on the two verification boxes.
   *
   * They were controlled purely by the server value, so a click set the box,
   * React immediately reverted it because the prop had not changed, and it only
   * appeared checked once the round trip and the refresh completed. For about a
   * second the operator saw nothing happen, and the obvious response to nothing
   * happening is to click again, which toggles it back off.
   *
   * The local value leads and the server value reconciles it on the next render.
   * Found by driving the portal rather than by reading it: Playwright reported
   * "clicking the checkbox did not change its state", which is precisely what a
   * person would have experienced.
   */
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const isChecked = (field: string, at: string | null) =>
    field in optimistic ? optimistic[field] : Boolean(at);

  async function call(body: Record<string, unknown>, key: string, ok: string) {
    setBusy(key);
    setError("");
    setNotice("");
    const res = await fetch("/api/admin/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingId, ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; inviteUrl?: string };
    setBusy("");
    if (!res.ok) {
      setError(data.error || "That did not go through.");
      // Drop the optimistic value so the box returns to what the record says.
      // A checkbox showing a state the database does not hold is worse than a
      // visible failure, because the operator stops checking.
      setOptimistic({});
      return;
    }
    setNotice(data.inviteUrl ? `${ok} ${data.inviteUrl}` : ok);
    router.refresh();
  }

  return (
    <div className="grid gap-[18px]">
      <Panel title="Verification the operator performs">
        <p className="text-[14.5px] leading-[1.7] text-slate-muted">
          Neither of these can be satisfied by an upload. Both are steps federal procedure requires
          a person to carry out live.
        </p>
        <div className="mt-4 space-y-3">
          {[
            ["identity_verified_at", "Identity confirmed on the video call", identityVerifiedAt],
            ["i9_examined_at", "I-9 Section 2 documents examined", i9ExaminedAt],
          ].map(([field, label, at]) => (
            <label
              key={field as string}
              className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-[3px] border border-limestone-line bg-white px-4 py-3 transition-colors has-[:checked]:border-brass has-[:checked]:bg-limestone"
            >
              <input
                type="checkbox"
                checked={isChecked(field as string, at as string | null)}
                disabled={busy === (field as string)}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOptimistic((o) => ({ ...o, [field as string]: next }));
                  void call(
                    { action: "verification", field, value: next },
                    field as string,
                    next ? "Recorded." : "Cleared.",
                  );
                }}
                className="mt-0.5 h-5 w-5 shrink-0 accent-slate"
              />
              <span className="text-[14.5px] leading-[1.6] text-slate-ink">
                {label as string}
                {at ? (
                  <span className="block text-[13px] text-slate-muted">
                    Recorded {new Date(at as string).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </Panel>

      <Panel title="Checklist items">
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.itemKey} className="border-b border-limestone-line pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-3">
                <Chip status={item.status} />
                <span className="font-semibold text-slate">{item.label}</span>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[36px] items-center font-semibold text-slate underline decoration-brass underline-offset-4"
                  >
                    Open document
                  </a>
                ) : (
                  <span className="text-[14px] text-slate-muted">No document uploaded</span>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1">
                  <label
                    htmlFor={`reason-${item.itemKey}`}
                    className="block font-sans text-[13px] font-bold text-slate"
                  >
                    Reason, required to reject
                  </label>
                  <input
                    id={`reason-${item.itemKey}`}
                    value={reasons[item.itemKey] ?? ""}
                    onChange={(e) => setReasons((r) => ({ ...r, [item.itemKey]: e.target.value }))}
                    className="mt-1 block min-h-[44px] w-full rounded-[3px] border border-limestone-line bg-white px-3 py-2 font-sans text-[16px] text-slate-ink focus:border-slate"
                  />
                </div>
                <button
                  type="button"
                  disabled={busy === item.itemKey}
                  onClick={() =>
                    call(
                      { action: "item", itemKey: item.itemKey, decision: "accepted" },
                      item.itemKey,
                      "Accepted.",
                    )
                  }
                  className={buttonClass("primary")}
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busy === item.itemKey || !(reasons[item.itemKey] ?? "").trim()}
                  onClick={() =>
                    call(
                      {
                        action: "item",
                        itemKey: item.itemKey,
                        decision: "rejected",
                        reason: reasons[item.itemKey],
                      },
                      item.itemKey,
                      "Rejected.",
                    )
                  }
                  className={buttonClass("secondary")}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Record">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy === "resend"}
            onClick={() => call({ action: "resend" }, "resend", "New invite issued. The old link no longer works.")}
            className={buttonClass("secondary")}
          >
            Resend invite
          </button>
          {status !== "complete" ? (
            <button
              type="button"
              disabled={busy === "status"}
              onClick={() => call({ action: "status", status: "complete" }, "status", "Marked complete.")}
              className={buttonClass("primary")}
            >
              Mark complete
            </button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-4 border-l-4 border-brass bg-limestone px-4 py-3 text-[14.5px] text-slate">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-4 break-all border-l-4 border-brass bg-limestone px-4 py-3 text-[14.5px] text-slate">
            {notice}
          </p>
        ) : null}
      </Panel>
    </div>
  );
}
