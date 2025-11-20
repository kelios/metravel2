import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import YoutubeLinkComponent from '@/components/YoutubeLinkComponent'

describe('YoutubeLinkComponent', () => {
  it('renders correctly with label', () => {
    const { getByText, getByPlaceholderText } = render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={() => {}} />
    )
    expect(getByText('YouTube Link')).toBeTruthy()
    expect(getByPlaceholderText('Введите ссылку на YouTube')).toBeTruthy()
  })

  it('validates YouTube URL correctly', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText, queryByText } = render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    fireEvent.changeText(input, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    fireEvent(input, 'blur')
    
    expect(onChange).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(queryByText('Неверная ссылка на YouTube')).toBeNull()
  })

  it('shows error for invalid URL', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText, getByText } = render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    fireEvent.changeText(input, 'invalid-url')
    fireEvent(input, 'blur')
    
    expect(getByText('Неверная ссылка на YouTube')).toBeTruthy()
  })

  it('accepts empty value', () => {
    const onChange = jest.fn()
    const { getByPlaceholderText } = render(
      <YoutubeLinkComponent label="YouTube Link" value="" onChange={onChange} />
    )
    const input = getByPlaceholderText('Введите ссылку на YouTube')
    
    fireEvent.changeText(input, '')
    fireEvent(input, 'blur')
    
    expect(onChange).toHaveBeenCalledWith('')
  })
})




