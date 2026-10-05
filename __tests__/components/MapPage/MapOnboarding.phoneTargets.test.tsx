/**
 * #2303 — the phone tour is chosen by the layout that is drawn and every step
 * aims at a node the phone layout renders. Mobile web aimed its only step at
 * `map-mobile-find-nearby` (nothing rendered it: the card fell to the centre),
 * and native phones got the desktop steps aimed at `map-panel-tab-*`, which the
 * phone layout never renders.
 */
import { cleanup, render } from '@testing-library/react-native'

import { MapMobileTopOverlay } from '@/components/MapPage/MapMobile/MapMobileTopOverlay'
import { getOnboardingSteps, getPhoneOnboardingSteps } from '@/components/MapPage/MapOnboarding'
import { getThemedColors } from '@/constants/designSystem'

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

describe('map tour on the phone layout (#2303)', () => {
  const phoneTargets = getPhoneOnboardingSteps()
    .map((step) => step.targetTestID)
    .filter((id): id is string => Boolean(id))

  it('names its targets and none of them is a desktop panel tab', () => {
    expect(phoneTargets.length).toBeGreaterThan(0)
    expect(phoneTargets.filter((id) => id.startsWith('map-panel-tab-'))).toEqual([])
    // The desktop tour stays on the panel tabs.
    expect(getOnboardingSteps().map((step) => step.targetTestID).filter(Boolean)).toEqual([
      'map-panel-tab-filters',
      'map-panel-tab-travels',
      'map-panel-tab-route',
    ])
  })

  it.each(['radius', 'route'] as const)('every step target exists in the phone top overlay (%s mode)', (mode) => {
    const { queryByTestId } = render(<MapMobileTopOverlay {...(baseProps as any)} mode={mode} />)
    const missing = phoneTargets.filter((id) => queryByTestId(id) == null)
    expect(missing).toEqual([])
  })
})
