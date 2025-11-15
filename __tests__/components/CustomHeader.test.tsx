import React from 'react'
import { render } from '@testing-library/react-native'
import CustomHeader from '@/components/CustomHeader'

// Mock RenderRightMenu
jest.mock('@/components/RenderRightMenu', () => {
  const { View, Text } = require('react-native')
  return function MockRenderRightMenu() {
    return (
      <View testID="render-right-menu">
        <Text>Menu</Text>
      </View>
    )
  }
})

describe('CustomHeader', () => {
  it('renders correctly', () => {
    const { getByTestId } = render(<CustomHeader />)
    expect(getByTestId('render-right-menu')).toBeTruthy()
  })

  it('renders with correct structure', () => {
    const { UNSAFE_root } = render(<CustomHeader />)
    expect(UNSAFE_root).toBeTruthy()
  })
})

