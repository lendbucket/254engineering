import { NextResponse } from "next/server";
import {
  findByToken,
  itemsFor,
  markItemAcknowledged,
  markItemUploaded,
  setStatus,
} from "@/lib/onboarding";
import { createOnboardingUpload } from "@/lib/onboarding-uploads";
import { itemByKey } from "@/content/onboarding-checklists";
import { notify } from "@/lib/notify";
import { onboardingSubmitted } from "@/lib/email-templates";

/**
 * Every write the onboarding flow makes, behind one route.
 *
 * THE TOKEN IS THE ONLY CREDENTIAL, SO IT IS THE ONLY THING TRUSTED
 * -----------------------------------------------------------------
 * Each request carries the invite token and nothing else that identifies the
 * record. The onboarding id is resolved from that token on the server, on every
 * request, and the id the client happens to know is never accepted as an input.
 *
 * That is the whole security model of this route and it is worth being blunt
 * about why. If the client could pass an onboarding id, anybody with a valid
 * link for their own onboarding could write to somebody else's by changing a
 * uuid, because there is no session and no per record ownership check beyond the
 * token. Resolving server side means a token can only ever reach the record it
 * was issued for.
 *
 * The same reasoning kills a tempting convenience: there is no endpoint that
 * takes an id and returns the checklist. Reads happen in the server component.
 *
 * EVERY FAILURE IS THE SAME FAILURE
 * ---------------------------------
 * A bad token, an expired token, and an unknown token all return 404 with an
 * identical body. Distinguishing them would tell somebody probing the route
 * which tokens exist.
 */

type Action = "upload" | "item" | "submit";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Malformed request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const action = body.action as Action;

  // Resolve first. Nothing below this line runs for an invalid token.
  const onboarding = await findByToken(token);
  if (!onboarding) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  if (onboarding.status === "complete") {
    return NextResponse.json(
      { ok: false, error: "This onboarding is closed. Contact the firm if something needs changing." },
      { status: 409 },
    );
  }

  switch (action) {
    case "upload":
      return handleUpload(onboarding.id, onboarding.role, body);
    case "item":
      return handleItem(onboarding.id, onboarding.role, body);
    case "submit":
      return handleSubmit(onboarding.id, onboarding.person_name, onboarding.email, onboarding.role);
    default:
      return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
  }
}

/**
 * Hand back a signed URL so the browser can PUT the file straight to storage.
 *
 * The route never receives the bytes. A fifteen megabyte photograph of a
 * passport does not belong in a serverless function body, and a direct PUT
 * survives a phone on poor signal far better than a proxied upload.
 */
async function handleUpload(
  onboardingId: string,
  role: "engineer" | "field_tech",
  body: Record<string, unknown>,
) {
  const { itemKey, filename, contentType, size } = body;
  if (
    typeof itemKey !== "string" ||
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    typeof size !== "number"
  ) {
    return NextResponse.json({ ok: false, error: "Missing upload details." }, { status: 400 });
  }

  // The item has to be one this role is actually asked for, and it has to be a
  // person item. An operator verified item is not uploadable through the flow.
  const definition = itemByKey(role, itemKey);
  if (!definition || definition.actor !== "person") {
    return NextResponse.json({ ok: false, error: "Unknown checklist item." }, { status: 400 });
  }

  const result = await createOnboardingUpload({
    onboardingId,
    itemKey,
    filename,
    contentType,
    size,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: result.url, path: result.path });
}

/** Record that an item is done, either with a file or as an acknowledgment. */
async function handleItem(
  onboardingId: string,
  role: "engineer" | "field_tech",
  body: Record<string, unknown>,
) {
  const { itemKey, storageKey } = body;
  if (typeof itemKey !== "string") {
    return NextResponse.json({ ok: false, error: "Missing item." }, { status: 400 });
  }

  const definition = itemByKey(role, itemKey);
  if (!definition || definition.actor !== "person") {
    return NextResponse.json({ ok: false, error: "Unknown checklist item." }, { status: 400 });
  }

  const result = definition.acknowledgeOnly
    ? await markItemAcknowledged({ onboardingId, itemKey })
    : typeof storageKey === "string" && storageKey.length > 0
      ? await markItemUploaded({ onboardingId, itemKey, storageKey })
      : { ok: false as const, error: "That upload did not finish. Try it again." };

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Submit.
 *
 * The status moves first and the notification is attempted second, and the two
 * are deliberately not chained: a Resend outage must not lose a submission that
 * is already recorded. Same reasoning as the lead and application routes.
 */
async function handleSubmit(
  onboardingId: string,
  personName: string,
  email: string,
  role: "engineer" | "field_tech",
) {
  const items = await itemsFor(onboardingId);
  const outstanding = items.filter((i) => i.actor === "person" && i.status === "pending");
  if (outstanding.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `There ${outstanding.length === 1 ? "is 1 item" : `are ${outstanding.length} items`} still to complete.`,
      },
      { status: 400 },
    );
  }

  const write = await setStatus(onboardingId, "submitted");
  if (!write.ok) {
    return NextResponse.json({ ok: false, error: write.error }, { status: 500 });
  }

  await notify(
    onboardingSubmitted({
      personName,
      personEmail: email,
      role,
      onboardingId,
      itemCount: items.filter((i) => i.actor === "person").length,
    }),
  );

  return NextResponse.json({ ok: true });
}
