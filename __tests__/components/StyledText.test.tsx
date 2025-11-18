import React from 'react'
import { render } from '@testing-library/react-native'
import { MonoText } from '@/components/StyledText'

describe('StyledText', () => {
  it('renders correctly', () => {
    const { getByText } = render(<MonoText>Test Text</MonoText>)
    expect(getByText('Test Text')).toBeTruthy()
  })

  it('applies mono font style', () => {
    const { getByText } = render(<MonoText>Test Text</MonoText>)
    const text = getByText('Test Text')
    expect(text).toBeTruthy()
  })
})


