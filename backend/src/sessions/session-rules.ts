/**
 * The two rules about a session's place in the world that are worth stating
 * once, in isolation, where they can be read and tested without a database.
 */

/**
 * Whether a `PATCH /sessions/:id` carrying a title is really a rename.
 *
 * The edit dialog submits the title and the date together, so a clinician who
 * only changed the date still sends the title they never touched. Treating
 * that as a rename would silently take the session out of the analyser's hands
 * for good — setting a date is a common action, and it would quietly stop the
 * model from ever naming that session again.
 *
 * So the comparison is against what is stored, not against whether the key was
 * present. A title resubmitted unchanged is not a rename.
 */
export function isRename(current: string, submitted: string | undefined): boolean {
  return submitted !== undefined && submitted.trim() !== current;
}

/**
 * The final order of a client's sessions given the ids the caller sent.
 *
 * `requested` is normally the client's whole list, but it does not have to be.
 * Ids left out keep their relative order and follow the ones that were named,
 * so a list rendered before another tab added a session still reorders the rows
 * the clinician could actually see, instead of failing.
 *
 * Duplicates in `requested` collapse to their first occurrence.
 */
export function resolveOrder(current: string[], requested: string[]): string[] {
  const known = new Set(current);
  const named = [...new Set(requested)].filter((id) => known.has(id));
  const namedSet = new Set(named);

  return [...named, ...current.filter((id) => !namedSet.has(id))];
}
