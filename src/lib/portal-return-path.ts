/**
 * WHERE A SIGNED-OUT PERSON WAS GOING, CARRIED FROM THE PROXY TO THE LAYOUT.
 *
 * The portal layout sends somebody whose cookie no longer opens a session to
 * the sign in with `next` set, so they come back to the page they asked for.
 * It read `x-invoke-path`, which Next 16 never sets, so `next` was always
 * `/portal` (BACKLOG, "screen reads that still hide a failure", 2026-10-12).
 *
 * The proxy now stamps the path it let through on the request, under this one
 * header name, and the layout reads it back through `returnPathFrom`, so the
 * name has one home and the value is checked where it is used. The login
 * screen validates `next` again; this is not the only guard against an open
 * redirect, and it is not meant to be.
 */
export const PORTAL_PATH_HEADER = "x-254-portal-path";

/**
 * The path to come back to, or "/portal" when there is none or it is not a
 * portal path on this site. Only a path that starts "/portal" as a whole
 * segment, and carries no backslash (which some browsers read as a slash), is
 * returned. A value starting "//" is refused by the first test already, since
 * it cannot also start "/portal", so there is no separate test for it: one was
 * written, its injection changed nothing, and it was removed (2026-11-17).
 */
export function returnPathFrom(value: string | null | undefined): string {
  if (!value) return "/portal";
  if (!value.startsWith("/portal")) return "/portal";
  if (value.includes("\\")) return "/portal";
  const after = value.slice("/portal".length);
  if (after !== "" && !after.startsWith("/") && !after.startsWith("?")) return "/portal";
  return value;
}
