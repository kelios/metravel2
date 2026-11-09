import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'

jest.mock('@/components/ui/ImageCardMedia', () => {
  const { View } = require('react-native')
  return { __esModule: true, default: (props: any) => <View testID={props.testID} accessibilityLabel={`fit:${props.fit}`} /> }
})

import PlaceListRow, { PLACE_LIST_ROW_HEIGHT, PLACE_LIST_ROW_THUMB_SIZE } from '@/components/places/PlaceListRow'

describe('PlaceListRow (#3142)', () => {
  const actions = [
    { key: 'copy-coord', label: 'Скопировать координаты', icon: 'copy' as const, onPress: jest.fn() },
    { key: 'delete', label: 'Удалить', icon: 'trash-2' as const, onPress: jest.fn(), destructive: true },
  ]

  it('рисует категорию, название, подзаголовок и миниатюру contain; строка ≥ 44 px и ниже 100', async () => {
    const onPress = jest.fn()
    await render(
      <PlaceListRow
        title="Голубые озёра"
        subtitle="Мядельский район"
        categoryLabel="Озеро"
        imageUrl="https://example.com/p.jpg"
        onPress={onPress}
        actions={actions}
        testID="row"
      />,
    )
    expect(screen.getByText('Голубые озёра')).toBeTruthy()
    expect(screen.getByText('Озеро')).toBeTruthy()
    expect(screen.getByText('Мядельский район')).toBeTruthy()
    // docs/RULES.md → Images: миниатюра тоже `contain` (решение владельца 09.11.2026).
    expect(screen.getByTestId('row-thumb', { includeHiddenElements: true }).props.accessibilityLabel).toBe('fit:contain')
    expect(PLACE_LIST_ROW_THUMB_SIZE).toBeGreaterThanOrEqual(64)
    expect(PLACE_LIST_ROW_HEIGHT).toBeLessThan(100)

    await fireEvent.press(screen.getByTestId('row-main'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('«⋯» открывает лист со всеми действиями; кнопка ≥ 44 dp', async () => {
    await render(<PlaceListRow title="Точка" actions={actions} testID="row" />)
    const menu = screen.getByTestId('row-menu')
    expect(menu.props.accessibilityLabel).toBe('Навигация и действия')
    await fireEvent.press(menu)
    expect(await screen.findByText('Скопировать координаты')).toBeTruthy()
    expect(screen.getByText('Удалить')).toBeTruthy()
  })

  it('режим выбора: отметка на миниатюре, роль checkbox, без «⋯»', async () => {
    const onPress = jest.fn()
    await render(<PlaceListRow title="Точка" actions={actions} selectionMode selected onPress={onPress} testID="row" />)
    expect(screen.queryByTestId('row-menu')).toBeNull()
    expect(screen.getByTestId('row-check')).toBeTruthy()
    const main = screen.getByTestId('row-main')
    expect(main.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }))
    await fireEvent.press(main)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})
