import { render } from '@testing-library/react-native'
import { Platform } from 'react-native'
import { Heading } from '@/components/ui/Typography'

// #1617: react-native-web maps accessibilityRole="header" (RN's only heading
// role — there's no "header2"/"header3") to role="heading" on web, and
// components/AccessibilityUtil/propsToAccessibilityComponent resolves an
// unleveled role="heading" node to a literal <h1> tag. Without an explicit
// aria-level, every <Heading level={2|3|4}> rendered as a real <h1> — e.g.
// /app had 11+ stray h1s from feature-card subheadings that were never
// meant to be page-level headings.
describe('Typography Heading aria-level (#1617)', () => {
  beforeEach(() => {
    (Platform as { OS: string }).OS = 'web'
  })

  it.each([1, 2, 3, 4] as const)('sets aria-level=%d to match the requested level', (level) => {
    const { getByText } = render(<Heading level={level}>Заголовок</Heading>)
    const node = getByText('Заголовок')
    expect(node.props.accessibilityRole).toBe('header')
    expect(node.props['aria-level']).toBe(level)
  })

  it('defaults to level 2 (not 1) when no level prop is given', () => {
    const { getByText } = render(<Heading>Подзаголовок</Heading>)
    const node = getByText('Подзаголовок')
    expect(node.props['aria-level']).toBe(2)
  })
})
