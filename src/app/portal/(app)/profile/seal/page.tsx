import Link from "next/link";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { mfaStateFor } from "@/lib/ops-mfa";
import { sealImageStatus } from "@/lib/seal-store";
import { PageHead, Panel } from "@/components/portal/surfaces";
import { SealImageForm } from "./SealImageForm";

export const dynamic = "force-dynamic";

/**
 * ===========================================================================
 * THE ENGINEER'S SEAL AND SIGNATURE, ON HIS OWN PROFILE.
 * ===========================================================================
 *
 * Rulings 2 and 5 of 2026-10-06, and the first piece of the sealing build
 * because the engineer has to do his part before anything can be sealed: set
 * up his second factor, then store his seal and signature.
 *
 * WHAT IS SHOWN, AND WHAT NEVER IS. For each image: whether one is on file,
 * since when, and a twelve character fingerprint. Never the image, here or on
 * any other screen. That is the second requirement of ruling 2, and it is why
 * the upload form previews nothing either.
 *
 * WHO CAN OPEN IT. The licence holder, and only for himself: the page reads the
 * session's own profile and takes no id from the address, so there is no URL
 * that shows somebody else's.
 */
export default async function SealPage() {
  const actor = await currentActor();
  if (!holdsLicence(actor, "documents.seal")) notFound();

  /*
   * THE STORE MAY NOT EXIST YET, AND THE SCREEN SAYS SO RATHER THAN FAILING.
   * eng_seal_images is created by 0061, which runs on development and on
   * production only when it is applied, production in a sitting. Until then
   * the read fails, and the first board after this screen was built found it
   * answering HTTP 500 on development for exactly that reason. A screen the
   * engineer opens before the sitting must tell him the store is not ready,
   * not show him an error page.
   */
  const mfa = await mfaStateFor(actor!.id);
  const enrolled = mfa.enrolled;
  let images: Awaited<ReturnType<typeof sealImageStatus>> | null = null;
  try {
    images = await sealImageStatus(actor!.id);
  } catch (err) {
    console.error(`[seal] ${err instanceof Error ? err.message : String(err)}`);
  }

  const when = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
          timeZone: "America/Chicago",
        })
      : null;

  return (
    <>
      <PageHead
        title="Your seal and signature"
        lede="Stored here by you, applied by you from your own session, and never shown on any screen."
      />

      <Panel
        title="Two-step verification"
        description="Every seal you store, and every document you seal, asks for a fresh code from your authenticator app."
      >
        {enrolled ? (
          <p className="text-[13.5px] leading-[1.7] text-[var(--ink)]">
            Set up and verified. Codes from your authenticator app are accepted for storing a seal and for sealing.
          </p>
        ) : (
          <>
            <p className="text-[13.5px] leading-[1.7] text-[var(--ink)]">
              Not set up yet. Sealing is refused until it is, and so is storing a seal or signature.
            </p>
            <Link
              href="/portal/mfa/enrol"
              className="mt-3 inline-flex min-h-[var(--tap-target)] items-center rounded-[var(--radius-control)] bg-[var(--navy)] px-4 text-[15px] font-bold text-white hover:bg-[var(--navy-hover)]"
            >
              Set up two-step verification
            </Link>
          </>
        )}
      </Panel>

      {images === null ? (
        <Panel
          title="Seal and signature"
          description="The store for your seal and signature is not set up on this database yet."
        >
          <p className="text-[13.5px] leading-[1.7] text-[var(--ink)]">
            Nothing can be stored until it is. It is created when the firm applies the change that
            adds it, and this screen will show what is on file from then on.
          </p>
        </Panel>
      ) : null}

      {(images ?? []).map((image) => {
        const heading = image.kind === "seal" ? "Your seal" : "Your signature";
        return (
          <Panel
            key={image.kind}
            title={heading}
            description={
              image.onFileSince
                ? `On file since ${when(image.onFileSince)}. Fingerprint ${image.fingerprint}. Storing a new one replaces it from then on; the old one stays on record against anything it sealed.`
                : "Nothing on file yet."
            }
          >
            {enrolled ? (
              <SealImageForm kind={image.kind} heading={heading} />
            ) : (
              <p className="text-[13.5px] leading-[1.7] text-[var(--secondary)]">
                Set up two-step verification first.
              </p>
            )}
          </Panel>
        );
      })}
    </>
  );
}
