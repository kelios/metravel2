import type { ViewStyle } from 'react-native'

/** Geometry belongs to the approved 900×1350 illustration, independent of viewport or hydration. */
export const ADVENT_HOUSE_ASPECT_RATIO = 2 / 3
export const ADVENT_HOUSE_MAX_WIDTH = 680
export const ADVENT_WINDOW_MIN_TARGET = 44
export const ADVENT_WINDOW_COLUMNS = [14.7, 38.9, 62.9, 86.7] as const
export const ADVENT_WINDOW_ROWS = [11.7, 25, 38.7, 52.1, 65.8, 79.4] as const

const BUTTON_WIDTH = 20
const BUTTON_HEIGHT = 10
const percent = (value: number): `${number}%` => `${Number(value.toFixed(2))}%`

export const ADVENT_WINDOW_GLASS: ViewStyle = {
  position: 'absolute',
  left: '7.25%',
  top: '9%',
  width: '85.5%',
  height: '82%',
}

export const ADVENT_HOUSE_WINDOWS = ADVENT_WINDOW_ROWS.flatMap((centerY, row) =>
  ADVENT_WINDOW_COLUMNS.map((centerX, column) => ({
    day: row * ADVENT_WINDOW_COLUMNS.length + column + 1,
    style: {
      position: 'absolute',
      left: percent(centerX - BUTTON_WIDTH / 2),
      top: percent(centerY - BUTTON_HEIGHT / 2),
      width: percent(BUTTON_WIDTH),
      height: percent(BUTTON_HEIGHT),
      minWidth: ADVENT_WINDOW_MIN_TARGET,
      minHeight: ADVENT_WINDOW_MIN_TARGET,
    } satisfies ViewStyle,
  })),
)
