/** Screenshot pixels, in CSS pixels (page.screenshot({ scale: 'css' })). */
export type BottomPixelImage = { width: number; height: number; data: ArrayLike<number> }
export type BottomPixelGeometry = {
  /** Dock rectangle relative to the clipped screenshot; null when absent. */
  dock: { left: number; right: number; top: number; bottom: number } | null
  /** Largest channel of the computed dark body/dock surface, before alpha. */
  darkSurfaceChannel: number
}
export type BottomPixelFailure = { x: number; y: number; zone: 'dock' | 'edge' | 'outside'; brightFraction: number }
export type BottomPixelResult = { matchesThemeBackground: boolean; failures: BottomPixelFailure[]; rowsChecked: number }

/**
 * #2298: tolerate dark cards/shadows and sparse bright labels/icons. A light
 * underlay behind rgba(42,42,42,.75) paints ~95, versus ~38 over dark 26.
 * The surface +32 tolerance distinguishes those without comparing CSS strings.
 * Outside the dock, content can legitimately contain photos: only a near-white
 * stripe spanning >=80% of a row is forbidden. Check rounded corner edges too.
 */
export function classifyDarkBottomPixels(image: BottomPixelImage, geometry: BottomPixelGeometry): BottomPixelResult {
  const { width, height, data } = image
  if (width < 1 || height < 1 || data.length !== width * height * 4) throw new Error('Invalid bottom screenshot')
  const failures: BottomPixelFailure[] = []
  const dock = geometry.dock
  const darkCeiling = Math.min(127, geometry.darkSurfaceChannel + 32)
  let rowsChecked = 0
  const check = (y: number, start: number, end: number, ceiling: number, zone: BottomPixelFailure['zone']) => {
    const left = Math.max(0, Math.ceil(start))
    const right = Math.min(width, Math.floor(end))
    if (right <= left) return
    rowsChecked += 1
    let bright = 0
    let firstBright = left
    for (let x = left; x < right; x += 1) {
      const index = (y * width + x) * 4
      // Luminance keeps a saturated active-tab accent from becoming a white stripe.
      const luma = data[index] * 0.2126 + data[index + 1] * 0.7152 + data[index + 2] * 0.0722
      if (luma > ceiling) {
        if (bright === 0) firstBright = x
        bright += 1
      }
    }
    const brightFraction = bright / (right - left)
    if (brightFraction >= 0.8) failures.push({ x: firstBright, y, zone, brightFraction })
  }
  for (let y = 0; y < height; y += 1) {
    if (!dock || y < dock.top || y >= dock.bottom) {
      check(y, 0, width, 200, 'outside')
      continue
    }
    // Hairline/radius allow more contrast, but never an uninspected white row.
    check(y, dock.left, dock.right, y < dock.top + 2 ? 200 : darkCeiling, 'dock')
    if (y >= dock.top + 2 && y < dock.top + 14) {
      check(y, dock.left, dock.left + 6, darkCeiling, 'edge')
      check(y, dock.right - 6, dock.right, darkCeiling, 'edge')
    }
    check(y, 0, dock.left, 200, 'outside')
    check(y, dock.right, width, 200, 'outside')
  }
  return { matchesThemeBackground: geometry.darkSurfaceChannel < 128 && failures.length === 0, failures, rowsChecked }
}
