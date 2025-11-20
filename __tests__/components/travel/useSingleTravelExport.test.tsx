// __tests__/components/travel/useSingleTravelExport.test.tsx

import { renderHook, act } from '@testing-library/react-native'
import type { Travel } from '@/src/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import { useSingleTravelExport, buildDefaultSettingsForTravel } from '@/components/travel/hooks/useSingleTravelExport'

const mockExport = jest.fn(() => Promise.resolve())
const mockPreview = jest.fn(() => Promise.resolve('blob:preview'))

jest.mock('@/src/hooks/usePdfExport', () => ({
  usePdfExport: () => ({
    exportPdf: mockExport,
    previewPdf: mockPreview,
    isGenerating: false,
    progress: 0,
    error: null,
    currentStage: 'validating',
  }),
}))

const baseTravel = {
  id: 1,
  name: 'Маршрут по Карпатам',
  countryName: 'Украина',
  cityName: 'Яремче',
} as unknown as Travel

describe('useSingleTravelExport', () => {
  beforeEach(() => {
    mockExport.mockClear()
    mockPreview.mockClear()
  })

  it('buildDefaultSettingsForTravel uses travel meta', () => {
    const settings = buildDefaultSettingsForTravel(baseTravel)
    expect(settings.title).toContain('Маршрут по Карпатам')
    expect(settings.subtitle).toBe('Украина')
    expect(settings.includeMap).toBe(true)
  })

  it('returns summary and delegates to pdf export service', async () => {
    const { result } = renderHook(() => useSingleTravelExport(baseTravel))
    const customSettings: BookSettings = {
      ...result.current.lastSettings,
      includeChecklists: true,
      checklistSections: ['documents'],
      template: 'minimal',
    }

    await act(async () => {
      await result.current.handleSaveWithSettings(customSettings)
    })
    expect(mockExport).toHaveBeenCalledWith(customSettings)
    expect(result.current.settingsSummary).toContain('minimal')

    await act(async () => {
      await result.current.handlePreviewWithSettings(customSettings)
    })
    expect(mockPreview).toHaveBeenCalledWith(customSettings)
  })

  it('resets settings when travel changes', () => {
    const updatedTravel = { ...baseTravel, name: 'Новый маршрут' } as Travel
    const { result, rerender } = renderHook(({ travel }) => useSingleTravelExport(travel), {
      initialProps: { travel: baseTravel },
    })

    expect(result.current.lastSettings.title).toContain('Маршрут по Карпатам')

    rerender({ travel: updatedTravel })
    expect(result.current.lastSettings.title).toContain('Новый маршрут')
  })
})

