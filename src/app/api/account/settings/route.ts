import { NextResponse, type NextRequest } from "next/server";
import { currentCustomer } from "@/lib/customer-auth";
import { updateDefaults, addProperty, archiveProperty } from "@/lib/ops-account";

export const dynamic = "force-dynamic";

/**
 * An organisation's own settings.
 *
 * The owner check lives in ops-account rather than here, so a second caller
 * cannot skip it. This route decides which action ran and nothing about who may
 * run it.
 */
export async function POST(request: NextRequest) {
  const me = await currentCustomer();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";

  if (action === "defaults") {
    const counties = Array.isArray(body?.defaultCounties)
      ? (body.defaultCounties as unknown[]).filter((c): c is string => typeof c === "string")
      : undefined;

    const result = await updateDefaults(me, {
      billingEmail: typeof body?.billingEmail === "string" ? body.billingEmail : undefined,
      billingContact: typeof body?.billingContact === "string" ? body.billingContact : undefined,
      accessInstructions:
        typeof body?.accessInstructions === "string" ? body.accessInstructions : undefined,
      preferredUrgency:
        typeof body?.preferredUrgency === "string"
          ? (body.preferredUrgency as "standard" | "expedited" | "emergency")
          : undefined,
      defaultCounties: counties,
    });

    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, error: result.error }, { status: 403 });
  }

  if (action === "add-property") {
    const result = await addProperty(me, {
      label: typeof body?.label === "string" ? body.label : undefined,
      propertyAddress: typeof body?.propertyAddress === "string" ? body.propertyAddress : "",
      city: typeof body?.city === "string" ? body.city : undefined,
      county: typeof body?.county === "string" ? body.county : "",
      postalCode: typeof body?.postalCode === "string" ? body.postalCode : undefined,
      accessNotes: typeof body?.accessNotes === "string" ? body.accessNotes : undefined,
    });

    return result.ok
      ? NextResponse.json({ ok: true, id: result.id })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (action === "archive-property") {
    const id = typeof body?.propertyId === "string" ? body.propertyId : "";
    if (!id) return NextResponse.json({ ok: false, error: "Which property?" }, { status: 400 });

    const result = await archiveProperty(me, id);
    return result.ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
