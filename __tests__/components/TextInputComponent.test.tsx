import { render, fireEvent } from '@testing-library/react-native'
import TextInputComponent from '@/components/forms/TextInputComponent'

describe('TextInputComponent', () => {
  it('renders correctly with label', async () => {
    const { getByText, getByPlaceholderText } = await render(
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

  it('displays the value', async () => {
    const { getByDisplayValue } = await render(
      <TextInputComponent label="Email" value="test@example.com" onChange={() => {}} />
    )
    expect(getByDisplayValue('test@example.com')).toBeTruthy()
  })

  it('calls onChange when text changes', async () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = await render(
      <TextInputComponent
        label="Email"
        value=""
        onChange={onChange}
        placeholder="Enter email"
      />
    )
    await fireEvent.changeText(getByPlaceholderText('Enter email'), 'new text')
    expect(onChange).toHaveBeenCalledWith('new text')
  })

  it('renders without label', async () => {
    const { queryByText } = await render(
      <TextInputComponent value="" onChange={() => {}} />
    )
    expect(queryByText('Email')).toBeNull()
  })

  it('applies secureTextEntry when provided', async () => {
    const { getByPlaceholderText } = await render(
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






