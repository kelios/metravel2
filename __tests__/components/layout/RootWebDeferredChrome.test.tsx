import { render, screen, waitFor } from '@testing-library/react-native'

import RootWebDeferredChrome from '@/components/layout/RootWebDeferredChrome'
import {
  getConfirmDialogRequest,
  requestConfirmDialog,
  resolveConfirmDialog,
} from '@/components/ui/confirmDialogStore'

jest.mock('@/components/ui/NetworkStatus', () => ({
  __esModule: true,
  NetworkStatus: () => {
    const { Text } = require('react-native')
    return <Text testID="network-status">network-status</Text>
  },
}))

jest.mock('@/components/layout/Footer', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="footer">footer</Text>
  },
}))

jest.mock('@/components/layout/ConsentBanner', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="consent-banner">consent-banner</Text>
  },
}))

jest.mock('@/components/layout/WebAppRuntimeEffects', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="runtime-effects">runtime-effects</Text>
  },
}))

jest.mock('@/components/layout/WebServiceWorkerCleanup', () => ({
  __esModule: true,
  default: () => {
    const { Text } = require('react-native')
    return <Text testID="sw-cleanup">sw-cleanup</Text>
  },
}))

// Диалог подменён стабом: здесь проверяется только точка монтирования хоста,
// вёрстка `ConfirmDialog` покрыта своими тестами.
jest.mock('@/components/ui/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ visible, message }: { visible: boolean; message?: string }) => {
    const { Text } = require('react-native')
    return visible ? <Text testID="confirm-dialog-stub">{message}</Text> : null
  },
}))

jest.mock('@/utils/consent', () => ({
  __esModule: true,
  readConsent: jest.fn(() => null),
}))

describe('RootWebDeferredChrome', () => {
  const originalRequestAnimationFrame = global.requestAnimationFrame
  const originalCancelAnimationFrame = global.cancelAnimationFrame

  beforeAll(() => {
    global.requestAnimationFrame = ((callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0)) as typeof requestAnimationFrame
    global.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame
  })

  afterAll(() => {
    global.requestAnimationFrame = originalRequestAnimationFrame
    global.cancelAnimationFrame = originalCancelAnimationFrame
  })

  afterEach(() => {
    jest.useRealTimers()
    document.documentElement.classList.remove('app-hydrated')
  })

  it('renders travel deferred chrome without waiting for interaction', async () => {
    const { getByTestId } = render(
      <RootWebDeferredChrome
        isMobile={false}
        pathname="/travels/test-route"
        showFooter
        isTravelPerformanceRoute
        setDockHeight={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByTestId('footer')).toBeTruthy()
      expect(getByTestId('runtime-effects')).toBeTruthy()
    })

    expect(getByTestId('footer')).toBeTruthy()
    expect(getByTestId('runtime-effects')).toBeTruthy()
  })

  it('keeps the desktop map footer available', async () => {
    const { getByTestId } = render(
      <RootWebDeferredChrome
        isMobile={false}
        pathname="/map"
        showFooter
        isTravelPerformanceRoute={false}
        setDockHeight={jest.fn()}
      />
    )

    await waitFor(() => {
      expect(getByTestId('footer')).toBeTruthy()
    })
  })

  // #1556: это единственная точка монтирования `ConfirmDialogHost` на web. Если
  // хост отсюда пропадёт, `confirmAction` начнёт резолвиться `false` — каждое
  // деструктивное подтверждение молча превратится в no-op, а предупреждение о
  // несмонтированном хосте идёт через `console.warn`, который вырезается из
  // прод-сборки (`transform-remove-console`). Тест держит контракт.
  it('mounts the single confirm dialog host', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    // Базовая точка: без хоста мост fail-closed, поэтому пройти тест «случайно»
    // резолвом `true` нельзя.
    await expect(requestConfirmDialog({ title: 'Нет хоста', message: 'Нет хоста' })).resolves.toBe(
      false
    )

    render(
      <RootWebDeferredChrome
        isMobile={false}
        pathname="/favorites"
        showFooter
        isTravelPerformanceRoute={false}
        setDockHeight={jest.fn()}
      />
    )

    const pending = requestConfirmDialog({
      title: 'Очистить «Хочу поехать»?',
      message: 'Список будет очищен.',
    })

    expect(getConfirmDialogRequest()).toMatchObject({ title: 'Очистить «Хочу поехать»?' })
    expect(await screen.findByTestId('confirm-dialog-stub')).toBeTruthy()

    resolveConfirmDialog(true)
    await expect(pending).resolves.toBe(true)
    expect(getConfirmDialogRequest()).toBeNull()

    warn.mockRestore()
  })

})
