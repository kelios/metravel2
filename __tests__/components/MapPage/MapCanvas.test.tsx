import { render } from '@testing-library/react-native'
import { View } from 'react-native'

import { MapCanvas } from '@/components/MapPage/MapCanvas'

const mockMapLoadingBar = jest.fn(({ visible }: { visible: boolean }) => (
  <View testID="map-loading-bar" {...({ 'data-visible': String(visible) } as any)} />
))

jest.mock('@/components/MapPage/MapLoadingBar', () => ({
  __esModule: true,
  MapLoadingBar: (props: { visible: boolean }) => mockMapLoadingBar(props),
}))

jest.mock('@/components/MapPage/MapPageSkeleton', () => ({
  __esModule: true,
  MapPageSkeleton: () => {
    const { View: MockView } = require('react-native')
    return <MockView testID="map-page-skeleton" />
  },
}))

const baseProps = {
  styles: {
    mapArea: {},
    radiusPill: {},
    radiusPillText: {},
    geoBanner: {},
    geoBannerText: {},
    geoBannerClose: {},
  },
  themedColors: {
    primary: '#000',
    textMuted: '#666',
    warning: '#b45309',
  },
  isWeb: false,
  isMobile: false,
  mapReady: false,
  mapPanelProps: {},
  travelsData: [],
  quickFilters: {
    selected: [],
    radiusOptions: [],
    categoryOptions: [],
    overlayOptions: [],
    enabledOverlays: {},
    categoriesValue: '',
    radiusValue: '',
    overlaysValue: '',
  },
  mapQuickActionButtons: [],
  currentRadius: '',
  shouldShowFloatingRadiusPill: false,
  showGeoBanner: false,
  dismissGeoBanner: jest.fn(),
  handleSelectSearchTab: jest.fn(),
  openRightPanel: jest.fn(),
}

describe('MapCanvas', () => {
  beforeEach(() => {
    mockMapLoadingBar.mockClear()
  })

  it('passes the explicit map progress state to the top loading bar', () => {
    render(<MapCanvas {...baseProps} showProgress={false} />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: false })
  })

  it('shows the top loading bar when the screen asks for map progress', () => {
    render(<MapCanvas {...baseProps} showProgress />)
    expect(mockMapLoadingBar).toHaveBeenLastCalledWith({ visible: true })
  })
})
