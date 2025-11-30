import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import NumberInputComponent from '@/components/NumberInputComponent'

describe('NumberInputComponent', () => {
  it('renders correctly with label', () => {
    const { getByText, getByPlaceholderText } = render(
      <NumberInputComponent label="Age" value="" onChange={() => {}} />
    )
    expect(getByText('Age')).toBeTruthy()
    expect(getByPlaceholderText('Введите age')).toBeTruthy()
  })

  it('only accepts numeric input', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = render(
      <NumberInputComponent label="Age" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите age')
    fireEvent.changeText(input, 'abc123')
    expect(onChange).not.toHaveBeenCalledWith('abc123')
  })

  it('accepts numeric input', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = render(
      <NumberInputComponent label="Age" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите age')
    fireEvent.changeText(input, '123')
    expect(onChange).toHaveBeenCalledWith('123')
  })

  it('displays the value', () => {
    const { getByDisplayValue } = render(
      <NumberInputComponent label="Age" value="25" onChange={() => {}} />
    )
    expect(getByDisplayValue('25')).toBeTruthy()
  })
})





