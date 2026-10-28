import { render } from '@testing-library/react-native'
import { Text, View, Button } from '@/components/ui/Themed'

describe('Themed Components', () => {
  it('Text renders correctly', async () => {
    const { getByText } = await render(<Text>Test Text</Text>)
    expect(getByText('Test Text')).toBeTruthy()
  })

  it('View renders correctly', async () => {
    const { container } = await render(<View />)
    expect(container.children).toHaveLength(1)
  })

  it('Button renders correctly', async () => {
    const { getByText } = await render(<Button title="Test Button" />)
    expect(getByText('Test Button')).toBeTruthy()
  })

  it('Text applies custom light color', async () => {
    const { getByText } = await render(<Text lightColor="#ff0000">Test</Text>)
    expect(getByText('Test')).toBeTruthy()
  })

  it('Text applies custom dark color', async () => {
    const { getByText } = await render(<Text darkColor="#0000ff">Test</Text>)
    expect(getByText('Test')).toBeTruthy()
  })
})






