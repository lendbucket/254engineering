import Link from "next/link";
import { RestrictedMode } from "@/components/portal/design";
import { notFound } from "next/navigation";
import { currentActor } from "@/lib/ops-auth";
import { can, holdsLicence } from "@/lib/ops-authz";
import { packageFor, reviewQueue } from "@/lib/ops-engineer";
import { availableReviewActions, isBriskReview } from "@/lib/ops-review";
import { STATUS_LABEL, type FileStatus } from "@/lib/ops-files";
import { isPrelaunch } from "@/lib/launch";
import { services } from "@/content/services";
import { EmptyState, PageHead } from "@/components/portal/surfaces";
import { readAnswers, outstandingFor } from "@/lib/ops-file-inputs";
import { captureAdditionsFor, filesAwaitingTriage, recordedFactsFor, triageFor } from "@/lib/letter-facts";
import { CatalogueFactsPanel, ElementDescribedReview, FoundationTypeConfirm, TriagePanel } from "@/components/portal/LetterFactsPanels";
import { LETTER_FACT_CATALOGUE } from "@/content/letters/letter-fact-catalogue";
import { DecisionPanel, OpenReviewButton } from "./ReviewClient";
import { LetterSealPanel } from "./LetterSealPanel";
import { OwnDocumentSealPanel } from "./OwnDocumentSealPanel";
import { FileThreadButton } from "@/components/portal/FileThreadButton";
import { OWN_DOCUMENT_PROTOCOLS, lettersAwaitingSeal } from "@/lib/letter-seal";
import { heldFiles } from "@/lib/dispatch-hold";
import { PrereviewPanel } from "./PrereviewPanel";
import { TrainingDecisionPanel } from "./TrainingDecisionPanel";
import { trainingAwaitingEngineer } from "@/lib/certification-record";
import { governingDeclaration } from "@/lib/protocol-run";
import { formatInFirmZone } from "@/lib/firm-calendar";

export const dynamic = "force-dynamic";

/**
 * The review queue and the evidence package.
 *
 * WHAT THIS SCREEN IS FOR
 * -----------------------
 * A licensed engineer deciding whether they will put their seal on a
 * conclusion. Everything on it serves that: the protocol beside the evidence,
 * every photograph at a size worth looking at, the shortfalls named, and every
 * decision given the same weight, declining included.
 *
 * NO COUNT IS WRITTEN DOWN ANYWHERE ON THIS SCREEN, deliberately. The prose here
 * and the lede both said "four" while REVIEW_ACTIONS held five, because a fifth
 * decision was added and the sentences counting them were not. The array is the
 * only place the number lives now.
 *
 * OLDEST SUBMISSION FIRST
 * -----------------------
 * A review queue sorted newest first is one where the awkward file somebody
 * keeps skipping sinks out of sight. The one that has been waiting longest is
 * at the top.
 */

const when = (value: string | null) =>
  value ? (formatInFirmZone(value, { month: "short", day: "numeric" }) ?? "") : null;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const actor = await currentActor();
  if (!holdsLicence(actor, "review.queue")) notFound();
  const params = await searchParams;

  const queue = await reviewQueue(actor);
  const selected = params.id ? await packageFor(actor, params.id) : null;
  /*
   * THE LETTERS HE HAS DECIDED AND NOT YET SEALED, sealing piece two. Every
   * one of his, for the list at the top, and the selected file's, which takes
   * the place of the decision buttons.
   */
  /* A failed read is said above the list, never "no letters waiting" (audit of 2026-10-24). */
  const awaitingRead = await lettersAwaitingSeal(actor);
  const awaiting = awaitingRead.ok ? awaitingRead.letters : [];
  const held = await heldFiles();
  const trainingWaiting = await trainingAwaitingEngineer();
  const awaitingTriage = await filesAwaitingTriage();
  const selectedAwaiting = selected ? awaiting.filter((l) => l.fileId === selected.file.id) : [];
  /*
   * Every letter waiting for his seal can be sealed here (F14, Robert's answer
   * of 2026-10-25): roof repairs-required and decline letters were listed as
   * waiting with no screen that could seal them. Their attached schedule or
   * record now prints as a page of the same PDF.
   */
  const sealable = selectedAwaiting[0] ?? null;

  /*
   * RULING 7 OF 2026-10-23: WHAT THE FOUNDATION OR PERMIT LETTER WILL PRINT
   * THAT HE CONFIRMS HERE. The foundation type (FC-3) and the element described
   * (PL-3) from the order beside what he has recorded; the authority's details
   * the office recorded (PL-2); and his triage and capture items (PL-4, PL-5).
   * Read only for those two lines.
   */
  const letterLine = selected?.file.service_slug === "foundation-inspections" || selected?.file.service_slug === "structural-letters";
  const letterAnswersRead = selected && letterLine ? await readAnswers(selected.file.id) : null;
  const letterAnswers = letterAnswersRead?.ok ? letterAnswersRead.answers : {};
  /* A failed answers read shows the panel's own "could not be read" sentence, never "No authority on the order" (finding F12). */
  const letterFacts = selected && letterLine && letterAnswersRead?.ok ? await recordedFactsFor(selected.file.id) : null;
  /*
   * ITEM B OF ROBERT'S RULING OF 2026-10-25, 23:51 CENTRAL: THE MANUFACTURED
   * HOME AND SOLAR LETTERS PRINT THE FACTS 0087 RECORDS. He records his here,
   * at review; the office's (the solar letter's purpose as stated) show beside
   * them as the office recorded them. Read only for those two lines.
   */
  const catalogueLine =
    selected?.file.service_slug === "manufactured-home-foundation-certifications"
      ? "254-MH-001"
      : selected?.file.service_slug === "solar-structural-letters"
        ? "254-SL-001"
        : null;
  const catalogueRecorded = selected && catalogueLine ? await recordedFactsFor(selected.file.id) : null;
  const catalogueFacts = catalogueLine ? LETTER_FACT_CATALOGUE.filter((f) => f.line === catalogueLine) : [];
  const letterTriage = selected?.file.service_slug === "structural-letters" ? await triageFor(selected.file.id) : null;
  const letterAdditions = selected?.file.service_slug === "structural-letters" ? await captureAdditionsFor(selected.file.id) : null;

  /*
   * WHAT THE ENGINEER IS STILL MISSING, asked at the sealing stage.
   *
   * Phase 10 Section 1.5 Section C item 3. The same outstandingFor the file
   * screen and the dispatch panel call, reading the same definition, so a job
   * cannot look ready on one screen and incomplete on another.
   *
   * This is the ADMINISTRATIVE half only. What evidence an engineer needs
   * before sealing is the protocol's business and all but one service line
   * still has no protocol; what a document needs in order to be issued to the
   * right party is knowable now, and missing it is what causes a reissue.
   */
  const outstanding = selected
    ? await outstandingFor(
        selected.file.id,
        selected.file.service_slug,
        (selected.file as { deliverable?: string | null }).deliverable ?? null,
        "seal",
      )
    : null;
  const serviceName = (slug: string) => services.find((s) => s.slug === slug)?.name ?? slug;

  const actions = selected
    ? availableReviewActions(
        actor,
        {
          status: selected.file.status as FileStatus,
          packageComplete: selected.complete,
          /* The file's assignee, so another engineer's file shows its actions refused (2026-10-10). */
          assignedEngineerId: selected.file.assigned_engineer_id ?? null,
        },
        { prelaunch: isPrelaunch() },
      )
    : [];

  return (
    <>
      <PageHead
        eyebrow="Engineering"
        title="Review queue"
        /*
          THE COUNT IS GONE FROM THE SENTENCE AND THAT IS THE FIX.
          It read "Four decisions" and REVIEW_ACTIONS holds five: seal,
          revisions, site_visit, repairs, refuse. A fifth was added and the
          sentence counting them was not, so the engineer's own screen told him
          there were four of the buttons in front of him.

          One fact with two homes, in its cheapest form: a number in an array and
          the same number spelled out in prose. The answer here is not to write
          "five", which drifts again the next time, and not to derive a number
          word for one sentence. It is that the count was never the point. What
          the sentence is for is the parity, and the parity is true at any
          length.
        */
        lede="Evidence packages waiting on a decision, longest waiting first. Declining to seal carries the same weight as sealing."
      />

      <RestrictedMode also="Packages can still be reviewed, sent back and declined. Declining stays available on purpose: a gate that stopped an engineer saying no, while leaving yes open, would be the wrong way round." />

      {/*
        HELD BEFORE DISPATCH, operator ruling 1 of 2026-10-07. A yes to RC-001's
        questions 8 to 12 holds a job here until he accepts or declines it. A
        failed read says so rather than showing an empty list, because an
        empty list would tell him nothing is waiting.
      */}
      {!held.ok ? (
        <p role="alert" className="mb-6 text-[14px] text-[var(--ink)]">
          Jobs held before dispatch could not be read: {held.error}
        </p>
      ) : held.files.length > 0 ? (
        <section className="mb-6 border-t-2 border-[var(--ink)] pt-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Held before dispatch</h2>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">
            The customer answered yes to a question the protocol routes to you. Nobody is sent until you accept or decline.
          </p>
          <ul className="mt-2 border-t border-[var(--row-rule)]">
            {held.files.map((f) => (
              <li key={f.id} className="border-b border-[var(--row-rule)] py-3">
                <p className="text-[14px] text-[var(--ink)]">
                  <span className="font-semibold">{f.fileNumber}</span>, {f.address}
                </p>
                <ul className="mt-1">
                  {f.questions.map((q) => (
                    <li key={q.number} className="text-[14px] leading-[1.6] text-[var(--secondary)]">
                      {q.question}
                      {q.standingRuling ? <span className="block font-semibold text-[var(--ink)]">{q.standingRuling}</span> : null}
                    </li>
                  ))}
                </ul>
                <PrereviewPanel fileId={f.id} fileNumber={f.fileNumber} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        CERTIFICATIONS AWAITING YOUR APPROVAL, operator ruling of 2026-10-07. A
        certification from supervised training counts for dispatch only once
        the engineer of record approves it here. A failed read says so.
      */}
      {!trainingWaiting.ok ? (
        <p role="alert" className="mb-6 text-[14px] text-[var(--ink)]">
          Certifications awaiting your approval could not be read: {trainingWaiting.error}
        </p>
      ) : trainingWaiting.records.length > 0 ? (
        <section className="mb-6 border-t-2 border-[var(--ink)] pt-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Certifications awaiting your approval</h2>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">
            Recorded by an administrator from supervised training. The technician is not offered work on the line until you approve.
          </p>
          <ul className="mt-2 border-t border-[var(--row-rule)]">
            {trainingWaiting.records.map((t) => (
              <li key={t.id} className="border-b border-[var(--row-rule)] py-3">
                <p className="text-[14px] text-[var(--ink)]">
                  <span className="font-semibold">{t.technician}</span>,{" "}
                  {services.find((s) => s.slug === t.serviceSlug)?.name ?? t.serviceSlug}
                </p>
                <p className="text-[14px] leading-[1.6] text-[var(--secondary)]">
                  Supervised training on v{t.protocolVersion}, {t.trainedOn}, supervised by {t.supervisedBy}.
                </p>
                <TrainingDecisionPanel recordId={t.id} technician={t.technician} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* PL-4 and PL-5, ruling 7 of 2026-10-23: permit letter jobs waiting for his site or desk decision. */}
      {!awaitingTriage.ok ? (
        <p role="alert" className="mb-6 text-[14px] text-[var(--ink)]">
          Permit letter jobs waiting for triage could not be read: {awaitingTriage.error}
        </p>
      ) : awaitingTriage.files.length > 0 ? (
        <section className="mb-6 border-t-2 border-[var(--ink)] pt-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Permit letter jobs waiting for your triage</h2>
          <p className="mt-1 text-[14px] text-[var(--secondary)]">
            Record each as a site job or a desk job within a business day of the order, and add anything the technician
            should capture beyond the protocol&apos;s items. The letter&apos;s basis sentence comes from this record.
          </p>
          <ul className="mt-2 border-t border-[var(--row-rule)]">
            {awaitingTriage.files.map((f) => (
              <li key={f.id} className="border-b border-[var(--row-rule)] py-3">
                <p className="text-[14px] text-[var(--ink)]">
                  <span className="font-semibold">{f.fileNumber}</span>, {f.address}
                </p>
                <TriagePanel fileId={f.id} basis={null} additions={f.additions} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!awaitingRead.ok ? (
        <p role="alert" className="mb-6 text-[14px] text-[var(--ink)]">
          Letters waiting for your seal could not be read, so none is offered for sealing just now: {awaitingRead.error}
        </p>
      ) : awaiting.length > 0 ? (
        <section className="mb-6 border-t-2 border-[var(--ink)] pt-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Letters waiting for your seal</h2>
          <ul className="mt-2 border-t border-[var(--row-rule)]">
            {awaiting.map((l) => (
              <li key={l.determinationId} className="border-b border-[var(--row-rule)]">
                <Link
                  href={`/portal/review?id=${l.fileId}`}
                  className="flex min-h-[48px] items-center justify-between gap-3 py-2 text-[14px] text-[var(--ink)] hover:underline"
                >
                  <span className="font-semibold">{l.fileNumber}</span>
                  <span className="text-[var(--secondary)]">
                    {l.propertyAddress}, {l.determination.replace("-", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <div className={selected ? "hidden lg:block" : "block"}>
          {queue === null ? (
            <p role="alert" className="text-[14px] leading-[1.6] text-[var(--ink)]">
              The review queue could not be read just now, so whether anything is waiting is not known. Reload the page; nothing was changed.
            </p>
          ) : queue.length === 0 ? (
            <EmptyState
              title="Nothing waiting"
              body="A file arrives here when a technician submits a complete evidence package. It stays until an engineer decides it."
            />
          ) : (
            /*
              V10: ruled rows, not cards. No border, no radius, no shadow, and
              the selected row is a navy left marker over a flat fill rather
              than a highlighted box.

              THE STATUS CHIP IS GONE AND THE STATUS IS NOT. STATUS_TONE maps a
              file state onto good, bad and warn, which V10 removes from the
              interface entirely: "urgency is shown with weight and words, never
              with colour, dots, badges or tinted boxes". STATUS_LABEL is the
              words, and it is what survives. Dropping the label with the chip
              would have been the restyle quietly deleting information, which is
              the one thing this port is forbidden to do.
            */
            <ul className="border-t border-[var(--row-rule)]">
              {queue.map((f) => {
                const open = selected?.file.id === f.id;
                return (
                  <li key={f.id} className="border-b border-[var(--row-rule)]">
                    <Link
                      href={`/portal/review?id=${f.id}`}
                      className={`block border-l-2 py-3.5 pr-3 transition-colors ${
                        open
                          ? "border-[var(--navy)] bg-[var(--canvas)] pl-3"
                          : "border-transparent pl-3 hover:bg-[var(--canvas)]"
                      }`}
                    >
                      <p className="text-[12px] text-[var(--secondary)]">{f.file_number}</p>
                      <p className="mt-0.5 text-[15px] leading-[1.3] font-semibold text-[var(--ink)]">
                        {f.property_address}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--secondary)]">
                        {f.county} County, {serviceName(f.service_slug)}
                      </p>
                      <p className="mt-1 text-[13px] font-semibold text-[var(--ink)]">
                        {STATUS_LABEL[f.status as FileStatus] ?? f.status}
                      </p>
                      {when(f.evidence_submitted_at) ? (
                        <p className="mt-0.5 text-[12px] text-[var(--secondary)]">
                          Submitted {when(f.evidence_submitted_at)}
                          {f.revision_count > 0
                            ? `, ${f.revision_count} revision${f.revision_count === 1 ? "" : "s"} so far`
                            : ""}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <div>
            <Link
              href="/portal/review"
              className="mb-4 inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--secondary)] lg:hidden"
            >
              Back to the queue
            </Link>

            {outstanding && outstanding.now.length > 0 ? (
              /*
                V10 removes notices and banners: "status goes in a plain line of
                text", and no tinted boxes. This was a gold washed panel and is
                now a section, which is a heading with a 2px ink rule under it.

                It loses nothing. The tint was never what made this urgent; the
                sentence under it is, and it is still there in full.
              */
              <section className="mb-6">
                <h2 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
                  This package is missing information the document needs
                </h2>
                <ul className="mt-3">
                  {outstanding.now.map((f) => (
                    <li
                      key={f.id}
                      className="border-b border-[var(--row-rule)] py-2 text-[14px] leading-[1.5] font-semibold text-[var(--ink)]"
                    >
                      {f.label}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.55] text-[var(--secondary)]">
                  A sealed document addressed to the wrong party has to be reissued. Ask for these
                  before deciding, not after.
                </p>
              </section>
            ) : null}

            <div>
              <div className="pb-5">
                {/*
                  V10 page head: title, then a META LINE of plain items separated
                  by space. The three chips are gone and all three facts remain,
                  as words, in the order an engineer would ask them: what state
                  the file is in, whether the package is complete, and whether
                  this is a windstorm county.

                  "4 missing" WAS A RED CHIP AND IS NOW BOLD INK. That is the
                  whole of V10's rule about urgency, and it is the right rule
                  here for a reason beyond house style: a red chip reading
                  "4 missing" sits beside a green one reading "Package complete"
                  on a screen where the two can never both be true, so the colour
                  was carrying no information the word did not.
                */}
                <p className="text-[12px] text-[var(--secondary)]">{selected.file.file_number}</p>
                <h2 className="mt-1 text-[24px] leading-[1.2] font-semibold tracking-[-0.4px] text-[var(--ink)]">
                  {selected.file.property_address}
                </h2>
                <p className="mt-2 text-[14px] leading-[1.6] text-[var(--secondary)]">
                  {selected.file.city ? `${selected.file.city}, ` : ""}
                  {selected.file.county} County
                  {selected.protocolName ? `, worked to ${selected.protocolName}` : ""}
                  {selected.technician ? `, captured by ${selected.technician.name}` : ""}
                </p>
                <p className="mt-1 text-[14px] leading-[1.6] text-[var(--ink)]">
                  <span className="font-semibold">
                    {STATUS_LABEL[selected.file.status as FileStatus] ?? selected.file.status}
                  </span>
                  <span className="pl-5 font-semibold">
                    {selected.complete ? "Package complete" : `${selected.blockers.length} missing`}
                  </span>
                  {selected.file.twia_county ? <span className="pl-5">Windstorm county</span> : null}
                </p>
                {can(actor, "messages.use") ? (
                  <div className="mt-3">
                    <FileThreadButton fileId={selected.file.id} />
                  </div>
                ) : null}

                {selected.session ? (
                  <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.55] text-[var(--secondary)]">
                    In review for {selected.session.minutesSoFar} minute
                    {selected.session.minutesSoFar === 1 ? "" : "s"}. The elapsed time goes on your
                    responsible charge record.
                    {isBriskReview(selected.session.minutesSoFar)
                      ? " Anything under three minutes is flagged on your own record, not blocked."
                      : ""}
                  </p>
                ) : null}
              </div>

              {selected.file.status === "refused" && selected.file.refusal_reason ? (
                /*
                  A DECLINE IS THE MOST SERIOUS THING ON THIS SCREEN AND IT IS
                  NOT RED. It was amber tinted with red text, which V10 removes
                  outright. What carries it now is a section heading at the top
                  of the file and the engineer's own words at full size, which is
                  more prominent than the tint was, not less: the reason is the
                  evidence of judgment and it reads as body copy rather than as a
                  warning somebody skims.
                */
                <section className="mb-6">
                  <h3 className="border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
                    Declined to seal
                  </h3>
                  <p className="mt-3 max-w-[70ch] text-[15px] leading-[1.6] text-[var(--ink)]">
                    {selected.file.refusal_reason}
                  </p>
                </section>
              ) : null}

              <div>
                {!selected.session && selected.file.status !== "refused" ? (
                  <OpenReviewButton fileId={selected.file.id} status={selected.file.status} />
                ) : null}

                <h3 className="mt-5 border-b-2 border-[var(--ink)] pb-2 text-[15px] font-semibold text-[var(--ink)]">
                  Evidence
                </h3>

                {selected.items.length === 0 ? (
                  <p className="mt-3 text-[14px] text-[var(--secondary)]">
                    No protocol is attached to this file, so there is nothing to review against.
                  </p>
                ) : (
                  <ol className="mt-1 border-t border-[var(--row-rule)]">
                    {selected.items.map((item, i) => (
                      <li
                        key={item.id}
                        /*
                         * AN EXCEPTED ITEM IS NOT GREEN. It satisfied the gate
                         * and it is not a photograph, and Appendix C asks the
                         * engineer to notice the difference: REVISE's criteria
                         * include "Exception used where the condition plainly
                         * applied", which he cannot apply to an item the screen
                         * has painted the same colour as a captured one.
                         */
                        className="border-b border-[var(--row-rule)] py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-[14px] leading-[1.4] font-semibold text-[var(--ink)]">
                            {i + 1}. {item.label}
                            {item.required ? "" : " (optional)"}
                          </p>
                          {/*
                            THE FOUR STATES WERE THREE COLOURS AND A DEFAULT, AND
                            THEY ARE NOW FOUR SENTENCES. V10 removes colour as
                            meaning, and on this screen that is not a style
                            question: the comment above records that an excepted
                            item must not read as a captured one, because
                            Appendix C asks the engineer to notice "exception
                            used where the condition plainly applied". A tint he
                            has to decode is a poor way to carry that and a word
                            is a good one.

                            SATISFIED GAINED A WORD IT DID NOT HAVE. Under the
                            old styling a captured item said nothing at all and
                            was identified by a green edge, so taking the colour
                            away without adding "Captured" would have left the
                            commonest state on the screen with no signal
                            whatsoever. That is the restyle deleting information,
                            which this port is forbidden to do, and it is the
                            trap in every one of these conversions.
                          */}
                          {item.exception ? (
                            <p className="text-[14px] font-semibold text-[var(--ink)]">
                              {item.exception.kind === "not_applicable"
                                ? "Not applicable"
                                : "Could not be observed"}
                            </p>
                          ) : item.satisfied ? (
                            <p className="text-[14px] text-[var(--secondary)]">Captured</p>
                          ) : item.problem ? (
                            <p className="text-[14px] font-semibold text-[var(--ink)]">{item.problem}</p>
                          ) : item.required ? (
                            <p className="text-[14px] font-semibold text-[var(--ink)]">Not captured</p>
                          ) : (
                            <p className="text-[14px] text-[var(--secondary)]">Not captured</p>
                          )}
                        </div>
                        {item.exception ? (
                          <p className="mt-1.5 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
                            The technician recorded: &ldquo;{item.exception.reason}&rdquo;
                          </p>
                        ) : null}
                        {item.instructions ? (
                          <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.5] text-[var(--secondary)]">
                            {item.instructions}
                          </p>
                        ) : null}

                        {item.captures.length > 0 ? (
                          <ul className="mt-3 flex flex-wrap gap-3">
                            {item.captures.map((c) => (
                              <li key={c.id}>
                                {!c.url && c.storageKey ? (
                                  /*
                                   * A photograph whose file could not be
                                   * loaded. It must NOT fall through to the
                                   * text fallback below, which would render
                                   * the word "Captured" and leave an engineer
                                   * believing they had looked at an image they
                                   * never saw. Sealing on that basis is the
                                   * failure this whole screen exists to
                                   * prevent.
                                   */
                                  /*
                                    THE ONE PLACE ON THIS SCREEN WHERE LOSING RED
                                    HAD TO BE THOUGHT ABOUT, because this is the
                                    sentence that stops an engineer sealing on a
                                    photograph he never saw.

                                    It keeps every bit of its prominence and gets
                                    it from weight and a 2px ink border instead of
                                    a red one on an amber tint. The words were
                                    always what did the work: "Do not seal on it"
                                    is not a sentence anybody reads past because
                                    of its colour.
                                  */
                                  <p className="flex h-40 w-40 items-center justify-center border-2 border-[var(--ink)] px-3 text-center text-[13px] leading-[1.4] font-semibold text-[var(--ink)]">
                                    This file could not be loaded. Do not seal on it.
                                  </p>
                                ) : c.url ? (
                                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="block">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={c.url}
                                      alt={`${item.label}, captured ${c.capturedAt ?? "at an unrecorded time"}`}
                                      className="h-40 w-40 rounded-[2px] border border-[var(--border)] object-cover"
                                    />
                                    {/*
                                      254-RC-001 SECTION 9, THE THIRD TIME
                                      VALUE. A disagreeing clock is "recorded
                                      as disagreeing rather than presented as
                                      certain", and this is where it is
                                      presented, to the person deciding what
                                      the evidence supports.

                                      A DISAGREEMENT IS SHOWN LOUDLY AND
                                      AGREEMENT IS NOT SHOWN AT ALL. Printing
                                      "clocks agreed" under every photograph
                                      would be a line everybody stops reading,
                                      which is how the one that matters gets
                                      missed. The unmeasured case is also
                                      shown, because a row with no reading is
                                      not a row that agreed.
                                    */}
                                    {c.clockDisagrees === true ? (
                                      <span className="mt-1 block text-[12px] font-semibold text-[var(--ink)]">
                                        {c.clockSentence}
                                      </span>
                                    ) : c.clockDisagrees === null ? (
                                      <span className="mt-1 block text-[12px] text-[var(--secondary)]">
                                        {c.clockSentence}
                                      </span>
                                    ) : null}
                                    {c.lat !== null && c.lng !== null ? (
                                      <span className="mt-1 block text-[12px] text-[var(--secondary)]">
                                        {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                                      </span>
                                    ) : (
                                      <span className="mt-1 block text-[12px] text-[var(--secondary)]">
                                        No location recorded
                                      </span>
                                    )}
                                  </a>
                                ) : (
                                  <p className="border-l-2 border-[var(--border)] py-1 pl-3 text-[14px] text-[var(--ink)]">
                                    {c.valueNumber !== null
                                      ? `${c.valueNumber}${c.unit ? ` ${c.unit}` : ""}`
                                      : (c.valueText ?? "Captured")}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                )}

                {letterLine ? (
                  <div className="mt-7 border-t border-[var(--border)] pt-6">
                    <p className="portal-label">What the letter will print, for you to confirm</p>
                    {!letterFacts ? (
                      <p className="mt-2 text-[14px] text-[var(--ink)]">The letter&apos;s recorded facts could not be read just now. Reload the page; nothing was changed.</p>
                    ) : selected.file.service_slug === "foundation-inspections" ? (
                      <FoundationTypeConfirm
                        fileId={selected.file.id}
                        fromIntake={letterAnswers.foundation_type ?? null}
                        confirmed={letterFacts.foundation_type?.value ?? null}
                      />
                    ) : (
                      <>
                        <ElementDescribedReview
                          fileId={selected.file.id}
                          category={letterAnswers.element_category ?? null}
                          fromIntake={letterAnswers.element_described ?? null}
                          reviewed={letterFacts.element_described?.value ?? null}
                        />
                        <div className="mt-5">
                          <p className={"text-[14px] font-semibold text-[var(--ink)]"}>The authority, as the office recorded it</p>
                          <p className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
                            {letterAnswers.authority_name ?? "No authority on the order."}
                            {letterAnswers.permit_number ? `, permit ${letterAnswers.permit_number}` : ""}
                          </p>
                          <p className="mt-1 max-w-[70ch] whitespace-pre-line text-[14px] leading-[1.55] text-[var(--secondary)]">
                            {letterFacts.authority_address?.value ?? "The office has not recorded the authority's address."}
                            {"\n"}
                            {letterFacts.authority_salutation?.value ? `Salutation: ${letterFacts.authority_salutation.value}` : "No salutation recorded."}
                          </p>
                        </div>
                        <div className="mt-5">
                          <p className={"text-[14px] font-semibold text-[var(--ink)]"}>Site job or desk job</p>
                          {letterTriage && letterTriage.ok && letterAdditions && letterAdditions.ok ? (
                            <TriagePanel fileId={selected.file.id} basis={letterTriage.basis} additions={letterAdditions.items} />
                          ) : (
                            <p className="mt-2 text-[14px] text-[var(--ink)]">The triage could not be read just now. Reload the page; nothing was changed.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : null}

                {catalogueLine ? (
                  <div className="mt-7 border-t border-[var(--border)] pt-6">
                    <p className="portal-label">What the letter will print, for you to record</p>
                    {!catalogueRecorded ? (
                      <p className="mt-2 text-[14px] text-[var(--ink)]">The letter&apos;s recorded facts could not be read just now. Reload the page; nothing was changed.</p>
                    ) : (
                      <>
                        {catalogueFacts.some((f) => f.capacity === "office") ? (
                          <div className="mt-3">
                            <p className="text-[14px] font-semibold text-[var(--ink)]">As the office recorded them</p>
                            {catalogueFacts
                              .filter((f) => f.capacity === "office")
                              .map((f) => (
                                <p key={f.key} className="mt-1 max-w-[70ch] text-[14px] leading-[1.55] text-[var(--ink)]">
                                  {f.label}: {catalogueRecorded[f.key]?.value ?? <span className="text-[var(--secondary)]">not recorded yet, so the letter cannot be drafted</span>}
                                </p>
                              ))}
                          </div>
                        ) : null}
                        <CatalogueFactsPanel
                          fileId={selected.file.id}
                          capacity="engineer"
                          facts={catalogueFacts
                            .filter((f) => f.capacity === "engineer")
                            .map((f) => ({ key: f.key, label: f.label, values: f.values, recorded: catalogueRecorded[f.key]?.value ?? null }))}
                        />
                      </>
                    )}
                  </div>
                ) : null}

                <div className="mt-7 border-t border-[var(--border)] pt-6">
                  {/*
                    A RECORDED PASS WAITS FOR HIS SEAL, AND THE DECISION
                    BUTTONS DO NOT COME BACK. Since 2026-10-07 a passing
                    decision leaves the file under review until the letter is
                    sealed; showing the five decisions again would invite a
                    second determination on a file that already has one, and
                    decideReview refuses that anyway.
                  */}
                  {/*
                    THE ROOF SHOWS ITS PASS ONLY, AS IT ALWAYS HAS. A foundation
                    or permit file shows whichever of its determinations produces
                    a letter (ruling 7 of 2026-10-23): his foundation decline is a
                    sealed option C letter, and his permit repairs letter option C.
                  */}
                  {/* A repair specification is his own document: he uploads it rather than reading a draft (item C, 2026-10-25). */}
                  {sealable && (OWN_DOCUMENT_PROTOCOLS as readonly string[]).includes(sealable.protocolDocument) ? (
                    <OwnDocumentSealPanel determinationId={sealable.determinationId} fileNumber={selected.file.file_number} />
                  ) : sealable ? (
                    <LetterSealPanel
                      determinationId={sealable.determinationId}
                      determination={sealable.determination}
                      fileNumber={selected.file.file_number}
                      protocol={sealable.protocolDocument}
                    />
                  ) : (
                  <DecisionPanel
                    fileId={selected.file.id}
                    actions={actions}
                    complete={selected.complete}
                    blockers={selected.blockers}
                    inReview={Boolean(selected.session)}
                    protocolDocument={selected.protocolDocument}
                    /*
                     * THE RULES COME FROM THE REGISTRY, which is the verbatim
                     * transcription protocol-registry-audit compares against
                     * the signed PDF. A second list typed for this screen would
                     * be a paraphrase of Appendix C in front of the man applying
                     * it, which is the worst place for one.
                     *
                     * Empty when no signed protocol governs the file, and then
                     * the panel does not ask for a determination at all. Since
                     * 2026-10-23, 254-FC-001 and 254-PL-001 read their Appendix C
                     * from the structured declaration he signed in the portal
                     * (governingDeclaration), the same text decideReview reads.
                     */
                    determinationRules={[
                      ...(governingDeclaration(selected.protocolDocument, selected.protocolStatus)?.determinations ?? []),
                    ]}
                    items={selected.items.map((i) => ({
                      itemKey: i.itemKey,
                      label: i.label,
                      captures: i.captures.map((c) => ({ id: c.id })),
                    }))}
                  />
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:block">
            <EmptyState
              title="No package open"
              body="Choose a file from the queue. The protocol, every photograph, and the shortfalls are on one screen, because deciding whether to seal is one decision."
            />
          </div>
        )}
      </div>
    </>
  );
}
