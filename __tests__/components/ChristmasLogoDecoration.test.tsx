import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import ChristmasLogoDecoration from '@/components/layout/ChristmasLogoDecoration'

let mockSeason: string | null = 'christmas'
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ activeSeasonalTheme: mockSeason }) }))
jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: Record<string, unknown>) => React.createElement(View, { ...props, testID: 'christmas-decoration-media' })
})

describe('Christmas brand decoration', () => {
  afterEach(() => { mockSeason = 'christmas' })

  it('adds non-interactive decorative marks only for the Christmas season', async () => {
    const screen = await render(<ChristmasLogoDecoration variant="hat" />)
    const hat = screen.getByTestId('christmas-logo-hat', { includeHiddenElements: true })
    expect(StyleSheet.flatten(hat.props.style).display).not.toBe('none')
    expect(hat.props.pointerEvents).toBe('none')
    expect(hat.props.accessible).toBe(false)
    expect(hat.props.accessibilityElementsHidden).toBe(true)
  })

  it.each([null, 'spring', 'halloween'])('hides both marks when the active season is %s', async (season) => {
    mockSeason = season
    const screen = await render(<><ChristmasLogoDecoration variant="hat" /><ChristmasLogoDecoration variant="tree" /></>)
    for (const variant of ['hat', 'tree']) {
      const mark = screen.getByTestId(`christmas-logo-${variant}`, { includeHiddenElements: true })
      expect(StyleSheet.flatten(mark.props.style).display).toBe('none')
    }
  })

  it.each(['hat', 'tree'] as const)('keeps %s transparent and sizes it from its decoration frame', async (variant) => {
    const screen = await render(<ChristmasLogoDecoration variant={variant} />)
    const media = screen.getByTestId('christmas-decoration-media', { includeHiddenElements: true })
    expect(media.props.placeholderColor).toBe('#00000000')
    expect(media.props.width).toBeUndefined()
    expect(media.props.height).toBeUndefined()
    expect(StyleSheet.flatten(media.props.style)).toMatchObject({ width: '100%', height: '100%', backgroundColor: 'transparent' })
  })
})
