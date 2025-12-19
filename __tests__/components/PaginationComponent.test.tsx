import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import PaginationComponent from '@/components/PaginationComponent'

jest.mock('@/hooks/useResponsive', () => ({
  useResponsive: () =>
    (global as any).__mockResponsive ?? {
      width: 1400,
      height: 900,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    },
}))

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
    ;(global as any).__mockResponsive = {
      width: 1400,
      height: 900,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: false,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: true,
      isMobile: false,
      isPortrait: false,
      isLandscape: true,
      orientation: 'landscape',
      breakpoints: {},
      isAtLeast: () => true,
      isAtMost: () => false,
      isBetween: () => false,
    }
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
    ;(global as any).__mockResponsive = {
      width: 600,
      height: 800,
      isSmallPhone: false,
      isPhone: false,
      isLargePhone: true,
      isTablet: false,
      isLargeTablet: false,
      isDesktop: false,
      isMobile: true,
      isPortrait: true,
      isLandscape: false,
      orientation: 'portrait',
      breakpoints: {},
      isAtLeast: () => false,
      isAtMost: () => true,
      isBetween: () => false,
    }

    const onPageChange = jest.fn()
    const { getByLabelText } = render(
      <PaginationComponent {...defaultProps} onPageChange={onPageChange} />
    )
    const input = getByLabelText('Текущая страница')
    fireEvent.changeText(input, '5')
    fireEvent(input, 'submitEditing')
    expect(onPageChange).toHaveBeenCalledWith(4) // 0-based
  })
})

