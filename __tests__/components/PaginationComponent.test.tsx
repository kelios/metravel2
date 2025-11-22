import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import PaginationComponent from '@/components/PaginationComponent'

describe('PaginationComponent', () => {
  const defaultProps = {
    currentPage: 0,
    itemsPerPage: 10,
    itemsPerPageOptions: [10, 20, 50],
    onPageChange: jest.fn(),
    onItemsPerPageChange: jest.fn(),
    totalItems: 100,
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders minimal layout with current page info', () => {
    const { getByText, toJSON } = render(<PaginationComponent {...defaultProps} />)

    // Проверяем текущую десктопную разметку: "Стр." и "из 10" + значение инпута "1"
    expect(getByText('Стр.')).toBeTruthy()
    expect(getByText('из 10')).toBeTruthy()

    const tree = toJSON()
    const treeStr = JSON.stringify(tree)
    expect(treeStr).toContain('"value":"1"')
  })

  it('calls onPageChange when next is pressed', () => {
    const onPageChange = jest.fn()
    const { getByLabelText } = render(
      <PaginationComponent {...defaultProps} onPageChange={onPageChange} />
    )
    const nextButton = getByLabelText('Следующая страница')
    fireEvent.press(nextButton)
    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange when prev is pressed', () => {
    const onPageChange = jest.fn()
    const { getByLabelText } = render(
      <PaginationComponent {...defaultProps} currentPage={1} onPageChange={onPageChange} />
    )
    const prevButton = getByLabelText('Предыдущая страница')
    fireEvent.press(prevButton)
    expect(onPageChange).toHaveBeenCalledWith(0)
  })

  it('disables prev button on first page', () => {
    const { getByLabelText } = render(<PaginationComponent {...defaultProps} currentPage={0} />)
    const prevButton = getByLabelText('Предыдущая страница')
    expect(prevButton.props.accessibilityState?.disabled).toBe(true)
  })

  it('disables next button on last page', () => {
    const { getByLabelText } = render(
      <PaginationComponent {...defaultProps} currentPage={9} totalItems={100} />
    )
    const nextButton = getByLabelText('Следующая страница')
    expect(nextButton.props.accessibilityState?.disabled).toBe(true)
  })

  it('updates page when input changes on mobile layout', () => {
    const rn = require('react-native')
    const spy = jest.spyOn(rn, 'useWindowDimensions').mockReturnValue({ width: 420, height: 800 })

    const onPageChange = jest.fn()
    const { getByLabelText } = render(
      <PaginationComponent {...defaultProps} onPageChange={onPageChange} />
    )
    const input = getByLabelText('Текущая страница')
    fireEvent.changeText(input, '5')
    fireEvent(input, 'submitEditing')
    expect(onPageChange).toHaveBeenCalledWith(4) // 0-based

    spy.mockRestore()
  })
})

