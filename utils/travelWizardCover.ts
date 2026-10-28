/** Own-cover candidates only: the API can use a gallery photo as a display cover. */
export function getTravelWizardCoverUrl(...candidates: unknown[]): string | null {
  for (const candidate of candidates.flat()) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const value = candidate.trim();
    // Ignore the query/hash so an own cover's query cannot look like a gallery path.
    const path = value.split(/[?#]/, 1)[0];
    if (/(?:^|\/)gallery\//.test(path)) continue;
    return value;
  }
  return null;
}
