import { render, fireEvent, within } from '@testing-library/react-native'
import { Platform, StyleSheet } from 'react-native'
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

  it('renders correctly with default props', async () => {
    const { getByText } = await render(<ConfirmDialog {...defaultProps} />)
    expect(getByText('Подтверждение')).toBeTruthy()
    expect(getByText('Вы уверены, что хотите продолжить?')).toBeTruthy()
    expect(getByText('Удалить')).toBeTruthy()
    expect(getByText('Отмена')).toBeTruthy()
  })

  it('renders with custom props', async () => {
    const { getByText } = await render(
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

  it('calls onClose when cancel is pressed', async () => {
    const onClose = jest.fn()
    const { getByText } = await render(<ConfirmDialog {...defaultProps} onClose={onClose} />)
    await fireEvent.press(getByText('Отмена'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when confirm is pressed', async () => {
    const onConfirm = jest.fn()
    const { getByText } = await render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    await fireEvent.press(getByText('Удалить'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not render when visible is false', async () => {
    const { queryByText } = await render(<ConfirmDialog {...defaultProps} visible={false} />)
    expect(queryByText('Подтверждение')).toBeNull()
  })

  it.each(['ios'] as const)('disables confirmation while preserving cancellation on %s', async (platform) => {
    Object.defineProperty(Platform, 'OS', { value: platform })
    const onConfirm = jest.fn()
    const onClose = jest.fn()
    const screen = await render(
      <ConfirmDialog {...defaultProps} onConfirm={onConfirm} onClose={onClose} confirmDisabled />
    )
    const confirm = screen.getByLabelText('Удалить')
    expect(confirm.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }))
    await fireEvent.press(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByLabelText('Отмена'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('caps a long message at the viewport and scrolls only the message on native', async () => {
    const { getByTestId, getByText } = await render(
      <ConfirmDialog {...defaultProps} message={LONG_MESSAGE} />
    )

    // Paper вешает наш `style` на surface внутри своей Modal-обёртки.
    expect(flattenStyle(getByTestId('confirm-dialog-surface').props.style).maxHeight).toBe('85%')
    expect(flattenStyle(getByTestId('confirm-dialog-message').props.style).flexShrink).toBe(1)
    expect(within(getByTestId('confirm-dialog-message')).getByText(LONG_MESSAGE)).toBeTruthy()
    expect(within(getByTestId('confirm-dialog-message')).queryByText('Удалить')).toBeNull()

    // Кнопки по-прежнему смонтированы и кликабельны при любой длине сообщения.
    await fireEvent.press(getByText('Удалить'))
    expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1)
  })
})

// Browser events, portals and focus refs need the DOM renderer. Keep the native
// assertions above on RNTL, with its native text invariant intact.
describe('ConfirmDialog in real React Native Web DOM', () => {
  let ReactWeb: typeof import('react')
  let createRoot: typeof import('react-dom/client').createRoot
  let WebConfirmDialog: typeof import('@/components/ui/ConfirmDialog').default
  let WebModal: typeof import('react-native').Modal
  let host: HTMLDivElement
  let root: import('react-dom/client').Root
  const mockScrollProps = jest.fn()
  const defaultProps = { visible: true, onClose: jest.fn(), onConfirm: jest.fn() }

  beforeAll(() => {
    // The shared setup cached native mocks. Load the real web component tree
    // and ReactDOM together so their hooks and native DOM refs share React.
    jest.resetModules()
    jest.doMock('react-native', () => {
      const actual = jest.requireActual('react-native-web')
      const React = require('react')
      const CapturedScrollView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
        mockScrollProps(props)
        return React.createElement(actual.ScrollView, { ...props, ref })
      })
      return { ...actual, ScrollView: CapturedScrollView }
    })
    ReactWeb = require('react')
    ;({ createRoot } = require('react-dom/client'))
    WebModal = require('react-native').Modal
    WebConfirmDialog = require('@/components/ui/ConfirmDialog').default
  })

  beforeEach(() => {
    jest.clearAllMocks()
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await ReactWeb.act(() => root.unmount())
    host.remove()
    document.body.replaceChildren()
  })

  const inPage = (testID: string) => {
    const node = document.body.querySelector<HTMLElement>(`[data-testid="${testID}"]`)
    expect(node).not.toBeNull()
    return node!
  }
  const action = (label: string) => {
    const node = document.body.querySelector<HTMLElement>(`[role="button"][aria-label="${label}"]`)
    expect(node).not.toBeNull()
    return node!
  }
  const renderWeb = async (element: import('react').ReactElement) => {
    await ReactWeb.act(() => root.render(element))
  }
  const click = async (node: HTMLElement) => {
    await ReactWeb.act(() => node.click())
  }
  const key = async (type: 'keydown' | 'keyup') => {
    const event = new KeyboardEvent(type, { key: 'Escape', bubbles: true, cancelable: true })
    await ReactWeb.act(() => { document.body.dispatchEvent(event) })
    return event
  }

  it('disables confirmation while preserving cancellation on web', async () => {
    const onConfirm = jest.fn()
    const onClose = jest.fn()
    await renderWeb(ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, onConfirm, onClose, confirmDisabled: true }))
    const confirm = action('Удалить')
    expect(confirm.getAttribute('aria-disabled')).toBe('true')
    await click(confirm)
    expect(onConfirm).not.toHaveBeenCalled()
    await click(action('Отмена'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders in the connected web host and exposes a stable dialog test id', async () => {
    await renderWeb(ReactWeb.createElement(WebConfirmDialog, defaultProps))
    expect(inPage('confirm-dialog').isConnected).toBe(true)
  })

  it('stacks as the active RNW modal so a parent modal does not receive the same Escape', async () => {
    const onClose = jest.fn()
    const onParentClose = jest.fn()
    await renderWeb(ReactWeb.createElement(ReactWeb.Fragment, null,
      ReactWeb.createElement(WebModal, { visible: true, transparent: true, onRequestClose: onParentClose },
        ReactWeb.createElement('button', { type: 'button' }, 'Parent action')),
      ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, onClose }),
    ))
    await key('keyup')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onParentClose).not.toHaveBeenCalled()
  })

  it('handles one Escape gesture on capture keyup and prevents it reaching a parent RNW modal', async () => {
    const onClose = jest.fn()
    const parentModalKeyup = jest.fn()
    document.addEventListener('keyup', parentModalKeyup)
    try {
      await renderWeb(ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, onClose }))
      await key('keydown')
      const keyup = await key('keyup')
      // One keydown + keyup gesture closes once, before bubbling reaches RNW.
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(parentModalKeyup).not.toHaveBeenCalled()
      expect(keyup.defaultPrevented).toBe(true)
    } finally {
      document.removeEventListener('keyup', parentModalKeyup)
    }
  })

  it('caps a long message at the viewport and scrolls only the message on web', async () => {
    await renderWeb(ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, message: LONG_MESSAGE }))
    expect(getComputedStyle(inPage('confirm-dialog')).maxHeight).toBe('100%')
    const messageArea = inPage('confirm-dialog-message')
    expect(getComputedStyle(messageArea).flexShrink).toBe('1')
    expect(messageArea.textContent).toBe(LONG_MESSAGE)
    expect(messageArea.textContent).not.toContain('Удалить')
    expect(messageArea.textContent).not.toContain('Отмена')
  })

  it('takes a Tab stop only while the message actually overflows', async () => {
    await renderWeb(ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, message: LONG_MESSAGE }))
    const scrollProps = () => mockScrollProps.mock.calls.at(-1)![0]
    expect(inPage('confirm-dialog-message').tabIndex).toBe(-1)
    // jsdom has no layout. Supply measurements at the public ScrollView
    // boundary, while rendering its actual DOM, events and forwarded ref.
    await ReactWeb.act(() => {
      scrollProps().onLayout({ nativeEvent: { layout: { height: 300 } } })
      scrollProps().onContentSizeChange(332, 24)
    })
    expect(inPage('confirm-dialog-message').tabIndex).toBe(-1)
    await ReactWeb.act(() => { scrollProps().onContentSizeChange(332, 1602) })
    expect(inPage('confirm-dialog-message').tabIndex).toBe(0)
  })

  it('routes Escape only to the topmost confirm and hands control back after it unmounts', async () => {
    const onLowerClose = jest.fn()
    const onTopClose = jest.fn()
    const stack = (showTop: boolean) => ReactWeb.createElement(ReactWeb.Fragment, null,
      ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, title: 'Lower confirm', onClose: onLowerClose }),
      showTop ? ReactWeb.createElement(WebConfirmDialog, { ...defaultProps, title: 'Top confirm', onClose: onTopClose }) : null,
    )
    await renderWeb(stack(true))
    await key('keyup')
    expect(onTopClose).toHaveBeenCalledTimes(1)
    expect(onLowerClose).not.toHaveBeenCalled()
    await renderWeb(stack(false))
    await key('keyup')
    expect(onTopClose).toHaveBeenCalledTimes(1)
    expect(onLowerClose).toHaveBeenCalledTimes(1)
  })
})
