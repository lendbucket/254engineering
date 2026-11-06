"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui/primitives";
import { rooferSignUpSchema } from "@/lib/roofer-application";

/**
 * STEP ONE OF THE ROOFING PARTNER SIGN UP. Robert's rework of 2026-11-06.
 *
 * Four answers and one button. The account opens on submit; the email that
 * follows sets the password and signs them in, where the rest of the profile
 * waits as a checklist. Each answer is checked with the schema the server
 * parses with, quietly until the field has been left once, then as typed.
 */

const FIELDS = [
  { name: "legalName", label: "Company name", type: "text", autoComplete: "organization" },
  { name: "ownerName", label: "Owner's name", type: "text", autoComplete: "name" },
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
  { name: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
] as const;
type Name = (typeof FIELDS)[number]["name"];

const INPUT =
  "block w-full min-h-[48px] rounded-[3px] border bg-white px-4 py-3 font-sans text-[16px] text-slate-ink placeholder:text-[#5F6877] transition-colors focus:outline-none focus:border-slate";

function checkField(name: Name, value: string): string | null {
  const r = rooferSignUpSchema.shape[name].safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Check this answer.");
}

export function RooferSignUpForm() {
  const router = useRouter();
  const [values, setValues] = useState<Record<Name, string>>({ legalName: "", ownerName: "", email: "", phone: "" });
  const [touched, setTouched] = useState<Partial<Record<Name, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<Name, string>>>({});
  const [sending, setSending] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const change = (name: Name, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (touched[name]) setErrors((e) => ({ ...e, [name]: checkField(name, value) ?? undefined }));
  };

  async function send() {
    const found: Partial<Record<Name, string>> = {};
    for (const f of FIELDS) {
      const e = checkField(f.name, values[f.name]);
      if (e) found[f.name] = e;
    }
    setTouched({ legalName: true, ownerName: true, email: true, phone: true });
    setErrors(found);
    if (Object.keys(found).length) {
      setBanner("A few answers need another look. They are marked below.");
      return;
    }
    setSending(true);
    setBanner(null);
    const honeypot = (document.querySelector<HTMLInputElement>('input[name="website"]')?.value ?? "").trim();
    try {
      const res = await fetch("/api/roofer-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          website: honeypot || undefined,
          landingPath: window.location.pathname,
          referrer: document.referrer || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; errors?: Partial<Record<Name, string>> };
      if (res.ok && body.ok) {
        /* Step two is its own page, carrying Robert's booking line (his request of 2026-11-06). */
        router.push("/roofing-partners/apply/received");
        setSent(body.message ?? "Check your email for the link to set your password and sign in.");
        return;
      }
      if (body.errors) {
        setErrors((e) => ({ ...e, ...body.errors }));
        setBanner("A few answers need another look. They are marked below.");
      } else {
        setBanner(body.message ?? "That did not go through, and nothing was saved. Your answers are still here; try again.");
      }
    } catch {
      setBanner("That did not go through, and it looks like the connection rather than anything you entered. Your answers are still here; try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div role="status">
        <p className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">Step 2 of 3: Confirm your email</p>
        <h2 className="mt-2 font-display text-[clamp(24px,3vw,30px)] leading-[1.2] font-bold text-slate">Check your email</h2>
        <p className="mt-4 text-[16px] leading-[1.7] text-slate-ink">{sent}</p>
        <p className="mt-3 text-[15.5px] leading-[1.7] text-slate-muted">
          The link opens your partner account, where you finish your profile: your work, your insurance and two references.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-[12px] font-bold tracking-[0.14em] text-brass-ink uppercase">Step 1 of 3: Create your account</p>
      <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] text-slate-muted" aria-label="The three steps">
        <li className="font-bold text-slate">1. Create your account</li>
        <li>2. Confirm your email</li>
        <li>3. Finish your profile</li>
      </ol>

      {banner ? (
        <div role="alert" className="mt-6 rounded-[4px] border border-brass-ink/40 bg-[#FDF6E7] px-5 py-4 text-[15px] font-medium text-slate-ink">
          {banner}
        </div>
      ) : null}

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="mt-7 grid gap-5"
      >
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
        {FIELDS.map((f) => (
          <div key={f.name}>
            <label htmlFor={`rs-${f.name}`} className="block font-sans text-[14px] font-bold text-slate">
              {f.label}
            </label>
            <input
              id={`rs-${f.name}`}
              name={f.name}
              type={f.type}
              autoComplete={f.autoComplete}
              inputMode={f.type === "tel" ? "tel" : undefined}
              value={values[f.name]}
              onChange={(e) => change(f.name, e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, [f.name]: true }));
                setErrors((e) => ({ ...e, [f.name]: checkField(f.name, values[f.name]) ?? undefined }));
              }}
              aria-invalid={errors[f.name] ? true : undefined}
              aria-describedby={errors[f.name] ? `rs-${f.name}-error` : undefined}
              className={`${INPUT} mt-2 ${errors[f.name] ? "border-brass-ink" : "border-limestone-line"}`}
            />
            {errors[f.name] ? (
              <p id={`rs-${f.name}-error`} className="mt-2 text-[0.85rem] font-medium text-brass-ink">
                {errors[f.name]}
              </p>
            ) : null}
          </div>
        ))}
        <button type="submit" disabled={sending} className={`${buttonClass("primary")} w-full sm:w-auto`}>
          {sending ? "Creating your account..." : "Create your partner account"}
        </button>
        <p className="text-[14px] leading-[1.6] text-slate-muted">
          The firm approves every partner, which is what keeps the program selective. Your account opens now; partner
          pricing and partner ordering turn on when it is approved.
        </p>
      </form>
    </div>
  );
}
