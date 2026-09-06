"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The order reference, and nothing else.
 *
 * A GET WITH THE REFERENCE IN THE URL, deliberately: an operator on the
 * telephone with a partner wants to send somebody else the same view, and a
 * screen whose state lives only in a form cannot be shared or reloaded.
 *
 * There is nothing sensitive in the reference. It is the string the customer
 * was given, and the screen behind it already requires partners.manage.
 */
export function LookupForm({ reference }: { reference: string }) {
  const router = useRouter();
  const [value, setValue] = useState(reference);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = value.trim();
    router.push(next ? `/portal/partners/disputes?reference=${encodeURIComponent(next)}` : "/portal/partners/disputes");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label htmlFor="reference" className="block text-[13.5px] font-semibold text-[var(--ink)]">
          Order reference
        </label>
        <input
          id="reference"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="254-..."
          className="mt-1.5 min-h-[var(--tap-target)] w-full rounded-[var(--radius-control)] border border-[var(--border-strong)] bg-white px-3 font-mono text-[16px] text-[var(--ink)] outline-none focus:border-[var(--navy)]"
        />
      </div>
      <button
        type="submit"
        className="min-h-[var(--tap-target)] rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white active:bg-[var(--navy-hover)]"
      >
        Look it up
      </button>
    </form>
  );
}
