import { parentMovementIsExplained, type GeometryFrame } from '../../e2e/helpers/questMapGeometry'

const start = [{ timestamp: 445.4, kind: 'quest-start', target: 'div' }]
const copy = (frame: GeometryFrame): GeometryFrame => JSON.parse(JSON.stringify(frame))

function desktopTransition(height = 44, marginBottom = 8) {
  // Recorded failing first attempt: reading card BESIDE the map shrinks by56,
  // while the map's own navigation appears and moves its root by52.
  const before: GeometryFrame = {
    timestamp: 435.4,
    mapRect: { x: 925, y: 200, width: 322, height: 420 },
    viewportControls: {
      zoom: { x: 935, y: 210, width: 48, height: 92 },
      attribution: { x: 1027, y: 582.3125, width: 220, height: 33.6875 },
    },
    relativeControls: {
      zoom: { x: 10, y: 10, width: 48, height: 92 },
      attribution: { x: 102, y: 382.3125, width: 220, height: 33.6875 },
    },
    viewport: { width: 1280, height: 900, scrollX: 0, scrollY: 0 },
    scrollAncestors: [{ element: 'div#reading-scroll', rect: { x: 349, y: 78, width: 931, height: 720 }, scrollTop: 0, scrollLeft: 0 }],
    activeCard: { kind: 'intro', rect: { x: 373, y: 94, width: 519, height: 607 } },
    mapFlow: {
      panelRect: { x: 916, y: 94, width: 340, height: 607 },
      rootRect: { x: 924, y: 102, width: 324, height: 460 }, navigation: null,
    },
  }
  const after = copy(before)
  after.timestamp = 487.2
  after.activeCard = { kind: 'step', rect: { ...before.activeCard.rect!, height: 551 } }
  after.mapRect.y += height + marginBottom
  Object.values(after.viewportControls).forEach(rect => { rect.y += height + marginBottom })
  after.mapFlow!.rootRect.y += height + marginBottom
  after.mapFlow!.panelRect.height = 551
  after.mapFlow!.navigation = { rect: { x: 924, y: 102, width: 324, height }, marginBottom }
  return { before, after }
}

function mobileTransition() {
  const before: GeometryFrame = {
    timestamp: 435.4, mapRect: { x: 16, y: 700, width: 358, height: 300 },
    viewportControls: {}, relativeControls: {},
    viewport: { width: 390, height: 900, scrollX: 0, scrollY: 0 }, scrollAncestors: [],
    activeCard: { kind: 'intro', rect: { x: 16, y: 100, width: 358, height: 580 } },
    mapFlow: {
      panelRect: { x: 8, y: 670, width: 374, height: 350 },
      rootRect: { x: 16, y: 678, width: 358, height: 330 }, navigation: null,
    },
  }
  const after = copy(before)
  after.timestamp = 487.2
  after.activeCard.kind = 'step'
  after.activeCard.rect!.height += 97
  after.mapRect.y += 97
  after.mapFlow!.panelRect.y += 97
  after.mapFlow!.rootRect.y += 97
  return { before, after }
}

it('explains the recorded desktop intro-to-step map movement by its own measured navigation, not the beside card', () => {
  const { before, after } = desktopTransition()
  expect(after.mapRect.y - before.mapRect.y).toBe(52)
  expect(after.activeCard.rect!.height - before.activeCard.rect!.height).toBe(-56)
  expect(parentMovementIsExplained(before, after, start)).toBe(true)
})

it.each([[88, 8], [44, 16], [61.5, 7.25]])('uses measured navigation extent %s+%s rather than a52px exemption', (height, margin) => {
  const { before, after } = desktopTransition(height, margin)
  expect(parentMovementIsExplained(before, after, start)).toBe(true)
})

it.each([
  ['map-only movement', (frame: GeometryFrame) => { frame.mapRect.y += 1 }],
  ['map and root move beyond navigation', (frame: GeometryFrame) => { frame.mapRect.y += 1; frame.mapFlow!.rootRect.y += 1 }],
  ['owning panel moves', (frame: GeometryFrame) => { frame.mapFlow!.panelRect.y += 1 }],
  ['owning panel width changes', (frame: GeometryFrame) => { frame.mapFlow!.panelRect.width += 1 }],
  ['card origin moves', (frame: GeometryFrame) => { frame.activeCard.rect!.y += 1 }],
  ['map root resizes', (frame: GeometryFrame) => { frame.mapFlow!.rootRect.height += 1 }],
  ['navigation origin moves', (frame: GeometryFrame) => { frame.mapFlow!.navigation!.rect.y += 1 }],
  ['navigation has another width', (frame: GeometryFrame) => { frame.mapFlow!.navigation!.rect.width -= 1 }],
  ['navigation has no measured extent', (frame: GeometryFrame) => { frame.mapFlow!.navigation = null }],
  ['missing owning flow', (frame: GeometryFrame) => { frame.mapFlow = null }],
  ['negative navigation margin', (frame: GeometryFrame) => { frame.mapFlow!.navigation!.marginBottom = -1 }],
  ['non-finite navigation margin', (frame: GeometryFrame) => { frame.mapFlow!.navigation!.marginBottom = Number.NaN }],
  ['relative zoom changes', (frame: GeometryFrame) => { frame.relativeControls.zoom.y += 1 }],
  ['relative attribution changes', (frame: GeometryFrame) => { frame.relativeControls.attribution.height += 1 }],
  ['horizontal map movement', (frame: GeometryFrame) => { frame.mapRect.x += 1 }],
  ['map height changes', (frame: GeometryFrame) => { frame.mapRect.height += 1 }],
  ['viewport changes', (frame: GeometryFrame) => { frame.viewport.width += 1 }],
  ['ancestor topology changes', (frame: GeometryFrame) => { frame.scrollAncestors[0].element = 'div#another-scroll' }],
] as const)('rejects %s despite a recent Start click', (_label, mutate) => {
  const { before, after } = desktopTransition()
  mutate(after)
  expect(parentMovementIsExplained(before, after, start)).toBe(false)
})

it.each([
  { actions: [] },
  { actions: [{ timestamp: 445.4, kind: 'click', target: 'div' }] },
  { actions: [{ timestamp: 400, kind: 'quest-start', target: 'div' }] },
  { actions: [{ timestamp: 500, kind: 'quest-start', target: 'div' }] },
])('rejects navigation movement without a Start bounded by the measured frames (%#)', ({ actions }) => {
  const { before, after } = desktopTransition()
  expect(parentMovementIsExplained(before, after, actions)).toBe(false)
})

it('rejects movement between later steps even with a recent Start event', () => {
  const { before, after } = desktopTransition()
  before.activeCard.kind = 'step'
  expect(parentMovementIsExplained(before, after, start)).toBe(false)
})

it('does not interpret a card ABOVE the map as the desktop beside-card navigation branch', () => {
  const { before, after } = desktopTransition()
  before.activeCard.rect!.x = after.activeCard.rect!.x = before.mapFlow!.panelRect.x
  before.activeCard.rect!.width = after.activeCard.rect!.width = before.mapFlow!.panelRect.width
  expect(parentMovementIsExplained(before, after, start)).toBe(false)
})

it('retains the exact mobile preceding-card flow explanation', () => {
  const { before, after } = mobileTransition()
  expect(parentMovementIsExplained(before, after, start)).toBe(true)
})

it.each([
  ['extra map movement', (frame: GeometryFrame) => { frame.mapRect.y += 1 }],
  ['panel movement inside the row', (frame: GeometryFrame) => { frame.mapFlow!.panelRect.y += 1 }],
  ['panel horizontal movement', (frame: GeometryFrame) => { frame.mapFlow!.panelRect.x += 1 }],
  ['unmeasured own navigation', (frame: GeometryFrame) => { frame.mapFlow!.navigation = { rect: { x: 16, y: 775, width: 358, height: 44 }, marginBottom: 8 } }],
])('rejects mobile %s', (_label, mutate) => {
  const { before, after } = mobileTransition()
  mutate(after)
  expect(parentMovementIsExplained(before, after, start)).toBe(false)
})

it('accepts unchanged map geometry without requiring user input', () => {
  const { before } = desktopTransition()
  expect(parentMovementIsExplained(before, copy(before), [])).toBe(true)
})

it.each(['window', 'ancestor'] as const)('explains measured %s scroll without double-counting it as map movement', target => {
  const { before } = desktopTransition()
  const after = copy(before)
  after.timestamp += 10
  for (const rect of [after.mapRect, after.mapFlow!.rootRect, after.mapFlow!.panelRect, after.activeCard.rect!, ...Object.values(after.viewportControls)]) rect.y -= 20
  if (target === 'window') after.viewport.scrollY = 20
  else after.scrollAncestors[0].scrollTop = 20
  expect(parentMovementIsExplained(before, after, [])).toBe(true)
})

it('rejects a relative-control jump even when the map itself has not moved', () => {
  const { before } = desktopTransition()
  const after = copy(before)
  after.relativeControls.zoom.width += 1
  expect(parentMovementIsExplained(before, after, [])).toBe(false)
})

it('rejects a transient unexplained map jump even if a later frame returns to its origin', () => {
  const { before } = desktopTransition()
  const transient = copy(before)
  transient.timestamp += 1
  transient.mapRect.y += 1
  const frames = [before, transient, { ...copy(before), timestamp: transient.timestamp + 1 }]
  expect(frames.slice(1).every((frame, index) => parentMovementIsExplained(frames[index], frame, start))).toBe(false)
})
