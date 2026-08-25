import { Alert, Platform } from 'react-native'

import { confirmAction } from '@/utils/confirmAction'
import {
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from '@/components/ui/confirmDialogStore'

// #1556: на web `confirmAction` больше не зовёт нативный `window.confirm` (он
// синхронно морозил вкладку) — запрос уходит в `ConfirmDialogHost` через общий
// стор. Отдельно проверяется снятый опасный дефолт: без хоста промис резолвится
// `false`, а не `true`, иначе удаление выполнялось бы без подтверждения.
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

  it('web: без смонтированного хоста резолвит false, а не выполняет действие', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(confirmAction(options)).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()

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
