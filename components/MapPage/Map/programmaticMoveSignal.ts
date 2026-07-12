/**
 * programmaticMoveSignal — module-level guard that marks a window during which the
 * map is moving because WE moved it (auto-fit / flyTo / setView / panBy), not the
 * user.
 *
 * Why: the radius-mode server-cluster viewport query (useMapViewportSnapshot →
 * useMapClusters) refetches on every `moveend`/`zoomend`. A programmatic
 * `fitBounds` fires those same events, which refetches clusters for the in-flight
 * viewport, which changes the rendered data, which could re-trigger another fit —
 * a zoom-in/zoom-out flicker loop on mobile. Callers wrap their programmatic map
 * motion with `beginProgrammaticMapMove()`, and useMapViewportSnapshot ignores the
 * self-induced events until the window elapses (then does ONE trailing read so the
 * clusters still match the settled viewport). Genuine user pans/zooms are never
 * suppressed because they don't open this window.
 */
let suppressUntil = 0

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

/** Open (or extend) the self-induced-motion window. Default covers a 0.35s flyTo. */
export function beginProgrammaticMapMove(durationMs = 500): void {
  suppressUntil = Math.max(suppressUntil, now() + durationMs)
}

/** Milliseconds left in the current self-induced-motion window (0 when inactive). */
export function programmaticMapMoveRemainingMs(): number {
  const remaining = suppressUntil - now()
  return remaining > 0 ? remaining : 0
}

export function isProgrammaticMapMoveActive(): boolean {
  return programmaticMapMoveRemainingMs() > 0
}
