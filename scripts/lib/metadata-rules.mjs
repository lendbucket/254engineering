/**
 * The title and description budget, in one home.
 *
 * seo-audit applies these to every page it renders from the sitemap, and the
 * preflight's static proof applies them to every title and description the
 * site declares in code, before any server runs. Moved here on 2026-10-30
 * after board 41099813913 missed on "/guides: description has no call to
 * action", a rule nothing could check without rendering the page. The values
 * and the sentences are seo-audit's own, unchanged.
 *
 * A title is 50 to 60 characters including the brand suffix (CLAUDE.md
 * section 4). The floor is the half the audit was once missing: a 39
 * character title leaves a third of the SERP line unused and the brand never
 * appears in it. A description is 140 to 160 characters and ends somewhere a
 * reader can act.
 */
export const MIN_TITLE = 50;
export const MAX_TITLE = 60;
export const MIN_DESC = 140;
export const MAX_DESC = 160;

/** A description has to end somewhere a reader can act. */
export const CTA_VERB = /\b(?:join|see|read|apply|send|call|contact|start|ask|request|explore|compare)\b/i;

/** Every finding on one page's title, in seo-audit's words. */
export function titleProblems(route, title) {
  if (!title) return [`${route}: no <title>`];
  if (title.length > MAX_TITLE) return [`${route}: title is ${title.length} chars, over ${MAX_TITLE} ("${title}")`];
  if (title.length < MIN_TITLE) return [`${route}: title is only ${title.length} chars, under ${MIN_TITLE} ("${title}")`];
  if (!title.includes("254 Engineering")) return [`${route}: title carries no brand suffix ("${title}")`];
  return [];
}

/** Every finding on one page's description, in seo-audit's words. */
export function descriptionProblems(route, description) {
  if (!description) return [`${route}: no meta description`];
  if (description.length > MAX_DESC) return [`${route}: description is ${description.length} chars, over ${MAX_DESC}`];
  if (description.length < MIN_DESC) return [`${route}: description is only ${description.length} chars, under ${MIN_DESC}`];
  if (!CTA_VERB.test(description)) return [`${route}: description has no call to action ("${description.slice(-48)}")`];
  return [];
}

/**
 * Duplicates across pages. Each map is value to the routes carrying it, in the
 * order the caller met them.
 */
export function duplicateProblems(titles, descriptions) {
  const out = [];
  for (const [title, where] of titles) {
    if (where.length > 1) out.push(`duplicate title on ${where.join(", ")}: "${title}"`);
  }
  for (const [description, where] of descriptions) {
    if (where.length > 1)
      out.push(`duplicate description on ${where.join(", ")}: "${description.slice(0, 60)}..."`);
  }
  return out;
}
