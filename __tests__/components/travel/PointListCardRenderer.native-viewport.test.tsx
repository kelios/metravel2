import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'

import PointListCardRenderer from '@/components/travel/PointListCardRenderer'

let mockVisible = false
const mockOnLayout = jest.fn()

jest.mock('@/components/ui/richMediaViewport', () => ({
  useRichMediaVisibility: () => ({
    ref: { current: null },
    visible: mockVisible,
    onLayout: mockOnLayout,
  }),
}))

jest.mock('@/components/places/PlaceListCard', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    __esModule: true,
    default: (props: any) => React.createElement(View, {
      ...props,
      testID: 'mock-place-list-card',
    }),
  }
})

describe('PointListCardRenderer native viewport media gate', () => {
  const originalPlatform = Platform.OS
  const noop = jest.fn()
  const props = {
    colors: { textOnDark: '#fff', textOnPrimary: '#fff' },
    isMobile: true,
    item: { id: '1', address: 'Point', coord: '52.1,23.7' },
    itemModel: {
      addDisabled: false,
      handleAddPointClick: noop,
      imageUrl: 'https://example.com/point.jpg',
      inlineActions: [],
      isAdding: false,
      mapActions: [],
      onCardPress: noop,
    },
    numColumns: 1,
    onCopy: noop,
    onOpenMap: noop,
    onShare: noop,
    responsive: { coordSize: 12, imageMinHeight: 240, titleSize: 14 },
    styles: { col: {}, col1: {} },
  }

  beforeEach(() => {
    ;(Platform as any).OS = 'android'
    mockVisible = false
    mockOnLayout.mockClear()
  })

  afterAll(() => {
    ;(Platform as any).OS = originalPlatform
  })

  it('keeps the card mounted but withholds its image until it nears the viewport', () => {
    const screen = render(<PointListCardRenderer {...props} />)

    expect(screen.getByTestId('mock-place-list-card').props.imageUrl).toBeUndefined()
    const host = screen.getByTestId('travel-point-card-viewport-1')
    expect(host.props.collapsable).toBe(false)
    expect(host.props.onLayout).toBe(mockOnLayout)

    mockVisible = true
    screen.rerender(<PointListCardRenderer {...props} item={{ ...props.item }} />)

    expect(screen.getByTestId('mock-place-list-card').props.imageUrl).toBe(
      'https://example.com/point.jpg',
    )
  })
})
