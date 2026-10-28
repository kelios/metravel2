import { render } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'

import ThemeToggle from '@/components/layout/ThemeToggle'

const rowStyle = (ui: Awaited<ReturnType<typeof render>>) =>
  StyleSheet.flatten(ui.getByTestId('theme-toggle').props.style)

describe('ThemeToggle', () => {
  // #2244: PL «Automatyczny» сделал ряд шире панели мобильного меню на 320 px —
  // ряд не переносился, и правая кнопка обрезалась. Ширину ряда задаёт
  // контейнер, а не сумма подписей.
  it('wraps the horizontal row instead of overflowing its container', async () => {
    const ui = await render(<ThemeToggle compact layout="horizontal" showLabels />)

    expect(rowStyle(ui)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' })
    for (const value of ['light', 'dark', 'auto']) {
      expect(ui.getByTestId(`theme-toggle-${value}`)).toBeTruthy()
    }
  })

  it('keeps the vertical layout a plain column', async () => {
    const style = rowStyle(await render(<ThemeToggle layout="vertical" />))

    expect(style.flexDirection).toBe('column')
    expect(style.flexWrap).toBeUndefined()
  })
})
