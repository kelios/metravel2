/**
 * #2251 (MAP-ONBOARDING-PHONE-ENTRY-001) — the phone layout lost its entry to
 * the map tour when the sheet toolbar was rebuilt (`1b1484a54`): the only
 * caller of `restartMapOnboarding()` was the desktop header. The entry now lives
 * in the «Слои и настройки карты» card of the top overlay: a labelled row with
 * its own ≥44 box (no hitSlop over the map, #2236) that closes the card and
 * starts the tour.
 */
import { cleanup, fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import { MapMobileTopOverlay } from '@/components/MapPage/MapMobile/MapMobileTopOverlay'
import { restartMapOnboarding } from '@/components/MapPage/MapOnboarding'
import { getThemedColors } from '@/constants/designSystem'
import { translate as i18nT } from '@/i18n'

jest.mock('@/components/MapPage/MapOnboarding', () => ({
  __esModule: true,
  restartMapOnboarding: jest.fn(),
}))

const colors = getThemedColors(false) as any

const baseProps = {
  colors,
  topInset: 24,
  radiusBadge: '50',
  onToggleRadius: jest.fn(),
  onToggleLayers: jest.fn(),
  onOpenFilters: jest.fn(),
  onCenterOnUser: jest.fn(),
  onShowAllPlaces: jest.fn(),
  onOpenList: jest.fn(),
  listBadge: '246',
  radiusOptions: [{ id: '50', name: '50 км' }],
  radiusValue: '50',
  onRadiusSelect: jest.fn(),
  onEnterRoute: jest.fn(),
} as const

afterEach(cleanup)

describe('MapMobileTopOverlay — вход в подсказки по карте (#2251)', () => {
  it('в карточке «Слои и настройки карты» есть вход в тур: подпись, 44, без hitSlop', () => {
    const onClosePopover = jest.fn()
    const { getByTestId, getByRole } = render(
      <MapMobileTopOverlay
        {...(baseProps as any)}
        activePopover="layers"
        onClosePopover={onClosePopover}
      />,
    )

    const label = i18nT('map:components.MapPage.MapPanelHeader.pokazat_podskazki_po_karte_5d9bc7dd')
    const entry = getByTestId('map-mobile-help-button')
    expect(getByRole('button', { name: label })).toBe(entry)
    expect(entry.props.hitSlop).toBeUndefined()
    const style = StyleSheet.flatten(
      typeof entry.props.style === 'function' ? entry.props.style({ pressed: false }) : entry.props.style,
    )
    expect(style.minHeight).toBeGreaterThanOrEqual(44)

    ;(restartMapOnboarding as jest.Mock).mockClear()
    fireEvent.press(entry)

    // The card closes first: the tour is the only overlay.
    expect(onClosePopover).toHaveBeenCalledTimes(1)
    expect(restartMapOnboarding).toHaveBeenCalledTimes(1)
    expect(onClosePopover.mock.invocationCallOrder[0]).toBeLessThan(
      (restartMapOnboarding as jest.Mock).mock.invocationCallOrder[0],
    )
  })

  it('без открытой карточки входа нет: ряд тулбара не растёт', () => {
    const { queryByTestId } = render(
      <MapMobileTopOverlay {...(baseProps as any)} activePopover={null} onClosePopover={jest.fn()} />,
    )

    expect(queryByTestId('map-mobile-help-button')).toBeNull()
  })
})
