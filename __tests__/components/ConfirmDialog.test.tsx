import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import ConfirmDialog from '@/components/ConfirmDialog'

describe('ConfirmDialog', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders correctly with default props', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByText('Подтверждение')).toBeTruthy()
    expect(getByText('Вы уверены, что хотите продолжить?')).toBeTruthy()
    expect(getByText('УДАЛИТЬ')).toBeTruthy()
    expect(getByText('ОТМЕНА')).toBeTruthy()
  })

  it('renders with custom props', () => {
    const { getByText } = render(
      <ConfirmDialog
        {...defaultProps}
        title="Custom Title"
        message="Custom message"
        confirmText="Confirm"
        cancelText="Cancel"
      />
    )
    expect(getByText('Custom Title')).toBeTruthy()
    expect(getByText('Custom message')).toBeTruthy()
    expect(getByText('CONFIRM')).toBeTruthy()
    expect(getByText('CANCEL')).toBeTruthy()
  })

  it('calls onClose when cancel is pressed', () => {
    const onClose = jest.fn()
    const { getByText } = render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    fireEvent.press(getByText('ОТМЕНА'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when confirm is pressed', () => {
    const onConfirm = jest.fn()
    const { getByText } = render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.press(getByText('УДАЛИТЬ'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not render when visible is false', () => {
    const { queryByText } = render(<ConfirmDialog {...defaultProps} visible={false} />)
    expect(queryByText('Подтверждение')).toBeNull()
  })
})




