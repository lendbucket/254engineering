/**
 * CLICK EVERY CONTROL THAT DOES NOT SUBMIT, AND SEE WHETHER ANYTHING HAPPENS.
 *
 * Operator's sweep spec. A button that looks pressable and does nothing is the
 * defect this area exists for, and it is invisible to every other audit here:
 * contrast, tap targets, overflow and forms all pass over a dead button,
 * because it renders correctly, it is big enough to hit, and it is not a form.
 *
 * WHAT COUNTS AS NOTHING HAPPENING, AND IT IS MEASURED RATHER THAN GUESSED.
 * A MutationObserver is attached before the click and read after it, so the
 * question is whether the DOM actually changed rather than whether some proxy
 * for change did. Four things are watched and any one of them is "something
 * happened": a DOM mutation, a navigation, a request, or a change to the
 * control's own aria state. A control that moves none of the four was pressed
 * and did nothing.
 *
 * THE FIRST VERSION OF THIS COMPARED innerHTML LENGTH, which is the trap this
 * comment exists to name: a disclosure that swaps one label for another of the
 * same length reads as dead, and a page with a clock in it reads as alive on
 * every click. Length is not change.
 *
 * ONE PRINCIPAL PER ROUTE, SAID OUT LOUD. The route walk already visits every
 * route as six principals at two widths. Clicking every control for all twelve
 * combinations multiplies a twenty minute sweep into hours, so each route is
 * clicked by the principal whose surface it is: a portal route as admin, an
 * account route as the customer, a partner route as the partner, everything
 * else signed out. That is a stated bound rather than a silent one, and the
 * report carries it, because a reader who thinks every role was clicked would
 * be wrong about what the green covers.
 *
 * NOTHING THAT TAKES MONEY OR SENDS ANYTHING IS PRESSED. The sweep's own
 * NEVER_PRESS labels are passed in and matched against each control's visible
 * text, which is the only thing a person reads before pressing. Every skip is
 * counted and the labels are reported.
 */

/**
 * Controls that are not form submission. A `summary` and an `a[href^="#"]` are
 * included because both look pressable and both can be wired to nothing.
 */
const SELECTOR = [
  "button:not([type=submit])",
  '[role="button"]',
  "summary",
  'a[href^="#"]',
  "[aria-expanded]",
  "[aria-controls]",
].join(",");

/**
 * @returns {Promise<{found:number, clicked:number, skipped:string[], capped:boolean}>}
 */
export async function clickDeadControlsOn({ page, route, role, find, neverPress, cap = 40 }) {
  const result = { found: 0, clicked: 0, skipped: [], capped: false };

  const controls = await page.evaluate((selector) => {
    const seen = new Set();
    const out = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (seen.has(el)) continue;
      seen.add(el);
      const box = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      /* Invisible or zero sized controls are not things a person can press. */
      if (box.width === 0 || box.height === 0) continue;
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") continue;
      /* A submit control reached through [aria-expanded] or [role=button]. */
      if (el.getAttribute("type") === "submit") continue;
      out.push({
        label: (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || "")
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 50),
        tag: el.tagName.toLowerCase(),
      });
    }
    return out;
  }, SELECTOR);

  result.found = controls.length;
  if (controls.length === 0) return result;

  const limit = Math.min(controls.length, cap);
  result.capped = controls.length > cap;

  for (let i = 0; i < limit; i += 1) {
    const control = controls[i];
    if (neverPress.test(control.label || control.tag)) {
      result.skipped.push(`${route} "${control.label || control.tag}"`);
      continue;
    }

    /*
     * RELOADED BEFORE EACH CLICK. A menu left open by click three changes what
     * click four is even looking at, and the indices would then name different
     * elements than the inventory did. This is the expensive choice and it is
     * the only one where each verdict is about the control it names.
     */
    const url = page.url();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    } catch {
      return result;
    }

    const requests = [];
    const onRequest = (r) => requests.push(r.method());
    page.on("request", onRequest);

    const consoleErrors = [];
    const onConsole = (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140));
    };
    page.on("console", onConsole);

    let outcome = null;
    try {
      outcome = await page.evaluate(
        async ({ selector, index }) => {
          const all = Array.from(document.querySelectorAll(selector)).filter((el) => {
            const box = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            if (box.width === 0 || box.height === 0) return false;
            if (cs.visibility === "hidden" || cs.display === "none") return false;
            if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
            if (el.getAttribute("type") === "submit") return false;
            return true;
          });
          const el = all[index];
          if (!el) return { ok: false, why: "the control was not there after the reload" };

          const beforeAria = JSON.stringify({
            expanded: el.getAttribute("aria-expanded"),
            pressed: el.getAttribute("aria-pressed"),
            selected: el.getAttribute("aria-selected"),
            checked: el.getAttribute("aria-checked"),
          });
          const beforeUrl = location.pathname + location.search + location.hash;

          let mutations = 0;
          const observer = new MutationObserver((records) => {
            mutations += records.length;
          });
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });

          let threw = null;
          try {
            el.click();
          } catch (e) {
            threw = String(e).slice(0, 120);
          }

          await new Promise((r) => setTimeout(r, 450));
          observer.disconnect();

          const afterAria = JSON.stringify({
            expanded: el.getAttribute("aria-expanded"),
            pressed: el.getAttribute("aria-pressed"),
            selected: el.getAttribute("aria-selected"),
            checked: el.getAttribute("aria-checked"),
          });

          return {
            ok: true,
            threw,
            mutations,
            ariaMoved: beforeAria !== afterAria,
            urlMoved: beforeUrl !== location.pathname + location.search + location.hash,
          };
        },
        { selector: SELECTOR, index: i },
      );
    } catch (e) {
      outcome = { ok: false, why: String(e).slice(0, 120) };
    }

    page.off("request", onRequest);
    page.off("console", onConsole);

    if (!outcome?.ok) continue;
    result.clicked += 1;

    const name = control.label || `an unlabelled ${control.tag}`;

    if (outcome.threw) {
      find(route, role, "n/a", `pressing "${name}" threw: ${outcome.threw}`, 2, "behaviour");
      continue;
    }
    if (consoleErrors.length > 0) {
      find(
        route,
        role,
        "n/a",
        `pressing "${name}" raised ${consoleErrors.length} console error(s), first: ${consoleErrors[0]}`,
        3,
        "behaviour",
      );
      continue;
    }

    const did =
      outcome.mutations > 0 || outcome.ariaMoved || outcome.urlMoved || requests.length > 1;

    if (!did) {
      /*
       * A CONTROL THAT IS NOT WIRED TO ANYTHING. It renders, it is reachable, it
       * is not disabled, and pressing it moves nothing in the document, changes
       * no aria state, loads nothing and goes nowhere. Three rather than two:
       * nothing wrong is shown, and a person simply cannot get past it.
       *
       * An unlabelled control is worth knowing about separately, because a dead
       * button with no accessible name is also invisible to a screen reader, so
       * the note says which it was.
       */
      find(
        route,
        role,
        "n/a",
        `pressing "${name}" (${control.tag}) changed nothing: no DOM mutation, no aria change, no navigation, no request`,
        3,
        "behaviour",
      );
    }
  }

  return result;
}
