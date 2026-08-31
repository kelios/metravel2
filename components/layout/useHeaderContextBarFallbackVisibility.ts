type HeaderContextBarFallbackVisibilityArgs = {
  isMobile: boolean
  pathname: string
  showHeaderContextBar: boolean
}
/**
 * Web fallback height is owned entirely by critical CSS via
 * `data-header-context-fallback`. Its JS visibility prediction never affects
 * the DOM or geometry, so do not pull the breadcrumb/query graph into the
 * synchronous app-shell commit just to compute an ignored value (#1643).
 */
export function useHeaderContextBarFallbackVisibility(
  _args: HeaderContextBarFallbackVisibilityArgs,
): boolean {
  return false
}
