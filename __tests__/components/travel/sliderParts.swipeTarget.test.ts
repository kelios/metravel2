import {
  SWIPE_DISTANCE_THRESHOLD_RATIO,
  SWIPE_FLICK_VELOCITY,
  resolveSwipeTargetIndex,
} from '@/components/travel/sliderParts/utils'

const WIDTH = 390
const MAX = 4

// Resting offset of a given slide index (matches snapOffsetForIndex math).
const offsetOf = (idx: number) => -idx * WIDTH

describe('resolveSwipeTargetIndex', () => {
  it('advances to the next slide when dragged past the distance threshold (no flick)', () => {
    const dragged = WIDTH * (SWIPE_DISTANCE_THRESHOLD_RATIO + 0.05)
    const target = resolveSwipeTargetIndex({
      currentIndex: 1,
      // finger moved left -> offset becomes more negative
      visualOffset: offsetOf(1) - dragged,
      velocity: 0,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(2)
  })

  it('snaps back to the current slide when drag is below threshold and slow', () => {
    const dragged = WIDTH * (SWIPE_DISTANCE_THRESHOLD_RATIO - 0.05)
    const target = resolveSwipeTargetIndex({
      currentIndex: 1,
      visualOffset: offsetOf(1) - dragged,
      velocity: 0.05,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(1)
  })

  it('advances on a forward flick even with a tiny drag distance', () => {
    const target = resolveSwipeTargetIndex({
      currentIndex: 1,
      visualOffset: offsetOf(1) - 10,
      // negative velocity = moving left = towards next slide
      velocity: -(SWIPE_FLICK_VELOCITY + 0.1),
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(2)
  })

  it('goes to the previous slide on a backward flick', () => {
    const target = resolveSwipeTargetIndex({
      currentIndex: 2,
      visualOffset: offsetOf(2) + 12,
      velocity: SWIPE_FLICK_VELOCITY + 0.1,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(1)
  })

  it('goes to the previous slide on a large backward drag (finger moved right)', () => {
    const dragged = WIDTH * (SWIPE_DISTANCE_THRESHOLD_RATIO + 0.1)
    const target = resolveSwipeTargetIndex({
      currentIndex: 2,
      visualOffset: offsetOf(2) + dragged,
      velocity: 0,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(1)
  })

  it('never advances more than one slide per swipe, even with a strong flick', () => {
    const target = resolveSwipeTargetIndex({
      currentIndex: 1,
      visualOffset: offsetOf(1) - WIDTH * 0.9,
      velocity: -3,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(2)
  })

  it('clamps at the last slide (no wrap-around)', () => {
    const target = resolveSwipeTargetIndex({
      currentIndex: MAX,
      visualOffset: offsetOf(MAX) - WIDTH * 0.6,
      velocity: -1,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(MAX)
  })

  it('clamps at the first slide (no wrap-around)', () => {
    const target = resolveSwipeTargetIndex({
      currentIndex: 0,
      visualOffset: offsetOf(0) + WIDTH * 0.6,
      velocity: 1,
      width: WIDTH,
      maxIndex: MAX,
    })
    expect(target).toBe(0)
  })

  it('is robust to a degenerate width (no movement -> stays put)', () => {
    // With a degenerate width the resting offset and visualOffset both collapse,
    // so a release without real movement keeps the current slide.
    const target = resolveSwipeTargetIndex({
      currentIndex: 1,
      visualOffset: -1,
      velocity: 0,
      width: 0,
      maxIndex: MAX,
    })
    expect(target).toBe(1)
  })
})
