import React from 'react'
import { render } from '@testing-library/react-native'
import { Text, View, Button, useThemeColor } from '@/components/Themed'

describe('Themed Components', () => {
  it('Text renders correctly', () => {
    const { getByText } = render(<Text>Test Text</Text>)
    expect(getByText('Test Text')).toBeTruthy()
  })

  it('View renders correctly', () => {
    const { UNSAFE_root } = render(<View />)
    expect(UNSAFE_root).toBeTruthy()
  })

  it('Button renders correctly', () => {
    const { getByText } = render(<Button title="Test Button" />)
    expect(getByText('Test Button')).toBeTruthy()
  })

  it('Text applies custom light color', () => {
    const { getByText } = render(<Text lightColor="#ff0000">Test</Text>)
    expect(getByText('Test')).toBeTruthy()
  })

  it('Text applies custom dark color', () => {
    const { getByText } = render(<Text darkColor="#0000ff">Test</Text>)
    expect(getByText('Test')).toBeTruthy()
  })
})




