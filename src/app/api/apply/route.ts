import { NextResponse } from "next/server";
import {
  engineerApplicationSchema,
  fieldErrors,
  technicianApplicationSchema,
} from "@/lib/application-schemas";
import { insertStructuredApplication } from "@/lib/intake";
import { queueEmail } from "@/lib/ops-jobs";
import { applicantConfirmation, applicationNotification } from "@/lib/email-templates";
import { signedDownloadUrl } from "@/lib/uploads";
import { positionByTrack } from "@data/positions";

/**
 * Careers intake for both roles.
 *
 * WHY THIS ROUTE REPORTS FAILURE HONESTLY AND THE LEAD ROUTE DOES NOT
 * -------------------------------------------------------------------
 * /api/lead answers 200 even when the write fails, deliberately: a lost enquiry
 * is bad, and a visible error at the moment of submission loses the person as
 * well, because almost nobody retypes a message.
 *
 * An application is different in kind. Somebody has spent ten minutes on five
 * steps and uploaded a resume, and their answers are still in sessionStorage on
 * the other side of this request. Telling them it worked when it did not means
 * they walk away believing they applied, and there is nothing to reply to. So a
 * failed write here returns 500 with a real message and a route out, and the
 * flow keeps their answers so a retry costs one tap.
 *
 * The email failing is treated differently again. The row is the record; if the
 * notification does not send, the application still exists and the outcome is
 * logged rather than surfaced.
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Malformed request." }, { status: 400 });
  }

  const role = (payload as { role?: string })?.role;
  if (role !== "professional_engineer" && role !== "field_technician") {
    return NextResponse.json({ ok: false, message: "Unknown application type." }, { status: 400 });
  }

  const isEngineer = role === "professional_engineer";
  const schema = isEngineer ? engineerApplicationSchema : technicianApplicationSchema;
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, errors: fieldErrors(parsed.error) }, { status: 422 });
  }

  const data = parsed.data as Record<string, unknown> & {
    applicationId: string;
    fullName: string;
    email: string;
    phone?: string;
    city?: string;
    company?: string;
  };

  // Honeypot. Answered as success so a bot learns nothing, and nothing is
  // written. See src/lib/forms.ts for the full reasoning.
  if (data.company) return NextResponse.json({ ok: true });

  const position = positionByTrack(isEngineer ? "engineer" : "technician");
  const roleLabel = position?.shortTitle ?? (isEngineer ? "Professional Engineer" : "Field Technician");
  const positionTitle = position?.title ?? roleLabel;

  // The payload is everything except the attribution, the honeypot, and the
  // fields already stored in their own columns. Those are excluded rather than
  // duplicated so there is one place to correct a value.
  const {
    company: _company,
    landingPath,
    referrer,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    ...answers
  } = data;
  void _company;

  const write = await insertStructuredApplication({
    applicationId: data.applicationId,
    role,
    name: data.fullName,
    email: data.email,
    phone: data.phone,
    city: data.city,
    payload: answers,
    landingPath: landingPath as string | undefined,
    referrer: referrer as string | undefined,
    userAgent: request.headers.get("user-agent") ?? undefined,
    utmSource: utmSource as string | undefined,
    utmMedium: utmMedium as string | undefined,
    utmCampaign: utmCampaign as string | undefined,
    utmContent: utmContent as string | undefined,
    utmTerm: utmTerm as string | undefined,
  });

  if (!write.ok) {
    console.error(`[apply] write failed (${role}): ${write.error}`);
    return NextResponse.json(
      {
        ok: false,
        message:
          "Your application did not save. Nothing has been recorded, so please try again in a moment. Your answers are still on this page.",
      },
      { status: 500 },
    );
  }

  // ---- the operator package ----

  const documents: { label: string; filename: string; url: string | null }[] = [];
  for (const [field, label] of [
    ["resume", "Resume"],
    ["certifications", "Certifications"],
    ["licenseDocument", "License verification"],
  ] as const) {
    const file = answers[field] as { path: string; filename: string } | undefined;
    if (file?.path) {
      documents.push({ label, filename: file.filename, url: await signedDownloadUrl(file.path) });
    }
  }

  /*
   * The optional depth fields, as their own sections.
   *
   * Appended rather than folded into Experience, because an empty optional
   * answer should leave no trace in the operator's email. The layout drops a
   * section whose rows are all empty, so a candidate who skipped these produces
   * exactly the email they produced before the fields existed.
   */
  type Row = [string, string | undefined];

  const aboutYou: { heading: string; rows: Row[] }[] = [
    {
      heading: "In their own words",
      rows: [
        ["LinkedIn or portfolio", answers.profileUrl as string],
        ["Earliest availability", answers.availability as string],
        ["Note", answers.coverNote as string],
      ] as Row[],
    },
  ];

  const referenceRows = (label: string, key: string): Row[] => {
    const r = answers[key] as { name?: string; relationship?: string; contact?: string } | undefined;
    if (!r) return [];
    return [
      [`${label} name`, r.name],
      [`${label} relationship`, r.relationship],
      [`${label} contact`, r.contact],
    ] as Row[];
  };

  const references: { heading: string; rows: Row[] }[] = isEngineer
    ? [
        {
          heading: "References, contact only with permission",
          rows: [...referenceRows("First", "referenceOne"), ...referenceRows("Second", "referenceTwo")],
        },
      ]
    : [];

  const sections = isEngineer
    ? [
        {
          heading: "Contact",
          rows: [
            ["Full name", data.fullName],
            ["Email", data.email],
            ["Phone", data.phone],
            ["City", data.city],
            ["State", answers.state as string],
          ] as [string, string | undefined][],
        },
        {
          heading: "Licensure",
          rows: [
            ["Texas PE license", answers.peLicenseNumber as string],
            ["Year first licensed in Texas", answers.yearFirstLicensedTexas as string],
            ["Discipline", answers.discipline as string],
            ["Other state licenses", answers.otherStateLicenses as string],
            ["TDI windstorm appointment", answers.tdiAppointed === "yes" ? "Yes" : "No"],
            ["Willing to obtain a TDI appointment", answers.tdiWilling === "yes" ? "Yes" : "No"],
          ] as [string, string | undefined][],
        },
        {
          heading: "Experience",
          rows: [
            ["Years of structural practice", answers.yearsStructural as string],
            ["Work personally sealed", answers.sealedWork as string],
            ["Current employment status", answers.employmentStatus as string],
            ["Current engineer of record roles", answers.currentEorRoles as string],
          ] as [string, string | undefined][],
        },
      ]
    : [
        {
          heading: "Contact",
          rows: [
            ["Full name", data.fullName],
            ["Email", data.email],
            ["Phone", data.phone],
            ["City", data.city],
            ["County of residence", answers.countyOfResidence as string],
          ] as [string, string | undefined][],
        },
        {
          heading: "Coverage",
          rows: [
            [
              "Counties willing to serve",
              ((answers.countiesServed as string[]) ?? []).join(", "),
            ],
            ["Reliable vehicle", answers.reliableVehicle === "yes" ? "Yes" : "No"],
            ["Willing to climb roofs", answers.willingToClimb === "yes" ? "Yes" : "No"],
          ] as [string, string | undefined][],
        },
        {
          heading: "Experience",
          rows: [
            ["Background", ((answers.backgrounds as string[]) ?? []).join(", ")],
            ["Other background", answers.backgroundOther as string],
            ["Years of relevant experience", answers.yearsExperience as string],
            ["FAA Part 107 drone license", answers.part107 === "yes" ? "Yes" : "No"],
            ["General liability insurance", answers.liabilityInsurance === "yes" ? "Yes" : "No"],
          ] as [string, string | undefined][],
        },
      ];

  const operatorMail = await queueEmail(
    applicationNotification({
      roleLabel,
      positionTitle,
      applicationId: data.applicationId,
      name: data.fullName,
      email: data.email,
      city: (data.city as string) ?? "",
      sections: [...sections, ...aboutYou, ...references],
      documents,
    }),
  );

  const applicantMail = await queueEmail(
    applicantConfirmation({
      roleLabel: positionTitle,
      name: data.fullName,
      email: data.email,
      applicationId: data.applicationId,
      nextStep: isEngineer
        ? "If the fit looks right, the next step is a short call about the work itself: what you seal, and what you will not."
        : "If the fit looks right, the next step is a short call about the counties you would genuinely drive to and what you have inspected before.",
    }),
  );

  /*
   * Both emails leave on the queue. The application row is the record and it is
   * already written; an applicant pressing submit must not wait on two round
   * trips to a mail provider, and a provider outage must not decide whether
   * their application was captured.
   *
   * A failed ENQUEUE is a different thing from a failed send, so it is logged
   * here. A failed SEND is the queue's to show, on the screen built for it.
   */
  if (!operatorMail.ok) console.error(`[apply] operator mail not queued: ${operatorMail.error}`);
  if (!applicantMail.ok) console.error(`[apply] applicant mail not queued: ${applicantMail.error}`);

  return NextResponse.json({ ok: true, applicationId: data.applicationId });
}
