/**
 * @jest-environment node
 *
 * Web-адаптер печати без окна (SSG/SSR). С jsdom 26 `window` нельзя удалить из jsdom-окружения,
 * поэтому кейсы «окна нет» живут в node-окружении (#2735).
 */
const mockRequireOptionalNativeModule = jest.fn()

jest.mock('expo', () => ({
  requireOptionalNativeModule: (...args: unknown[]) => mockRequireOptionalNativeModule(...args),
}))
jest.mock('@/utils/openBookPreviewWindow', () => ({
  openPendingBookPreviewWindow: jest.fn(),
  openBookPreviewWindow: jest.fn(),
  discardPendingBookPreviewWindow: jest.fn(),
}))

describe('printHtml.web without window', () => {
  // В node-окружении setup/RN-preset держат window-заглушку; снимаем её на время теста.
  let windowDescriptor: PropertyDescriptor | undefined
  beforeEach(() => {
    windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: undefined })
  })
  afterEach(() => {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor)
    else delete (globalThis as Record<string, unknown>).window
  })

  it('isPrintAvailable не зависит от window — разметка не меняется между SSG и гидрацией', () => {
    expect(typeof window).toBe('undefined')
    // Web-ответ не спрашивает и native-модуль: даже без него на сайте печатать есть чем.
    mockRequireOptionalNativeModule.mockReturnValue(null)
    const web = require('@/utils/printHtml.web') as typeof import('@/utils/printHtml.web')
    expect(web.isPrintAvailable()).toBe(true)
    expect(
      (jest.requireActual('@/utils/printAvailability.web') as typeof import('@/utils/printAvailability.web')).isPrintAvailable()
    ).toBe(true)
    expect(mockRequireOptionalNativeModule).not.toHaveBeenCalled()
  })
})
