/**
 * THE MESSAGING CENTRE, AND THE THREE THINGS IT MUST NEVER DO.
 *
 *   node scripts/messaging-audit.mjs
 *
 * Section 3 built attachments, a keyboard aware composer, search, honest
 * pagination and read receipts on file threads. Each of those is a way the
 * three standing constraints could be broken, and two of them are new surfaces
 * that did not exist to break them before.
 *
 *   An administrator cannot read a direct message they are not part of.
 *   Everything sends through the job queue rather than in the request.
 *   A technician sees no pricing, in a message or anywhere else.
 *
 * SEARCH IS THE NEW WAY THE FIRST ONE BREAKS. The obvious implementation
 * queries eng_messages and filters the hits, which leaks a count, a timestamp
 * and an author from a conversation the searcher is not in. So the sharpest
 * check here signs in as an administrator, searches for a word that exists ONLY
 * inside a direct message between two other people, and requires nothing back.
 *
 * Against development, with real accounts, because a rule about who can read
 * what is not a rule until somebody has tried.
 */

import fs from "node:fs";
import { readSource } from "./lib/read-source.mjs";
import { createProbe, destroyProbes } from "./lib/portal-probe.mjs";
import { auditClient } from "./lib/db-target.mjs";
import { ProbeLedger } from "./lib/probe-ledger.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3225";

/**
 * Source with comments stripped.
 *
 * Both of the first two failures this file produced were its own explanatory
 * comments: the Attachment doc says "eng-messages AND NOT eng-evidence", and
 * canReadThread says "No administrator override". A grep over raw source read
 * the sentence describing the rule as a violation of it.
 *
 * partner-audit records the same lesson. A check that reads prose is a check
 * that fails on a file for being well documented.
 */
function codeOnly(path) {
  return fs
    .readSource(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

const out = [];
const rec = (name, ok, note = "") => out.push({ name, ok, note });

const db = auditClient("messaging-audit", { neverProduction: true });

/*
 * WHAT THIS RUN CREATES, SO IT CAN REMOVE IT.
 *
 * Before the ledger this audit left a thread and several messages behind on
 * every run, and nothing removed them because nothing knew which were its own.
 * Development held twenty four threads and forty two messages, most of them
 * from runs of this file.
 */
const ledger = new ProbeLedger("messaging-audit");

async function api(cookie, body) {
  const res = await fetch(`${BASE}/api/portal/comms`, {
    method: "POST",
    headers: { cookie: `eng_ops=${cookie}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

/**
 * A SCREEN, not an endpoint.
 *
 * The collected mentions view is a server component with no API behind it, and
 * giving it one so an audit could reach it would be adding product surface to
 * make a test convenient. So this reads the page the person reads, which is
 * also the stronger claim: it fails if the function is right and the screen
 * forgets to render it.
 */
async function screen(cookie, path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { cookie: `eng_ops=${cookie}` },
    redirect: "manual",
  });
  return { status: res.status, html: await res.text().catch(() => "") };
}

console.log("");
console.log("================ THE MESSAGING CENTRE ================");
console.log(`${BASE}\n`);

// Three people: an administrator, and two others who will talk privately.
const admin = await createProbe(BASE, "admin", "messaging-audit");
const engineer = await createProbe(BASE, "engineer", "messaging-audit");
const tech = await createProbe(BASE, "field_tech", "messaging-audit");

rec("three probe accounts signed in", Boolean(admin?.cookie && engineer?.cookie && tech?.cookie));

if (admin?.cookie && engineer?.cookie && tech?.cookie && db) {
  /*
   * A word that exists nowhere else in the database, so a hit can only have
   * come from the message written with it.
   */
  const SECRET = `zqx${Date.now()}private`;

  // ---------------------------------------- a direct message between two others
  const opened = await api(engineer.cookie, { action: "open_direct", profileId: tech.id });
  const threadId = ledger.made("eng_threads", opened.body?.id ?? opened.body?.threadId ?? null);
  rec("an engineer can open a direct thread with a technician", Boolean(threadId), `HTTP ${opened.status}`);

  if (threadId) {
    const posted = await api(engineer.cookie, {
      action: "post_message",
      threadId,
      body: `The gate code is ${SECRET}.`,
    });
    rec("and post to it", posted.body?.ok === true, JSON.stringify(posted.body).slice(0, 90));

    /*
     * THE ADMINISTRATOR NEEDS A CONVERSATION OF THEIR OWN FIRST, and this is
     * not decoration.
     *
     * searchMessages returns early when the actor can read no threads at all.
     * A fresh probe administrator is in none, so the first version of the check
     * below passed because the function never reached its query: removing the
     * readable set filter entirely still produced nothing, and the check
     * reported the rule holding while measuring an early return.
     *
     * With a thread of their own the query runs, and the only thing standing
     * between the administrator and the other two people is the filter.
     */
    const ownThread = await api(admin.cookie, { action: "open_direct", profileId: engineer.id });
    const ownId = ledger.made("eng_threads", ownThread.body?.id ?? ownThread.body?.threadId ?? null);
    if (ownId) {
      await api(admin.cookie, { action: "post_message", threadId: ownId, body: "A conversation of my own." });
    }
    rec(
      "the administrator has a readable conversation, so search does not return early",
      Boolean(ownId),
      "without this the leak check passes by never running the query",
    );

    // ------------------------------------------------- CONSTRAINT ONE, by search
    const search = await api(admin.cookie, { action: "search_messages", text: SECRET });
    const hits = search.body?.results ?? [];
    rec(
      "an administrator searching cannot find a direct message they are not in",
      search.body?.ok === true && hits.length === 0,
      hits.length
        ? `LEAKED ${hits.length}: ${JSON.stringify(hits[0]).slice(0, 120)}`
        : "nothing came back, which is the point",
    );

    // And the same rule the direct way, so the search result is not passing by luck.
    const readAttempt = await api(admin.cookie, { action: "post_message", threadId, body: "reading?" });
    rec(
      "and cannot post into it either",
      readAttempt.body?.ok !== true,
      readAttempt.body?.error ?? `HTTP ${readAttempt.status}`,
    );

    // ------------------------------- and a participant CAN find their own message
    const own = await api(tech.cookie, { action: "search_messages", text: SECRET });
    rec(
      "but a participant finds it",
      (own.body?.results ?? []).length === 1,
      `${(own.body?.results ?? []).length} hit(s); without this the check above passes when search is simply broken`,
    );
  }

  /*
   * ============================================================
   * EVERYTHING ADDRESSED TO YOU, item 5 of docs/messaging-section-3.md.
   *
   * Read off the screen, for three people, because the interesting property is
   * not that a mention appears. It is WHO it appears for:
   *
   *   the person named sees it
   *   a participant who was NOT named does not, or the view is the conversation
   *     again with extra steps
   *   somebody who cannot read the thread at all does not, which is the leak
   *     this feature could most easily introduce: the mention is written into
   *     the message row when it is posted, and what somebody may READ is
   *     decided later and elsewhere
   * ============================================================
   */
  if (threadId) {
    /*
     * Every probe is called "Audit Probe <role>", and a mention matches on the
     * FIRST name, so @audit would name all three and the discrimination below
     * would prove nothing. The technician is renamed to something no other row
     * shares.
     */
    const NAME = `Zqxtech${Date.now()}`;
    await db.from("eng_profiles").update({ display_name: `${NAME} Probe` }).eq("id", tech.id);

    const NAMED = `zqx${Date.now()}named`;
    const said = await api(engineer.cookie, {
      action: "post_message",
      threadId,
      body: `@${NAME.toLowerCase()} the gate code is ${NAMED}.`,
    });
    rec("a message can name somebody on the thread", said.body?.ok === true, said.body?.error ?? "");

    const mine = await screen(tech.cookie, "/portal/messages?view=mentions");
    rec(
      "the person who was named sees it collected in one place",
      mine.status === 200 && mine.html.includes(NAMED),
      `HTTP ${mine.status}${mine.html.includes(NAMED) ? "" : ", the message is not on the page"}`,
    );

    const author = await screen(engineer.cookie, "/portal/messages?view=mentions");
    rec(
      "and a participant who was not named does not, so the view is not the thread again",
      author.status === 200 && !author.html.includes(NAMED),
      author.html.includes(NAMED) ? "the author's own message came back as addressed to them" : "",
    );

    const outsider = await screen(admin.cookie, "/portal/messages?view=mentions");
    rec(
      "and somebody who cannot read the thread does not, mention or no mention",
      outsider.status === 200 && !outsider.html.includes(NAMED),
      outsider.html.includes(NAMED)
        ? "LEAKED: a mention carried a direct message body to an administrator"
        : "the readable set decides it, not the mentions column",
    );

    /*
     * AND IT IS FINDABLE. A collected view nobody knows about is a page nobody
     * opens, so the switch has to be on the conversations view too.
     */
    const conversations = await screen(tech.cookie, "/portal/messages");
    rec(
      "the switch to it sits on the conversations view as well",
      conversations.html.includes("Addressed to you"),
      "a view reachable only by typing a query string is not reachable",
    );
  }

  // ------------------------------------------------ attachments: the write path
  {
    const prep = await api(engineer.cookie, {
      action: "prepare_attachment",
      threadId: threadId ?? "00000000-0000-4000-8000-000000000000",
      contentType: "image/jpeg",
      byteSize: 1024,
    });
    rec("a participant can prepare an attachment upload", prep.body?.ok === true, prep.body?.error ?? "");
    rec(
      "and the key is namespaced by the thread",
      typeof prep.body?.key === "string" && prep.body.key.startsWith(`${threadId}/`),
      prep.body?.key ?? "no key",
    );

    const outsider = await api(admin.cookie, {
      action: "prepare_attachment",
      threadId,
      contentType: "image/jpeg",
      byteSize: 1024,
    });
    rec(
      "somebody who cannot post cannot get an upload url",
      outsider.body?.ok !== true,
      "a signed upload url is a write into the firm's storage, whether or not a message follows",
    );

    const wrongType = await api(engineer.cookie, {
      action: "prepare_attachment",
      threadId,
      contentType: "application/x-msdownload",
      byteSize: 1024,
    });
    rec("an executable cannot be attached", wrongType.body?.ok !== true, wrongType.body?.error ?? "");

    const tooBig = await api(engineer.cookie, {
      action: "prepare_attachment",
      threadId,
      contentType: "image/jpeg",
      byteSize: 40 * 1024 * 1024,
    });
    rec("and neither can a 40MB file", tooBig.body?.ok !== true, tooBig.body?.error ?? "");

    /*
     * THE FORGERY. A caller naming a key that belongs to a different thread
     * must not have it attached, or an attachment can be stolen into a
     * conversation by anybody who learns its key.
     */
    const forged = await api(engineer.cookie, {
      action: "post_message",
      threadId,
      body: "with a borrowed key",
      attachments: [
        {
          key: "00000000-0000-4000-8000-000000000000/stolen.jpg",
          name: "stolen.jpg",
          contentType: "image/jpeg",
          byteSize: 1024,
        },
      ],
    });
    let stored = [];
    if (forged.body?.ok) {
      const { data } = await db.from("eng_messages").select("attachments").eq("id", forged.body.id).single();
      stored = data?.attachments ?? [];
    }
    rec(
      "an attachment key from another thread is dropped, not stored",
      stored.length === 0,
      stored.length ? JSON.stringify(stored).slice(0, 100) : "the message posted with no attachment",
    );
  }

  // ------------------------------------------------------- the bucket is private
  {
    const { data: buckets } = await db.storage.listBuckets();
    const bucket = (buckets ?? []).find((b) => b.name === "eng-messages");
    rec("the messages bucket exists", Boolean(bucket));
    rec(
      "and it is private",
      bucket ? bucket.public === false : false,
      "a public bucket would put property photographs on the open internet",
    );
    /*
     * AND IT IS NOT THE EVIDENCE BUCKET. The reasoning is in section 8 of the
     * messaging report: a conversational photograph that became an evidence
     * item would mean an engineer sealing a package had certified a review of
     * something never presented to them as evidence.
     */
    const source = codeOnly("src/lib/ops-threads.ts");
    rec(
      "message attachments do not go to the evidence bucket",
      !source.includes("eng-evidence"),
      "ops-threads must not touch eng-evidence",
    );
    const api2 = codeOnly("src/app/api/portal/comms/route.ts");
    rec(
      "and neither does the comms API",
      !api2.includes("eng-evidence"),
      "the upload path must not be able to write an evidence object",
    );
  }
}

// --------------------------------------------------------- constraints in code
{
  const threads = codeOnly("src/lib/ops-threads.ts");
  const comms = codeOnly("src/lib/ops-comms.ts");

  /*
   * CONSTRAINT TWO. Nothing here may send an email in the request. raise()
   * writes the notification row and enqueues notification.deliver, and that is
   * the only path a message notification may take.
   */
  rec(
    "messages notify through raise, and raise alone",
    threads.includes("await raise({") && !/queueEmail|sendEmail|resend/i.test(threads),
    "an email sent inside the post is an email that fails while somebody waits",
  );

  /*
   * CONSTRAINT ONE, as the rule rather than as a probe. An administrator
   * override on a direct thread would be one line, and this is the line.
   */
  const direct = comms.slice(comms.indexOf('if (thread.kind === "direct")'), comms.indexOf('if (thread.kind === "channel")'));
  rec(
    "the direct thread rule is participation and nothing else",
    direct.includes("participantIds.includes(actor.id)") && !/role|admin/i.test(direct),
    direct.replace(/\s+/g, " ").slice(0, 110),
  );

  /*
   * CONSTRAINT THREE. Nothing in a thread renders a money field. Today there is
   * nothing to redact, so this asserts the absence rather than a filter: the
   * day somebody quotes a file's figures into a thread, this fails and the
   * redaction has to be built rather than remembered.
   */
  rec(
    "no money field is read into a thread",
    !/price|cents|money|margin/i.test(threads),
    "when a figure first reaches a thread this fails, which is the moment to build the redaction",
  );

  /*
   * And search resolves the readable set FIRST. A search that queried
   * eng_messages and filtered afterwards would leak a count and a timestamp
   * even when it showed nothing.
   */
  const search = threads.slice(threads.indexOf("export async function searchMessages"));
  rec(
    "search resolves what the actor may read before it queries",
    search.indexOf("await listThreads(actor)") < search.indexOf('.from("eng_messages")'),
    "filtering hits afterwards leaks the existence of what it filtered",
  );
}

// ------------------------------------------------------------- point 7, honestly
{
  const composer = fs.readSource("src/components/portal/design/Composer.tsx");
  const client = fs.readSource("src/app/portal/(app)/messages/MessagesClient.tsx");
  rec(
    "the keyboard aware composer is now actually rendered by something",
    client.includes("<KeyboardAwareComposer>"),
    "it was written in Section 2 and used by nothing, so it had never run",
  );
  rec(
    "and it reads visualViewport rather than window resize",
    composer.includes("window.visualViewport") && composer.includes("vv.addEventListener"),
    "on iOS the keyboard does not resize the layout viewport and resize never fires",
  );
  rec(
    "the composer input is at least 16px",
    /text-\[16px\]/.test(client),
    "anything smaller zooms the viewport on focus",
  );
}

// -------------------------------------------- item 8: the binder carries them
{
  /*
   * THE HALF OF THE BUCKET RULING THAT WAS NOT YET TRUE.
   *
   * Section 8 of the messaging report says a conversational photograph is not
   * evidence AND that the firm can still produce it. The first half was built
   * with the bucket; this is the second, and without it the ruling was half a
   * position: the photograph existed somewhere the record did not reach.
   *
   * Asserted on the SHAPE rather than by assembling a binder, because a binder
   * needs a file with a protocol and captures that this audit does not create.
   * What it can assert is that the section exists, that the CSV carries it, and
   * that both say what these attachments are not.
   */
  const binder = codeOnly("src/lib/ops-binder.ts");
  const docs = codeOnly("src/lib/ops-docs.ts");
  const page = fs.readSource("src/app/portal/(app)/documents/binder/[fileId]/page.tsx");

  rec(
    "the binder type carries conversation attachments",
    binder.includes("conversationAttachments: BinderAttachment[]"),
  );
  rec(
    "and the assembly reads them from the file thread only",
    docs.includes('.eq("kind", "file")') && docs.includes("conversationAttachments"),
    "a direct message about the file is not the file's record",
  );
  rec(
    "the binder page renders the section",
    page.includes("Sent in the conversation"),
  );
  /*
   * NORMALISED BEFORE MATCHING. The sentence is split across JSX lines and the
   * first version of this check tried to compensate inside the regex, which
   * failed on prose that was actually present. Flattening the whitespace first
   * is the honest way to ask whether a sentence is on the page.
   */
  const flat = page.replace(/\s+/g, " ");
  rec(
    "and says plainly that they are not evidence",
    flat.includes("were not captured against a protocol item") &&
      flat.includes("not part of what any decision above certifies"),
    "a section without that sentence reads as part of what was certified",
  );

  rec(
    "the CSV carries them under a row that names them",
    binder.includes("SENT IN THE CONVERSATION, NOT EVIDENCE"),
    "a spreadsheet somebody sorts must not mix them into the evidence rows",
  );
  rec(
    "and the storage key is on the document rather than a signed url",
    page.includes("a.storageKey"),
    "a signed url dies in an hour; a key is what somebody fetches by in a year",
  );
}

/*
 * THE ROWS FIRST, THEN THE ACCOUNTS.
 *
 * A message points at an author. Deleting the profile first would either fail
 * on the constraint or orphan the row depending on how it is declared, and
 * which of those happens is not a thing to leave to the constraint.
 *
 * Messages and participants go with the thread, because eng_messages and
 * eng_thread_participants are declared ON DELETE CASCADE from eng_threads. The
 * ledger holds the thread and the database removes what hangs off it, which is
 * the one place a cascade is better than a list.
 */
const held = ledger.count();
const rows = await ledger.sweep();
rec("the rows this run created were removed", rows.ok, rows.note || `${held} row(s)`);
rec(
  "and it created some, so the sweep was not empty",
  held > 0,
  "a sweep with nothing to sweep proves nothing about the sweep",
);

const swept = await destroyProbes("messaging-audit");
rec("the probe accounts were removed", swept.ok, swept.note);

console.log("");
const failed = out.filter((c) => !c.ok);
for (const c of failed) console.log(`  FAIL: ${c.name}${c.note ? ` (${c.note})` : ""}`);
if (failed.length === 0) for (const c of out) console.log(`  PASS: ${c.name}${c.note ? ` (${c.note})` : ""}`);
console.log("");
console.log(
  failed.length
    ? `FAIL: ${failed.length} of ${out.length} checks.`
    : `PASS: ${out.length} checks. Nothing in the messaging centre can be read by somebody it is not for.`,
);
process.exit(failed.length ? 1 : 0);
