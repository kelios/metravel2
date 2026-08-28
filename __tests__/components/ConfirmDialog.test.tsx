import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Modal, Platform } from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const originalPlatform = Platform.OS

describe('ConfirmDialog', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    document.body.replaceChildren()
  })

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform })
    document.body.replaceChildren()
  })

  it('renders correctly with default props', () => {
    const { getByText } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByText('Подтверждение')).toBeTruthy()
    expect(getByText('Вы уверены, что хотите продолжить?')).toBeTruthy()
    expect(getByText('Удалить')).toBeTruthy()
    expect(getByText('Отмена')).toBeTruthy()
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
    expect(getByText('Confirm')).toBeTruthy()
    expect(getByText('Cancel')).toBeTruthy()
  })

  it('calls onClose when cancel is pressed', () => {
    const onClose = jest.fn()
    const { getByText } = render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    fireEvent.press(getByText('Отмена'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when confirm is pressed', () => {
    const onConfirm = jest.fn()
    const { getByText } = render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    fireEvent.press(getByText('Удалить'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not render when visible is false', () => {
    const { queryByText } = render(<ConfirmDialog {...defaultProps} visible={false} />)
    expect(queryByText('Подтверждение')).toBeNull()
  })

  it('renders in the connected web host and exposes a stable dialog test id', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    const { getByTestId } = render(<ConfirmDialog {...defaultProps} />)
    expect(getByTestId('confirm-dialog')).toBeTruthy()
  })

  it('stacks as the active RNW modal so a parent modal does not receive the same Escape', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
    const onClose = jest.fn()
    const onParentClose = jest.fn()

    render(
      <>
        <Modal visible transparent onRequestClose={onParentClose}>
          <button type="button">Parent action</button>
        </Modal>
        <ConfirmDialog {...defaultProps} onClose={onClose} />
      </>
    )

    document.body.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onParentClose).not.toHaveBeenCalled()
  })

  it('handles one Escape gesture on capture keyup and prevents it reaching a parent RNW modal', async () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
    const onClose = jest.fn()
    const parentModalKeyup = jest.fn()
    document.addEventListener('keyup', parentModalKeyup)

    const view = render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    const keydown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    const keyup = new KeyboardEvent('keyup', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(keydown)
    document.body.dispatchEvent(keyup)

    // A keydown close handler plus the required capture-keyup handler would
    // call onClose twice for the single browser keyboard gesture.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(parentModalKeyup).not.toHaveBeenCalled()
    expect(keyup.defaultPrevented).toBe(true)

    view.unmount()
    document.removeEventListener('keyup', parentModalKeyup)
  })

  it('routes Escape only to the topmost confirm and hands control back after it unmounts', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
    const onLowerClose = jest.fn()
    const onTopClose = jest.fn()

    const DialogStack = ({ showTop }: { showTop: boolean }) => (
      <>
        <ConfirmDialog {...defaultProps} title="Lower confirm" onClose={onLowerClose} />
        {showTop ? (
          <ConfirmDialog {...defaultProps} title="Top confirm" onClose={onTopClose} />
        ) : null}
      </>
    )

    const view = render(<DialogStack showTop />)
    document.body.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))

    expect(onTopClose).toHaveBeenCalledTimes(1)
    expect(onLowerClose).not.toHaveBeenCalled()

    view.rerender(<DialogStack showTop={false} />)
    document.body.dispatchEvent(new KeyboardEvent('keyup', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    }))

    expect(onTopClose).toHaveBeenCalledTimes(1)
    expect(onLowerClose).toHaveBeenCalledTimes(1)
  })
})
