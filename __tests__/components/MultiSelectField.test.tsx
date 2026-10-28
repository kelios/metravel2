import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import MultiSelectField from '@/components/forms/MultiSelectField'

// Mock SimpleMultiSelect component
jest.mock('@/components/forms/SimpleMultiSelect', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  return {
    __esModule: true,
    default: ({ onChange: _onChange, value, data, ...rest }: any) => {
      return React.createElement(View, {
        testID: 'multi-select-mock',
        'data-value': JSON.stringify(value),
        'data-items': JSON.stringify(data),
        ...rest
      });
    },
  };
});

describe('MultiSelectField', () => {
  const items = [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ]

  it('renders label when provided', async () => {
    const { getByText } = await render(
      // @ts-ignore -- test passes intentionally loose props to verify label rendering
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

  it('renders without crashing', async () => {
    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing primitive items array
      <MultiSelectField
        label="Одна категория"
        items={['a', 'b'] as any}
        value={''}
        onChange={() => {}}
        labelField="label"
        valueField="value"
      />
    )

    expect(getByTestId('multi-select-mock')).toBeTruthy()
  })

  it('calls onChange with single value in single mode (primitive)', async () => {
    const handleChange = jest.fn()

    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing primitive items array
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
    await fireEvent(element, 'onChange', ['x'])

    expect(handleChange).toHaveBeenCalledWith('x')
  })

  it('calls onChange with extracted value in single mode (object)', async () => {
    const handleChange = jest.fn()

    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing object items array in single mode
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
    await fireEvent(element, 'onChange', [items[0]])

    expect(handleChange).toHaveBeenCalledWith('a')
  })

  it('calls onChange with array of values in multi mode (objects)', async () => {
    const handleChange = jest.fn()

    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing multi-select mode
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

    await fireEvent(element, 'onChange', [items[0], items[1]])

    expect(handleChange).toHaveBeenCalledWith(['a', 'b'])
  })

  it('handles multi-select mode correctly', async () => {
    const onChange = jest.fn()

    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing multi-select with object items
      <MultiSelectField
        label="Несколько категорий"
        items={items as any}
        value={['a', 'b']}
        onChange={onChange}
        labelField="label"
        valueField="value"
      />
    )

    const element = getByTestId('multi-select-mock')
    expect(element.props['data-value']).toBe(JSON.stringify(['a', 'b']))
  })

  it('handles empty value in multi-select mode', async () => {
    const onChange = jest.fn()

    const { getByTestId } = await render(
      // @ts-ignore -- intentional loose props for testing empty value in multi-select
      <MultiSelectField
        label="Несколько категорий"
        items={items as any}
        value={[]}
        onChange={onChange}
        labelField="label"
        valueField="value"
      />
    )

    const element = getByTestId('multi-select-mock')
    expect(element.props['data-value']).toBe(JSON.stringify([]))
  })

  it('passes correct value prop to underlying MultiSelect in single mode', async () => {
    const { getByTestId, rerender } = await render(
      <MultiSelectField
        label="Одна категория"
        items={items}
        value={''}
        onChange={() => {}}
        labelField="label"
        valueField="value"
        single
      />
    )

    const element = getByTestId('multi-select-mock')
    expect(element.props['data-value']).toBe(JSON.stringify([]))

    await rerender(
      <MultiSelectField
        label="Одна категория"
        items={items}
        value={'a'}
        onChange={() => {}}
        labelField="label"
        valueField="value"
        single
      />
    )

    const updated = getByTestId('multi-select-mock')
    expect(updated.props['data-value']).toBe(JSON.stringify(['a']))
  })
})
