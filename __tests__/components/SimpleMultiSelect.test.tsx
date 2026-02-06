import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import SimpleMultiSelect from '@/components/forms/SimpleMultiSelect'

describe('SimpleMultiSelect', () => {
  const dataNumericIds = [
    { id: 1, name: 'Арка' },
    { id: 2, name: 'Аэропорт' },
  ]

  const dataStringIds = [
    { id: '1', name: 'Арка' },
    { id: '2', name: 'Аэропорт' },
  ]

  it('treats string value as selected when item id is number', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Clicking on the already-selected item should remove it
    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('treats number value as selected when item id is string', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId } = render(
      <SimpleMultiSelect
        data={dataStringIds}
        value={[1]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('adds item without creating duplicates when types differ', () => {
    const onChange = jest.fn()

    const { getByText, getByLabelText, getByTestId, rerender } = render(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1']}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 1')).toBeTruthy()

    // Select second item; should append 2
    fireEvent.press(getByTestId('simple-multiselect.item.2'))

    expect(onChange).toHaveBeenCalledWith(['1', 2])

    // Re-render with mixed value and re-select first item; should remove it (not add duplicate)
    rerender(
      <SimpleMultiSelect
        data={dataNumericIds}
        value={['1', 2]}
        onChange={onChange}
        labelField="name"
        valueField="id"
      />
    )

    fireEvent.press(getByLabelText('Открыть выбор'))
    expect(getByText('Выбрано: 2')).toBeTruthy()
    fireEvent.press(getByTestId('simple-multiselect.item.1'))

    expect(onChange).toHaveBeenCalledWith([2])
  })
})
