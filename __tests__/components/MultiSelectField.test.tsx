import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import MultiSelectField from '@/components/MultiSelectField'

// Мокаем MultiSelect, чтобы контролировать его поведение
jest.mock('react-native-element-dropdown', () => ({
  MultiSelect: ({ onChange, value, data, ...rest }: any) => {
    return (
      <div
        testID="multi-select-mock"
        data-value={JSON.stringify(value)}
        data-items={JSON.stringify(data)}
        onClick={() => {
          // ничего не делаем, управление выбором идёт через fireEvent
        }}
        {...rest}
      />
    )
  },
}))

describe('MultiSelectField', () => {
  const items = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ]

  it('renders label when provided', () => {
    const { getByText } = render(
      // @ts-ignore
      <MultiSelectField
        label="Категории"
        items={items as any}
        value={[]}
        onChange={jest.fn()}
        labelField="label"
        valueField="value"
      />
    )

    expect(getByText('Категории')).toBeTruthy()
  })

  it('calls onChange with single value in single mode (primitive)', () => {
    const handleChange = jest.fn()

    const { getByTestId } = render(
      // @ts-ignore
      <MultiSelectField
        label="Одна категория"
        items={['a', 'b'] as any}
        value={''}
        onChange={handleChange}
        labelField="label"
        valueField="value"
        single
      />
    )

    const element = getByTestId('multi-select-mock')

    // Эмулируем вызов внутреннего onChange с массивом примитивов
    fireEvent(element, 'onChange', ['x'])

    expect(handleChange).toHaveBeenCalledWith('x')
  })

  it('calls onChange with extracted value in single mode (object)', () => {
    const handleChange = jest.fn()

    const { getByTestId } = render(
      // @ts-ignore
      // @ts-ignore
      <MultiSelectField
        label="Несколько категорий"
        items={items as any}
        value={['a', 'b']}
        onChange={handleChange}
        labelField="label"
        valueField="value"
        single
      />
    )

    const element = getByTestId('multi-select-mock')

    // Эмулируем выбор первого объекта
    fireEvent(element, 'onChange', [items[0]])

    expect(handleChange).toHaveBeenCalledWith('a')
  })

  it('calls onChange with array of values in multi mode (objects)', () => {
    const handleChange = jest.fn()

    const { getByTestId } = render(
      // @ts-ignore
      <MultiSelectField
        label="Несколько категорий"
        items={items as any}
        value={[]}
        onChange={handleChange}
        labelField="label"
        valueField="value"
      />
    )

    const element = getByTestId('multi-select-mock')

    fireEvent(element, 'onChange', [items[0], items[1]])

    expect(handleChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('passes correct value prop to underlying MultiSelect in single mode', () => {
    const { getByTestId, rerender } = render(
      <MultiSelectField
        label="Одна категория"
        items={items}
        value={''}
        onChange={jest.fn()}
        labelField="label"
        valueField="value"
        single
      />
    )

    const element = getByTestId('multi-select-mock') as any
    expect(element.props['data-value']).toBe(JSON.stringify([]))

    rerender(
      <MultiSelectField
        label="Одна категория"
        items={items}
        value={'a'}
        onChange={jest.fn()}
        labelField="label"
        valueField="value"
        single
      />
    )

    const updated = getByTestId('multi-select-mock') as any
    expect(updated.props['data-value']).toBe(JSON.stringify(['a']))
  })
})
