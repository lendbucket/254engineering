import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { holdsLicence } from "@/lib/ops-authz";
import { ProtocolDocumentPage } from "../protocol-document";

export const dynamic = "force-dynamic";

/**
 * 254-RC-001 in the portal, through the one page every protocol shares. Why
 * each protocol keeps a short route of its own rather than one `[document]`
 * route, and why the guard is here rather than in the shared page, are both
 * written at the top of `../protocol-document.tsx`.
 */
export default async function ProtocolRC001Page() {
  const actor = await currentActor();
  /*
   * The same licensed capability the protocols index uses. Authoring and
   * reading a protocol are the engineer's, and a second capability for the same
   * authority is how two answers to one question start to exist.
   */
  if (!holdsLicence(actor, "protocols.author")) notFound();

  return <ProtocolDocumentPage documentNumber="254-RC-001" />;
}
