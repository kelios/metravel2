import React from 'react'
import { render } from '@testing-library/react-native'
import LabelText from '@/components/LabelText'

describe('LabelText', () => {
  it('renders correctly with label and text', () => {
    const { getByText } = render(<LabelText label="Name" text="John Doe" />)
    expect(getByText('Name')).toBeTruthy()
    expect(getByText('John Doe')).toBeTruthy()
  })

  it('displays empty text correctly', () => {
    const { getByText } = render(<LabelText label="Description" text="" />)
    expect(getByText('Description')).toBeTruthy()
    expect(getByText('')).toBeTruthy()
  })

  it('renders with long text', () => {
    const longText = 'This is a very long text that should be displayed correctly'
    const { getByText } = render(<LabelText label="Long Text" text={longText} />)
    expect(getByText(longText)).toBeTruthy()
  })
})




