// #2102: пункт «Распечатать план» в «⋯» экрана поездки зависит от наличия печати
// (isPrintAvailable), а не от Platform.OS: нет модуля печати — пункта нет.
import { render } from '@testing-library/react-native'

import type { PlannedTrip } from '@/api/plannedTrips'
import TripPlanScreenHeader from '@/components/trips/planning/TripPlanScreenHeader'

const mockUseScreenHeader = jest.fn()
const mockIsPrintAvailable = jest.fn()
const mockPrintTripPlan = jest.fn()

jest.mock('@/components/layout/ScreenHeaderContext', () => ({
  useScreenHeader: (...args: unknown[]) => mockUseScreenHeader(...args),
}))
jest.mock('@/utils/printHtml', () => ({
  isPrintAvailable: () => mockIsPrintAvailable(),
}))
jest.mock('@/components/trips/planning/print/printTripPlan', () => ({
  printTripPlan: (...args: unknown[]) => mockPrintTripPlan(...args),
}))
jest.mock('@/components/trips/planning/useTripRouteExportTrip', () => ({
  useTripRouteExportTrip: (trip: unknown) => ({ displayTrip: trip }),
}))
jest.mock('@/utils/shareTripPlan', () => ({ shareTripPlan: jest.fn() }))
jest.mock('@/utils/tripAnalytics', () => ({ trackRouteExported: jest.fn() }))

const trip = { id: 3, title: 'Поездка', isOwner: true } as unknown as PlannedTrip

const overflowKeys = (): string[] =>
  (mockUseScreenHeader.mock.calls.at(-1)?.[0].overflow as { key: string }[]).map((item) => item.key)

const renderHeader = (onActionError = jest.fn()) => {
  render(<TripPlanScreenHeader trip={trip} onEdit={jest.fn()} onDelete={jest.fn()} onShowExport={jest.fn()} onActionError={onActionError} />)
  return onActionError
}

describe('TripPlanScreenHeader — печать плана (#2102)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('печать доступна — пункт «Распечатать план» есть и стоит первым', () => {
    mockIsPrintAvailable.mockReturnValue(true)
    renderHeader()
    expect(overflowKeys()[0]).toBe('print')
  })

  it('сборка без модуля печати — пункта нет', () => {
    mockIsPrintAvailable.mockReturnValue(false)
    renderHeader()
    expect(overflowKeys()).not.toContain('print')
  })

  it('unavailable показывает common:print.unavailable, cancelled молчит', async () => {
    mockIsPrintAvailable.mockReturnValue(true)
    const onActionError = renderHeader()
    const item = (mockUseScreenHeader.mock.calls.at(-1)?.[0].overflow as { key: string; onPress: () => void }[]).find((i) => i.key === 'print')!

    mockPrintTripPlan.mockResolvedValueOnce('cancelled')
    item.onPress()
    await Promise.resolve()
    await Promise.resolve()
    expect(onActionError).toHaveBeenLastCalledWith(null)

    mockPrintTripPlan.mockResolvedValueOnce('unavailable')
    item.onPress()
    await Promise.resolve()
    await Promise.resolve()
    expect(onActionError).toHaveBeenLastCalledWith(expect.stringMatching(/\S/))
    expect(onActionError).toHaveBeenLastCalledWith(expect.not.stringContaining('common:print'))
  })
})
