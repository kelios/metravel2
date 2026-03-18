import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'

import TravelDescription from '@/components/travel/TravelDescription'

jest.mock('@/components/travel/StableContent', () => {
  const { Text } = require('react-native')
  return function MockStableContent() {
    return <Text testID="stable-content">stable-content</Text>
  }
})

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    textMuted: '#666',
    borderLight: '#ddd',
    surface: '#fff',
  }),
}))

describe('TravelDescription', () => {
  it('uses the full section width on desktop when noBox is enabled', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = render(
      <TravelDescription htmlContent="<p>Описание</p>" noBox />
    )

    const container = getByTestId('travel-description')
    const style = StyleSheet.flatten(container.props.style)

    expect(style.maxWidth).toBeUndefined()
    expect(style.paddingHorizontal).toBe(0)
  })

  it('keeps the default constrained layout without noBox', () => {
    jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    })

    const { getByTestId } = render(
      <TravelDescription htmlContent="<p>Описание</p>" />
    )

    const container = getByTestId('travel-description')
    const style = StyleSheet.flatten(container.props.style)

    expect(style.maxWidth).toBe(760)
  })
})
