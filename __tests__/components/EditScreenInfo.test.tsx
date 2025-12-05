import React from 'react'
import { render } from '@testing-library/react-native'
import EditScreenInfo from '@/components/EditScreenInfo'

describe('EditScreenInfo', () => {
  it('renders correctly', () => {
    const { getByText } = render(<EditScreenInfo path="app/index.tsx" />)
    expect(getByText(/Open up the code for this screen/)).toBeTruthy()
    expect(getByText('app/index.tsx')).toBeTruthy()
  })

  it('displays the path', () => {
    const { getByText } = render(<EditScreenInfo path="components/Test.tsx" />)
    expect(getByText('components/Test.tsx')).toBeTruthy()
  })
})






