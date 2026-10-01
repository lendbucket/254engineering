/**
 * FORM ABUSE. Operator's sweep spec, the area about putting rubbish into every
 * form and seeing what the product does with it.
 *
 * Four payloads per form: nothing at all, far too much, markup, and the wrong
 * type in every typed field. After each one the page is asked four questions,
 * and each is a different failure:
 *
 *   did the server fall over            a 500 is severity one
 *   was the markup parsed as HTML       an injected element is severity one
 *   did it claim success                accepting rubbish is severity two
 *   did it say nothing at all           a form that neither moves nor explains
 *                                       itself is severity three
 *
 * THE SUBJECT IS DISCOVERED, NEVER LISTED. forms-audit drives four forms by
 * hand, which is correct for assertions about those four and is exactly the
 * shape that cannot notice a fifth. This walks the DOM of every route the sweep
 * already visits and abuses whatever forms it finds, so a form added next month
 * is swept without anybody editing this file. The count of forms found is
 * reported, because a walk that finds none would otherwise pass in silence.
 *
 * NOTHING THAT TAKES MONEY IS PRESSED. The sweep's NEVER_PRESS labels are
 * passed in rather than restated here, matched against the submit control's own
 * visible text, and a form whose button matches is recorded as deliberately
 * skipped with its label. A skipped form is reported, not dropped: the operator
 * asked to know what was not done as well as what was.
 *
 * EVERY ADDRESS IS ON THE RESERVED DOMAIN. Operator ruling, 2026-09-30: a probe
 * address uses `.invalid`, which RFC 2606 reserves and which no mail system can
 * route, and carries no telephone number, so nothing a queued job later drains
 * can reach a person. That is what makes submitting a form that queues mail
 * safe on development, and it is the only reason it is safe.
 */

/* An element that will exist in the DOM only if a string was parsed as HTML.
 * It executes nothing: the test is whether the markup was ESCAPED, and a custom
 * element with no behaviour answers that without running a line of script. */
const MARKUP_TAG = "zzq-sweep-probe";
const MARKUP = `<${MARKUP_TAG} data-sweep="1"></${MARKUP_TAG}>`;

const TOO_MUCH = "Zzq".repeat(2000);

/* Words a success screen uses. Deliberately narrow: a false positive here would
 * report a form as accepting rubbish when it refused it, which is worse than
 * missing one, because it is a claim about behaviour rather than a gap. */
const CLAIMS_SUCCESS = /\b(thank you|we have received|received your|your request has been|submitted|on its way|we will be in touch|check your (email|inbox))\b/i;

/* Something was said about why. Any of these means the form explained itself. */
const SAID_WHY = /\b(required|cannot be empty|enter a|is not valid|too long|must be|please|invalid|we could not|something went wrong|not permitted)\b/i;

/**
 * @param page       a Playwright page, already on the route
 * @param route      the route, for the finding
 * @param role       the principal, for the finding
 * @param find       the sweep's finding collector
 * @param neverPress the sweep's NEVER_PRESS regular expression
 * @returns {Promise<{forms:number, abused:number, skipped:string[]}>}
 */
export async function abuseFormsOn({ page, route, role, find, neverPress, probeAddress }) {
  const result = { forms: 0, abused: 0, skipped: [] };

  const inventory = await page.evaluate(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    return forms.map((form, i) => {
      const submit =
        form.querySelector('button[type="submit"]') ??
        form.querySelector('input[type="submit"]') ??
        form.querySelector("button");
      const fields = Array.from(form.querySelectorAll("input,textarea,select")).map((el) => ({
        name: el.getAttribute("name") ?? el.getAttribute("id") ?? "",
        type: (el.getAttribute("type") ?? el.tagName).toLowerCase(),
        required: el.hasAttribute("required") || el.getAttribute("aria-required") === "true",
      }));
      return {
        index: i,
        label: (submit?.innerText ?? submit?.getAttribute("value") ?? "").trim().slice(0, 60),
        hasSubmit: Boolean(submit),
        fields,
      };
    });
  });

  result.forms = inventory.length;
  if (inventory.length === 0) return result;

  for (const form of inventory) {
    if (!form.hasSubmit) {
      find(route, role, "n/a", `a form with no submit control, ${form.fields.length} field(s)`, 3, "behaviour");
      continue;
    }
    if (neverPress.test(form.label || "submit")) {
      result.skipped.push(`${route} "${form.label}"`);
      continue;
    }
    /* A form with nothing to type into cannot be abused with values. */
    if (form.fields.length === 0) continue;

    const PAYLOADS = [
      { name: "nothing at all", mode: "empty" },
      { name: "far too much text", mode: "long" },
      { name: "markup in every text field", mode: "markup" },
      { name: "the wrong type in every typed field", mode: "wrongtype" },
    ];

    for (const payload of PAYLOADS) {
      /*
       * THE PAGE IS RELOADED BEFORE EACH PAYLOAD, so one abuse cannot be
       * measured through the state another left behind. A sweep that filled
       * four payloads into one live form would report the last one's verdict
       * over the first one's leftovers.
       */
      let before = page.url();
      try {
        await page.goto(before, { waitUntil: "domcontentloaded", timeout: 20_000 });
      } catch {
        /* the route stopped answering; the walk itself already reports that */
        return result;
      }

      const filled = await page.evaluate(
        ({ index, mode, tooMuch, markup, address, tag }) => {
          const form = document.querySelectorAll("form")[index];
          if (!form) return { ok: false, why: "the form was gone after the reload" };
          const els = Array.from(form.querySelectorAll("input,textarea,select"));
          let touched = 0;
          for (const el of els) {
            const type = (el.getAttribute("type") ?? el.tagName).toLowerCase();
            if (type === "hidden" || type === "submit" || type === "button") continue;
            const set = (v) => {
              if (el.tagName === "SELECT") return;
              el.focus();
              el.value = v;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
              touched += 1;
            };
            if (mode === "empty") {
              if (type === "checkbox" || type === "radio") {
                el.checked = false;
                el.dispatchEvent(new Event("change", { bubbles: true }));
                touched += 1;
              } else set("");
            } else if (mode === "long") {
              if (type === "email") set(`${tooMuch.slice(0, 200)}@${tag}.invalid`);
              else if (type === "number") set("9".repeat(40));
              else if (type === "checkbox" || type === "radio") continue;
              else set(tooMuch);
            } else if (mode === "markup") {
              if (type === "email") set(address);
              else if (type === "number" || type === "date" || type === "tel") continue;
              else if (type === "checkbox" || type === "radio") continue;
              else set(markup);
            } else if (mode === "wrongtype") {
              if (type === "number") set("not a number at all");
              else if (type === "date") set("the thirty second of Maytember");
              else if (type === "email") set("this is not an email address");
              else if (type === "tel") set("telephone");
              else if (type === "checkbox" || type === "radio") continue;
              else continue;
            }
          }
          return { ok: true, touched };
        },
        { index: form.index, mode: payload.mode, tooMuch: TOO_MUCH, markup: MARKUP, address: probeAddress, tag: MARKUP_TAG },
      );

      if (!filled.ok || filled.touched === 0) continue;
      result.abused += 1;

      /*
       * THE SERVER'S ANSWER IS CAPTURED FROM THE NETWORK, not guessed from the
       * screen. A form that posts and renders its own error looks identical to
       * one that posted and got a 500 swallowed by an error boundary, and only
       * one of those is a severity one.
       */
      const statuses = [];
      const onResponse = (res) => {
        const u = res.url();
        if (u.startsWith("http") && res.request().method() !== "GET") statuses.push(res.status());
      };
      page.on("response", onResponse);

      try {
        await page.evaluate((index) => {
          const form = document.querySelectorAll("form")[index];
          const submit =
            form?.querySelector('button[type="submit"]') ??
            form?.querySelector('input[type="submit"]') ??
            form?.querySelector("button");
          submit?.click();
        }, form.index);
      } catch {
        page.off("response", onResponse);
        continue;
      }

      await page.waitForTimeout(1200);
      page.off("response", onResponse);

      const after = await page.evaluate(
        (tag) => ({
          url: location.pathname + location.search,
          /* The element exists only if the markup was parsed rather than escaped. */
          markupParsed: document.querySelectorAll(tag).length,
          text: (document.body?.innerText ?? "").slice(0, 4000),
        }),
        MARKUP_TAG,
      );

      const worst = statuses.length > 0 ? Math.max(...statuses) : 0;
      const moved = after.url !== new URL(before).pathname + new URL(before).search;

      if (worst >= 500) {
        find(
          route,
          role,
          "n/a",
          `submitting "${form.label}" with ${payload.name} produced HTTP ${worst} from the handler`,
          1,
          "behaviour",
        );
      }

      if (payload.mode === "markup" && after.markupParsed > 0) {
        find(
          route,
          role,
          "n/a",
          `markup typed into "${form.label}" was parsed as HTML rather than escaped, ${after.markupParsed} element(s) created`,
          1,
          "behaviour",
        );
      }

      /*
       * A 429 MEANS THE INPUT WAS NEVER LOOKED AT, SO THE PAYLOAD PROVED NOTHING.
       *
       * The first run read beautifully and was too generous: four payloads
       * against `/portal/login` reported as "handled", three of them answered
       * 429. The limiter had engaged on the first submission, so payloads two,
       * three and four never reached a line of validation. Recording those as
       * cases the product refused correctly is a green over a test that did not
       * run, which is the thing this sweep exists to avoid.
       *
       * It is the same distinction as "unreachable is not failed", one level in:
       * the limiter working is not evidence about the validator. So the payload
       * reports COULD NOT TELL, and the limiter engaging is reported once as its
       * own severity zero rather than four times as four verdicts.
       */
      if (worst === 429) {
        find(
          route,
          role,
          "n/a",
          `"${form.label}" with ${payload.name} was rate limited before the input was evaluated, so this payload proved nothing about validation. The limiter engaging is itself correct`,
          0,
          "behaviour",
        );
        continue;
      }

      const claimed = CLAIMS_SUCCESS.test(after.text);
      const explained = SAID_WHY.test(after.text);

      if (claimed && payload.mode !== "empty") {
        find(
          route,
          role,
          "n/a",
          `submitting "${form.label}" with ${payload.name} reached a success message, so the value was accepted`,
          2,
          "behaviour",
        );
      } else if (claimed && payload.mode === "empty" && form.fields.some((f) => f.required)) {
        find(
          route,
          role,
          "n/a",
          `submitting "${form.label}" with every field emptied reached a success message while ${form.fields.filter((f) => f.required).length} field(s) are marked required`,
          1,
          "behaviour",
        );
      } else if (!moved && !explained && worst === 0) {
        /*
         * NOTHING WAS SENT AND NOTHING WAS SAID. The hardest of the four to
         * rank. It is not a crash and no wrong data was shown, so it is a dead
         * path: somebody presses the button and the page sits there. Native
         * browser validation on a required field produces exactly this and is
         * correct, which is why it is three rather than two and why the note
         * says what was and was not observed rather than naming a cause.
         */
        find(
          route,
          role,
          "n/a",
          `submitting "${form.label}" with ${payload.name} sent no request, did not move, and showed no message`,
          3,
          "behaviour",
        );
      } else {
        /*
         * SEVERITY ZERO IS ITS OWN ANSWER. CLAUDE.md: a sweep that printed only
         * failures leaves the operator unable to tell a case that passed from
         * one that never ran. These rows are what the forms actually did right.
         */
        find(
          route,
          role,
          "n/a",
          `"${form.label}" with ${payload.name} was handled: ${
            explained ? "it said why" : moved ? "it moved on" : `the handler answered ${worst}`
          }`,
          0,
          "behaviour",
        );
      }
    }
  }

  return result;
}
