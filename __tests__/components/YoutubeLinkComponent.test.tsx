import { render, fireEvent } from '@testing-library/react-native'
import YoutubeLinkComponent from '@/components/ui/YoutubeLinkComponent'

describe('YoutubeLinkComponent', () => {
  it('renders correctly with label', async () => {
    const { getByText, getByPlaceholderText } = await render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={() => {}} />
    )
    expect(getByText('YouTube Link')).toBeTruthy()
    expect(getByPlaceholderText('Введите ссылку на YouTube')).toBeTruthy()
  })

  it('validates YouTube URL correctly', async () => {
    const onChange = jest.fn()
    const { getByPlaceholderText, queryByText } = await render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    await fireEvent.changeText(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    await fireEvent(input, 'blur')
    
    expect(onChange).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(queryByText('Неверная ссылка на YouTube')).toBeNull()
  })

  it('shows error for invalid URL', async () => {
    const onChange = jest.fn()
    const { getByPlaceholderText, getByText } = await render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    await fireEvent.changeText(input, 'invalid-url')
    await fireEvent(input, 'blur')
    
    expect(getByText('Неверная ссылка на YouTube')).toBeTruthy()
  })

  it('accepts empty value', async () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = await render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    await fireEvent.changeText(input, '')
    await fireEvent(input, 'blur')
    
    expect(onChange).toHaveBeenCalledWith('')
  })
})






