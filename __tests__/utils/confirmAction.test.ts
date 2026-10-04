import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Alert, Platform } from 'react-native'

import { confirmAction } from '@/utils/confirmAction'
import {
  CONFIRM_DIALOG_HOST_TIMEOUT_MS,
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from '@/components/ui/confirmDialogStore'

// #1556: на web `confirmAction` больше не зовёт нативный `window.confirm` (он
// синхронно морозил вкладку) — запрос уходит в `ConfirmDialogHost` через общий
// стор. Отдельно проверяется снятый опасный дефолт: если хост недоступен после
// таймаута, промис резолвится `false`, а не `true`, иначе удаление выполнялось
// бы без подтверждения.
describe('confirmAction', () => {
  const options = {
    title: 'Очистить историю?',
    message: 'Список просмотренных будет очищен.',
    confirmText: 'Очистить',
    cancelText: 'Отмена',
  }

  let unsubscribe: (() => void) | null = null
  const originalPlatform = Platform.OS

  const mountHost = () => {
    unsubscribe = subscribeConfirmDialog(() => {})
  }

  beforeEach(() => {
    jest.clearAllMocks()
    unsubscribe = null
  })

  afterEach(() => {
    unsubscribe?.()
    // Хвост незакрытого диалога не должен утекать в соседний тест.
    resolveConfirmDialog(false)
    jest.useRealTimers()
    ;(Platform as { OS: string }).OS = originalPlatform
  })

  it('web: отдаёт запрос хосту диалога, а не в window.confirm', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const nativeConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
    mountHost()

    const pending = confirmAction(options)

    expect(nativeConfirm).not.toHaveBeenCalled()
    expect(getConfirmDialogRequest()).toMatchObject({
      title: options.title,
      message: options.message,
      confirmText: 'Очистить',
      cancelText: 'Отмена',
    })

    resolveConfirmDialog(true)
    await expect(pending).resolves.toBe(true)
    expect(getConfirmDialogRequest()).toBeNull()

    nativeConfirm.mockRestore()
  })

  it('web: отмена и Escape резолвят false — деструктивное действие не выполняется', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    mountHost()

    const pending = confirmAction(options)
    resolveConfirmDialog(false)

    await expect(pending).resolves.toBe(false)
  })

  it('web: ждёт ленивый хост, но без него резолвит false по таймауту', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.useFakeTimers()

    const pending = confirmAction(options)
    expect(getConfirmDialogRequest()).toMatchObject({ title: options.title })

    jest.advanceTimersByTime(CONFIRM_DIALOG_HOST_TIMEOUT_MS)

    await expect(pending).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  it('web: подключившийся хост снимает таймаут и оставляет решение пользователю', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.useFakeTimers()

    const pending = confirmAction(options)
    mountHost()
    jest.advanceTimersByTime(CONFIRM_DIALOG_HOST_TIMEOUT_MS * 2)

    expect(getConfirmDialogRequest()).toMatchObject({ title: options.title })
    expect(warn).not.toHaveBeenCalled()

    resolveConfirmDialog(true)
    await expect(pending).resolves.toBe(true)

    warn.mockRestore()
  })

  it('web: без явных подписей кнопок уходят дефолтные ключи хелпера', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    mountHost()

    const pending = confirmAction({ title: options.title, message: options.message })

    const request = getConfirmDialogRequest()
    expect(request?.confirmText).toBeTruthy()
    expect(request?.cancelText).toBeTruthy()

    resolveConfirmDialog(false)
    await expect(pending).resolves.toBe(false)
  })

  // #2127: web-ветка не трогает Alert.alert (в react-native-web он пустой и вопрос
  // молча терялся бы), native-ветка — единственный владелец системного Alert.
  it('web: Alert.alert не вызывается — вопрос идёт только в ConfirmDialogHost', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mountHost()

    const pending = confirmAction(options)
    expect(alert).not.toHaveBeenCalled()
    resolveConfirmDialog(false)
    await expect(pending).resolves.toBe(false)

    alert.mockRestore()
  })

  it('native: один системный Alert с «Отмена» и деструктивным подтверждением', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const pending = confirmAction(options)

    expect(alert).toHaveBeenCalledTimes(1)
    const [title, message, buttons] = alert.mock.calls[0] as unknown as [
      string,
      string,
      Array<{ text: string; style?: string; onPress?: () => void }>,
    ]
    expect(title).toBe(options.title)
    expect(message).toBe(options.message)
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['Отмена', 'cancel'],
      ['Очистить', 'destructive'],
    ])
    expect(getConfirmDialogRequest()).toBeNull()
    buttons[1].onPress?.()
    await expect(pending).resolves.toBe(true)

    alert.mockRestore()
  })

  it('native: закрытие Alert без выбора (Android «Назад») — отказ, промис не висит', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const pending = confirmAction(options)
    const alertOptions = alert.mock.calls[0][3] as unknown as { cancelable?: boolean; onDismiss?: () => void }
    expect(alertOptions.cancelable).toBe(true)
    alertOptions.onDismiss?.()
    await expect(pending).resolves.toBe(false)

    alert.mockRestore()
  })

  it('owned #1556 call sites have no executable window.confirm', () => {
    const files = [
      'utils/confirmAction.ts',
      'components/listTravel/RecommendationsTabs.tsx',
      'components/screens/calendar/CalendarScreen.tsx',
      'components/map/EditMarkerModal.tsx',
    ]
    const executableConfirm = /window\.confirm\s*\(/
    for (const file of files) {
      const source = readFileSync(join(process.cwd(), file), 'utf8')
      const executable = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect({ file, hasWindowConfirm: executableConfirm.test(executable) }).toEqual({
        file,
        hasWindowConfirm: false,
      })
    }
  })

  it('native: остаётся на Alert.alert и не трогает web-хост', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mountHost()

    const pending = confirmAction(options)

    expect(alert).toHaveBeenCalledTimes(1)
    expect(getConfirmDialogRequest()).toBeNull()

    const [, , buttons] = alert.mock.calls[0] as unknown as [
      string,
      string,
      Array<{ text: string; onPress?: () => void }>,
    ]
    buttons[1].onPress?.()
    await expect(pending).resolves.toBe(true)

    alert.mockRestore()
  })
})
