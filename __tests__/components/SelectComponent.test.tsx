import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import SelectComponent from '@/components/SelectComponent'

// Mock web-specific components
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native')
  return {
    ...RN,
    Platform: {
      ...RN.Platform,
      OS: 'web',
    },
  }
})

describe('SelectComponent', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(
      <SelectComponent
        label="Country"
        options={[
          { value: '1', label: 'Belarus' },
          { value: '2', label: 'Poland' },
        ]}
        value=""
        onChange={() => {}}
      />
    )
    expect(getByText('Country')).toBeTruthy()
  })

  it('renders options', () => {
    const { getByText } = render(
      <SelectComponent
        options={[
          { value: '1', label: 'Belarus' },
          { value: '2', label: 'Poland' },
        ]}
        value=""
        onChange={() => {}}
      />
    )
    expect(getByText('Belarus')).toBeTruthy()
    expect(getByText('Poland')).toBeTruthy()
  })

  it('calls onChange when value changes', () => {
    const onChange = jest.fn()
    const { getByDisplayValue } = render(
      <SelectComponent
        options={[
          { value: '1', label: 'Belarus' },
          { value: '2', label: 'Poland' },
        ]}
        value="1"
        onChange={onChange}
      />
    )
    const select = getByDisplayValue('1')
    fireEvent.change(select, { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith('2')
  })

  it('renders placeholder', () => {
    const { getByText } = render(
      <SelectComponent
        options={[]}
        value=""
        onChange={() => {}}
        placeholder="Select option"
      />
    )
    expect(getByText('Select option')).toBeTruthy()
  })
})

