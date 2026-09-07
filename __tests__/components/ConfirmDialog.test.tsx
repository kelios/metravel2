import { render, fireEvent, waitFor, within } from '@testing-library/react-native'
import { Modal, Platform, StyleSheet } from 'react-native'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const originalPlatform = Platform.OS

// Ровно тот случай из #1862: перечень строк раздувал бокс выше окна, верх
// уезжал за экран, а кнопки — за нижний край и переставали кликаться.
const LONG_MESSAGE = Array.from({ length: 14 }, (_, index) => `Строка перечня ${index + 1}`).join('\n')

const flattenStyle = (style: unknown): Record<string, unknown> =>
  (StyleSheet.flatten(style as never) as Record<string, unknown> | undefined) ?? {}

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

  it('caps a long message at the viewport and scrolls only the message on web', () => {
    Object.defineProperty(Platform, 'OS', { value: 'web' })

    const { getByTestId } = render(<ConfirmDialog {...defaultProps} message={LONG_MESSAGE} />)

    // Без потолка по высоте бокс вырастал по содержимому и выносил кнопки за экран.
    expect(flattenStyle(getByTestId('confirm-dialog').props.style).maxHeight).toBe('100%')

    const messageArea = getByTestId('confirm-dialog-message')
    // Единственный сжимаемый блок: переполнение уходит в прокрутку сообщения.
    expect(flattenStyle(messageArea.props.style).flexShrink).toBe(1)
    // `useFocusTrap` перехватывает каждый Tab и водит фокус только по своему
    // селектору; без `focusable` (→ `tabindex="0"`) скрытую часть длинного
    // сообщения нельзя прочитать с клавиатуры.
    expect(messageArea.props.focusable).toBe(true)
    expect(within(messageArea).getByText(LONG_MESSAGE)).toBeTruthy()
    // Кнопки лежат вне области прокрутки, поэтому остаются на экране.
    expect(within(messageArea).queryByText('Удалить')).toBeNull()
    expect(within(messageArea).queryByText('Отмена')).toBeNull()
  })

  it('caps a long message at the viewport and scrolls only the message on native', () => {
    const { getByTestId, getByText } = render(
      <ConfirmDialog {...defaultProps} message={LONG_MESSAGE} />
    )

    // Paper вешает наш `style` на surface внутри своей Modal-обёртки.
    expect(flattenStyle(getByTestId('confirm-dialog-surface').props.style).maxHeight).toBe('85%')
    expect(flattenStyle(getByTestId('confirm-dialog-message').props.style).flexShrink).toBe(1)
    expect(within(getByTestId('confirm-dialog-message')).getByText(LONG_MESSAGE)).toBeTruthy()
    expect(within(getByTestId('confirm-dialog-message')).queryByText('Удалить')).toBeNull()

    // Кнопки по-прежнему смонтированы и кликабельны при любой длине сообщения.
    fireEvent.press(getByText('Удалить'))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
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
