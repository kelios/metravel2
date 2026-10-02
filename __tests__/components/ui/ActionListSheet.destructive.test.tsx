import React from 'react'
import { render } from '@testing-library/react-native'

import ActionListSheet from '@/components/ui/ActionListSheet'

// #2101: разрушительный пункт «⋯» — красный и отделён чертой от обычных.
describe('ActionListSheet destructive item', () => {
  const noop = () => undefined
  const items = [
    { key: 'share', label: 'Поделиться', icon: 'share-2' as const, onPress: noop, testID: 'item-share' },
    { key: 'delete', label: 'Удалить поездку', icon: 'trash-2' as const, onPress: noop, destructive: true, testID: 'item-delete' },
  ]

  it('рисует разделитель перед destructive-пунктом и красит его подпись', () => {
    const { getAllByTestId, getByText } = render(
      <ActionListSheet visible onClose={noop} title="Поездка" actions={items} />,
    )
    expect(getAllByTestId('action-sheet-separator')).toHaveLength(1)
    const flat = JSON.stringify(getByText('Удалить поездку').props.style)
    expect(flat).toMatch(/color/)
    expect(JSON.stringify(getByText('Поделиться').props.style)).not.toEqual(flat)
  })

  it('без destructive разделителя нет', () => {
    const { queryByTestId } = render(
      <ActionListSheet visible onClose={noop} title="Поездка" actions={[items[0]]} />,
    )
    expect(queryByTestId('action-sheet-separator')).toBeNull()
  })
})
