/**
 * The two rules about a session's place in the world that are worth stating
 * once, in isolation, where they can be read and tested without a database.
 */

/**
 * Whether an analysis may write its title onto the session.
 *
 * A re-run is not a reason to undo a rename: `POST /sessions/:id/analyze`
 * exists so an admin can change the prompt or model and regenerate, and a
 * clinician who named a session "Daniel R. — custody disclosure" should not
 * lose that because someone else edited a prompt.
 *
 * A type guard so a true answer also narrows the title away from null.
 */
export function shouldAdoptTitle(modelTitle: string | null, titleCustom: boolean): modelTitle is string {
  return modelTitle !== null && !titleCustom;
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
