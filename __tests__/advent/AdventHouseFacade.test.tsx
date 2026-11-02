import { fireEvent, render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import AdventHouseFacade from '@/components/advent/AdventHouseFacade'
import { ADVENT_HOUSE_ASPECT_RATIO, ADVENT_HOUSE_WINDOWS, ADVENT_WINDOW_GLASS } from '@/components/advent/adventHouseLayout'
import { ADVENT_FROST_OPACITY, ADVENT_VISUAL_ASSETS } from '@/constants/adventVisuals'
import { getAdventCampaign } from '@/services/advent/loadCampaign'
import type { AdventDoorView } from '@/hooks/useAdventCampaign'
import { i18n } from '@/i18n'

jest.mock('@/components/ui/ImageCardMedia', () => {
  const React = require('react')
  const { View } = require('react-native')
  return (props: Record<string, unknown>) => React.createElement(View, props)
})

const createDoors = (): AdventDoorView[] => getAdventCampaign().doors.map((door) => ({ ...door, state: 'locked' }))

describe('approved advent house facade', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('maps only 24 real main doors to invariant artwork coordinates, with numbers and no scene captions', async () => {
    const doors = createDoors()
    const screen = await render(<AdventHouseFacade doors={doors} onPressDoor={jest.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(24)
    expect(screen.getAllByText(/^\d+$/, { includeHiddenElements: true })).toHaveLength(24)
    expect(screen.queryByTestId('advent-door-25')).toBeNull()
    expect(screen.queryByText(doors[0].gift.title)).toBeNull()
    expect(screen.queryByText('Открыть')).toBeNull()

    for (const { day, style } of ADVENT_HOUSE_WINDOWS) {
      const button = screen.getByTestId(`advent-door-${day}`)
      expect(StyleSheet.flatten(button.props.style)).toMatchObject(style)
      expect(button.props.title).toBeUndefined()
      expect(button.props['data-tooltip']).toBeUndefined()
      expect(button.props.dataSet?.tooltip).toBeUndefined()
    }
    const facade = screen.getByTestId('advent-house-facade')
    expect(StyleSheet.flatten(facade.props.style)).toMatchObject({ aspectRatio: 2 / 3, width: '100%', maxWidth: 680 })
    expect(facade.props.onLayout).toBeUndefined()
    expect(screen.getByTestId('advent-house-artwork', { includeHiddenElements: true }).props.source).toBe(ADVENT_VISUAL_ASSETS.facade)
    expect(screen.getByTestId('advent-door-1').props.accessibilityLabel).toMatch(/Дверца 1, 1 декабря, Откроется/)
  })

  it('keeps frost on available and locked doors, clears opened/done rooms and accents today', async () => {
    const doors = createDoors()
    doors[0].state = 'available'
    doors[2].state = 'opened'
    doors[3].state = 'done'
    const screen = await render(<AdventHouseFacade doors={doors} todayDay={3} onPressDoor={jest.fn()} />)
    for (const day of [1, 2]) {
      expect(screen.getByTestId(`advent-window-dim-${day}`, { includeHiddenElements: true })).toBeTruthy()
      expect(StyleSheet.flatten(screen.getByTestId(`advent-window-frost-${day}`, { includeHiddenElements: true }).props.style).opacity).toBe(ADVENT_FROST_OPACITY)
      expect(screen.getByTestId(`advent-window-frost-${day}`, { includeHiddenElements: true }).props.placeholderColor).toBe('#00000000')
      expect(screen.queryByTestId(`advent-window-clear-${day}`, { includeHiddenElements: true })).toBeNull()
    }
    for (const day of [3, 4]) {
      expect(screen.getByTestId(`advent-window-clear-${day}`, { includeHiddenElements: true })).toBeTruthy()
      expect(screen.queryByTestId(`advent-window-frost-${day}`, { includeHiddenElements: true })).toBeNull()
      expect(screen.queryByTestId(`advent-window-dim-${day}`, { includeHiddenElements: true })).toBeNull()
    }
    expect(screen.getByTestId('advent-window-today-3', { includeHiddenElements: true })).toBeTruthy()
    expect(screen.getByTestId('advent-door-4').props.accessibilityLabel).toMatch(/Выполнена/)
  })

  it('forwards the original available door and disables future and identity/hydration-unready windows', async () => {
    const doors = createDoors()
    doors[0].state = 'available'
    const onPress = jest.fn()
    const screen = await render(<AdventHouseFacade doors={doors} onPressDoor={onPress} />)
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(onPress).toHaveBeenLastCalledWith(doors[0])
    await fireEvent.press(screen.getByTestId('advent-door-2'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('advent-door-2').props.accessibilityState.disabled).toBe(true)
    await screen.rerender(<AdventHouseFacade doors={doors} disabled onPressDoor={onPress} />)
    await fireEvent.press(screen.getByTestId('advent-door-1'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('advent-door-1').props.accessibilityState.disabled).toBe(true)
  })
})

describe('facade geometry at phone and desktop sizes', () => {
  it.each([288, 358, 680])('keeps 44px targets separated at house width %d', (width) => {
    const height = width / ADVENT_HOUSE_ASPECT_RATIO
    const boxes = ADVENT_HOUSE_WINDOWS.map(({ style }) => ({
      left: parseFloat(String(style.left)) / 100 * width,
      top: parseFloat(String(style.top)) / 100 * height,
      width: Math.max(44, parseFloat(String(style.width)) / 100 * width),
      height: Math.max(44, parseFloat(String(style.height)) / 100 * height),
    }))
    for (let i = 0; i < boxes.length; i += 1) {
      const a = boxes[i]
      expect(a.width).toBeGreaterThanOrEqual(44)
      expect(a.height).toBeGreaterThanOrEqual(44)
      expect(a.left).toBeGreaterThanOrEqual(0)
      expect(a.left + a.width).toBeLessThanOrEqual(width)
      for (const b of boxes.slice(i + 1)) {
        expect(a.left + a.width <= b.left || b.left + b.width <= a.left || a.top + a.height <= b.top || b.top + b.height <= a.top).toBe(true)
      }
    }
    expect(parseFloat(String(ADVENT_WINDOW_GLASS.width)) * 0.2).toBeCloseTo(17.1)
    expect(parseFloat(String(ADVENT_WINDOW_GLASS.height)) * 0.1 / ADVENT_HOUSE_ASPECT_RATIO).toBeCloseTo(12.3)
  })
})
