// __tests__/components/travel/useSingleTravelExport.test.tsx

import { renderHook, act } from '@testing-library/react-native'
import type { Travel } from '@/types/types'
import type { BookSettings } from '@/components/export/BookSettingsModal'
import useSingleTravelExportDefault, {
  useSingleTravelExport,
  buildDefaultSettingsForTravel,
} from '@/components/travel/hooks/useSingleTravelExport'

const mockOpenPrintBook = jest.fn(() => Promise.resolve())

jest.mock('@/hooks/usePdfExport', () => ({
  usePdfExport: () => ({
    openPrintBook: mockOpenPrintBook,
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
    mockOpenPrintBook.mockClear()
  })

  it('keeps default export alias for bundle interop safety', () => {
    expect(useSingleTravelExportDefault).toBe(useSingleTravelExport)
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
      await result.current.handleOpenPrintBookWithSettings(customSettings)
    })
    expect(mockOpenPrintBook).toHaveBeenCalledWith(customSettings)
    expect(result.current.settingsSummary).toContain('minimal')
  })

  it('resets settings when travel changes', () => {
    const updatedTravel = { ...baseTravel, name: 'Новый маршрут' } as Travel
    const { result, rerender } = renderHook(
      ({ travel }: { travel: Travel }) => useSingleTravelExport(travel),
      {
        initialProps: { travel: baseTravel },
      }
    )

    expect(result.current.lastSettings.title).toContain('Маршрут по Карпатам')

    rerender({ travel: updatedTravel })
    expect(result.current.lastSettings.title).toContain('Новый маршрут')
  })
})

