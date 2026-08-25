import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { Platform } from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const mockCreatePortal = jest.fn((node: any, _container?: any) => node)
const originalPlatform = Platform.OS
const originalForcePortal = process.env.CONFIRM_DIALOG_FORCE_PORTAL

jest.mock('react-dom', () => ({
  __esModule: true,
  createPortal: (node: any, container: any) => mockCreatePortal(node, container),
}))

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
    if (originalForcePortal === undefined) {
      delete process.env.CONFIRM_DIALOG_FORCE_PORTAL
    } else {
      process.env.CONFIRM_DIALOG_FORCE_PORTAL = originalForcePortal
    }
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

  it('renders via react-dom portal on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    process.env.CONFIRM_DIALOG_FORCE_PORTAL = '1'

    mockCreatePortal.mockClear()
    render(<ConfirmDialog {...defaultProps} />)
    expect(mockCreatePortal).toHaveBeenCalled()

  })

  it('portals into an active parent dialog so its RNW focus trap accepts confirm focus', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })
    const parentDialog = document.createElement('div')
    parentDialog.setAttribute('role', 'dialog')
    parentDialog.setAttribute('aria-modal', 'true')
    const staleConfirm = document.createElement('div')
    staleConfirm.dataset.testid = 'confirm-dialog'
    staleConfirm.setAttribute('role', 'dialog')
    staleConfirm.setAttribute('aria-modal', 'true')
    staleConfirm.tabIndex = -1
    parentDialog.appendChild(staleConfirm)
    document.body.appendChild(parentDialog)
    staleConfirm.focus()

    process.env.CONFIRM_DIALOG_FORCE_PORTAL = '1'

    render(<ConfirmDialog {...defaultProps} />)

    expect(mockCreatePortal).toHaveBeenCalledWith(expect.anything(), parentDialog)

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
