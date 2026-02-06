import { BOOK_PRESETS, PRESET_CATEGORIES } from '@/types/pdf-presets'

describe('pdf presets', () => {
  it('contains default minimal preset and categories metadata', () => {
    const defaultPreset = BOOK_PRESETS.find((p) => p.isDefault)
    expect(defaultPreset?.id).toBe('minimalist')
    expect(defaultPreset?.settings.includeToc).toBe(true)
    expect(defaultPreset?.settings.template).toBeTruthy()

    expect(PRESET_CATEGORIES['map-focused'].name).toBeDefined()
    expect(PRESET_CATEGORIES['photo-focused'].description).toContain('визуальном контенте')
  })

  it('map-focused preset enables map and coordinates', () => {
    const mapPreset = BOOK_PRESETS.find((p) => p.category === 'map-focused')
    expect(mapPreset?.settings.includeMap).toBe(true)
    expect(mapPreset?.settings.showCoordinatesOnMapPage).toBe(true)
  })
})
