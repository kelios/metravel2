import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import TextInputComponent from '@/components/forms/TextInputComponent'

describe('TextInputComponent', () => {
  it('renders correctly with label', () => {
    const { getByText, getByPlaceholderText } = render(
      <TextInputComponent
        label="Email"
        value=""
        onChange={() => {}}
        placeholder="Enter email"
      />
    )
    expect(getByText('Email')).toBeTruthy()
    expect(getByPlaceholderText('Enter email')).toBeTruthy()
  })

  it('displays the value', () => {
    const { getByDisplayValue } = render(
      <TextInputComponent label="Email" value="test@example.com" onChange={() => {}} />
    )
    expect(getByDisplayValue('test@example.com')).toBeTruthy()
  })

  it('calls onChange when text changes', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = render(
      <TextInputComponent
        label="Email"
        value=""
        onChange={onChange}
        placeholder="Enter email"
      />
    )
    fireEvent.changeText(getByPlaceholderText('Enter email'), 'new text')
    expect(onChange).toHaveBeenCalledWith('new text')
  })

  it('renders without label', () => {
    const { queryByText } = render(
      <TextInputComponent value="" onChange={() => {}} />
    )
    expect(queryByText('Email')).toBeNull()
  })

  it('applies secureTextEntry when provided', () => {
    const { getByPlaceholderText } = render(
      <TextInputComponent
        label="Password"
        value=""
        onChange={() => {}}
        secureTextEntry
        placeholder="Enter password"
      />
    )
    const input = getByPlaceholderText('Enter password')
    expect(input.props.secureTextEntry).toBe(true)
  })
})






