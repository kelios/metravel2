/**
 * @jest-environment jsdom
 */
import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import { CategoriesPopover } from '@/components/MapPage/popovers/CategoriesPopover'

jest.mock('@/hooks/useTheme', () => ({
  useThemedColors: () => ({
    primary: '#5d8c7c',
    primarySoft: '#e8f5e9',
    primaryText: '#214438',
    text: '#1a1a1a',
    textMuted: '#666666',
    textSubtle: '#7a7a7a',
    textOnPrimary: '#ffffff',
    surface: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderLight: '#ececec',
    borderAccent: '#c9ddd4',
  }),
}))

describe('CategoriesPopover', () => {
  const baseProps = {
    categories: ['Замок', 'Башня', 'Болото', 'Вокзал', 'Брама', 'Город', 'Заповедник', 'Озеро', 'Музей', 'Усадьба'],
    selected: [] as string[],
    travelsData: [
      { categoryName: 'Замок, Башня' },
      { categoryName: 'Замок' },
      { categoryName: 'Брама' },
      { categoryName: 'Город' },
      { categoryName: 'Заповедник' },
    ],
    onApply: jest.fn(),
    onClose: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('selects only filtered results without dropping previous selections', () => {
    const onApply = jest.fn()
    const onClose = jest.fn()

    const { getByTestId } = render(
      <CategoriesPopover
        {...baseProps}
        selected={['Город']}
        onApply={onApply}
        onClose={onClose}
      />,
    )

    fireEvent.changeText(getByTestId('categories-popover-search-input'), 'зам')
    fireEvent.press(getByTestId('categories-popover-bulk-action'))
    fireEvent.press(getByTestId('categories-popover-apply-button'))

    expect(onApply).toHaveBeenCalledWith(['Город', 'Замок'])
    expect(onClose).toHaveBeenCalled()
  })

  it('clears only filtered selections when all found rows are already selected', () => {
    const onApply = jest.fn()

    const { getByTestId } = render(
      <CategoriesPopover
        {...baseProps}
        selected={['Замок', 'Город']}
        onApply={onApply}
      />,
    )

    fireEvent.changeText(getByTestId('categories-popover-search-input'), 'зам')
    fireEvent.press(getByTestId('categories-popover-bulk-action'))
    fireEvent.press(getByTestId('categories-popover-apply-button'))

    expect(onApply).toHaveBeenCalledWith(['Город'])
  })

  it('resets local selection before closing the popover', () => {
    const onApply = jest.fn()
    const onClose = jest.fn()

    const { getByTestId } = render(
      <CategoriesPopover
        {...baseProps}
        selected={['Замок']}
        onApply={onApply}
        onClose={onClose}
      />,
    )

    fireEvent.press(getByTestId('categories-popover-reset-button'))
    fireEvent.press(getByTestId('categories-popover-apply-button'))

    expect(onApply).toHaveBeenCalledWith([])
    expect(onClose).toHaveBeenCalled()
  })
})
