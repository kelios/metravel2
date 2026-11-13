export type Rect = { x: number; y: number; width: number; height: number }

export type QuestMapFlow = {
  panelRect: Rect
  rootRect: Rect
  navigation: { rect: Rect; marginBottom: number } | null
}

export type GeometryFrame = {
  timestamp: number
  mapRect: Rect
  viewportControls: Record<string, Rect>
  relativeControls: Record<string, Rect>
  viewport: { width: number; height: number; scrollX: number; scrollY: number }
  scrollAncestors: Array<{ element: string; rect: Rect; scrollTop: number; scrollLeft: number }>
  activeCard: { kind: 'intro' | 'step' | 'unknown'; rect: Rect | null }
  mapFlow: QuestMapFlow | null
}

export type GeometryAction = { timestamp: number; kind: string; target: string }

const scrollOffset = (frame: GeometryFrame, axis: 'x' | 'y') =>
  (axis === 'x' ? frame.viewport.scrollX : frame.viewport.scrollY) +
  frame.scrollAncestors.reduce((sum, parent) => sum + (axis === 'x' ? parent.scrollLeft : parent.scrollTop), 0)

const documentCoordinate = (frame: GeometryFrame, rect: Rect, axis: 'x' | 'y') =>
  rect[axis] + scrollOffset(frame, axis)

const sameOrigin = (before: GeometryFrame, prior: Rect, after: GeometryFrame, next: Rect) =>
  documentCoordinate(before, prior, 'x') === documentCoordinate(after, next, 'x') &&
  documentCoordinate(before, prior, 'y') === documentCoordinate(after, next, 'y')

const sameMapOffset = (before: GeometryFrame, after: GeometryFrame) => {
  const prior = before.mapFlow
  const next = after.mapFlow
  return !!prior && !!next &&
    prior.rootRect.width === next.rootRect.width && prior.rootRect.height === next.rootRect.height &&
    before.mapRect.x - prior.rootRect.x === after.mapRect.x - next.rootRect.x &&
    before.mapRect.y - prior.rootRect.y === after.mapRect.y - next.rootRect.y
}

function ownNavigationExplainsMovement(before: GeometryFrame, after: GeometryFrame, deltaY: number) {
  const prior = before.mapFlow
  const next = after.mapFlow
  const priorCard = before.activeCard.rect
  const nextCard = after.activeCard.rect
  if (!prior || !next || !priorCard || !nextCard || prior.navigation || !next.navigation ||
      !sameMapOffset(before, after) || !sameOrigin(before, prior.panelRect, after, next.panelRect) ||
      prior.panelRect.width !== next.panelRect.width ||
      !sameOrigin(before, priorCard, after, nextCard) || priorCard.width !== nextCard.width) return false
  // The desktop card is beside the map panel, not a preceding flow block.
  const beside = (card: Rect, panel: Rect) => card.x + card.width <= panel.x || panel.x + panel.width <= card.x
  if (!beside(priorCard, prior.panelRect) || !beside(nextCard, next.panelRect)) return false
  const { rect, marginBottom } = next.navigation
  const extent = rect.height + marginBottom
  return rect.height > 0 && Number.isFinite(marginBottom) && marginBottom >= 0 &&
    rect.x === next.rootRect.x && rect.width === next.rootRect.width &&
    documentCoordinate(before, prior.rootRect, 'x') === documentCoordinate(after, next.rootRect, 'x') &&
    rect.y - next.panelRect.y === prior.rootRect.y - prior.panelRect.y &&
    next.rootRect.y === rect.y + extent && deltaY === extent
}

// Input alone cannot excuse translation: require measured scroll or the exact
// owning flow change, including the desktop map's own step-navigation block.
export function parentMovementIsExplained(before: GeometryFrame, after: GeometryFrame, actions: GeometryAction[]): boolean {
  const delta = (axis: 'x' | 'y') => documentCoordinate(after, after.mapRect, axis) -
    documentCoordinate(before, before.mapRect, axis)
  if (before.viewport.width !== after.viewport.width || before.viewport.height !== after.viewport.height ||
      before.mapRect.width !== after.mapRect.width || before.mapRect.height !== after.mapRect.height ||
      JSON.stringify(before.relativeControls) !== JSON.stringify(after.relativeControls) ||
      JSON.stringify(before.scrollAncestors.map(parent => parent.element)) !==
        JSON.stringify(after.scrollAncestors.map(parent => parent.element)) || delta('x') !== 0) return false
  const deltaY = delta('y')
  if (deltaY === 0) {
    if (!before.mapFlow && !after.mapFlow) return true
    return !!before.mapFlow && !!after.mapFlow && sameMapOffset(before, after) &&
      sameOrigin(before, before.mapFlow.panelRect, after, after.mapFlow.panelRect) &&
      before.mapFlow.panelRect.width === after.mapFlow.panelRect.width
  }
  const priorCard = before.activeCard.rect
  const nextCard = after.activeCard.rect
  if (before.activeCard.kind !== 'intro' || after.activeCard.kind !== 'step' || !priorCard || !nextCard ||
      !actions.some(action => action.kind === 'quest-start' &&
        action.timestamp >= before.timestamp && action.timestamp <= after.timestamp)) return false
  if (ownNavigationExplainsMovement(before, after, deltaY)) return true
  const beforeGap = before.mapRect.y - priorCard.y - priorCard.height
  const afterGap = after.mapRect.y - nextCard.y - nextCard.height
  if (beforeGap < 0 || beforeGap !== afterGap || priorCard.width !== nextCard.width ||
      !sameOrigin(before, priorCard, after, nextCard) || deltaY !== nextCard.height - priorCard.height) return false
  if (!before.mapFlow && !after.mapFlow) return true
  const prior = before.mapFlow
  const next = after.mapFlow
  return !!prior && !!next && !prior.navigation && !next.navigation && sameMapOffset(before, after) &&
    prior.panelRect.width === next.panelRect.width &&
    documentCoordinate(before, prior.panelRect, 'x') === documentCoordinate(after, next.panelRect, 'x') &&
    prior.rootRect.y - prior.panelRect.y === next.rootRect.y - next.panelRect.y &&
    prior.rootRect.x - prior.panelRect.x === next.rootRect.x - next.panelRect.x &&
    documentCoordinate(after, next.panelRect, 'y') - documentCoordinate(before, prior.panelRect, 'y') === deltaY
}
