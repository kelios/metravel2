const mockOpenExternalUrl = jest.fn<Promise<boolean>, [string, unknown?]>()
const mockSetStringAsync = jest.fn<Promise<void>, [string]>()
const mockShowToastMessage = jest.fn()

jest.mock('@/utils/externalLinks', () => ({
  openExternalUrl: (...args: [string, unknown?]) => mockOpenExternalUrl(...args),
}))

jest.mock('@/utils/toast', () => ({
  showToastMessage: (...args: unknown[]) => mockShowToastMessage(...args),
}))

jest.mock('@/components/quests/questWizardMedia', () => ({
  getQuestClipboard: async () => ({ setStringAsync: (value: string) => mockSetStringAsync(value) }),
}))

import { Alert, Platform } from 'react-native'
import { confirmQuestAsync, copyQuestCoords, openQuestMap } from '@/components/quests/questWizardHelpers'
import {
  CONFIRM_DIALOG_HOST_TIMEOUT_MS,
  getConfirmDialogRequest,
  resolveConfirmDialog,
  subscribeConfirmDialog,
} from '@/components/ui/confirmDialogStore'

describe('questWizardHelpers.openQuestMap', () => {
  const point = { lat: 53.9, lng: 27.56, title: 'Площадь Победы' }

  beforeEach(() => {
    jest.clearAllMocks()
    mockOpenExternalUrl.mockResolvedValue(true)
    ;(Platform as { OS: string }).OS = 'web'
  })

  it('opens a Google Maps search URL with the point coordinates', async () => {
    const opened = await openQuestMap(point, 'google')

    expect(opened).toBe(true)
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'https://www.google.com/maps/search/?api=1&query=53.9,27.56',
    )
  })

  it('opens an Apple Maps URL for the apple target', async () => {
    await openQuestMap(point, 'apple')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe('http://maps.apple.com/?ll=53.9,27.56')
  })

  it('opens a Yandex Navigator URL with the point coordinates', async () => {
    await openQuestMap(point, 'yandex')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'https://yandex.ru/navi/?whatshere[point]=27.56,53.9&whatshere[zoom]=16',
    )
  })

  it('falls back through Organic Maps candidates until one succeeds', async () => {
    // On web: Organic Maps candidates must keep marker coordinates in query params.
    // geo: is skipped (Platform.OS='web').
    mockOpenExternalUrl.mockResolvedValueOnce(false)
    mockOpenExternalUrl.mockResolvedValueOnce(false)
    mockOpenExternalUrl.mockResolvedValueOnce(true)

    const opened = await openQuestMap(point, 'organic')

    expect(opened).toBe(true)
    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'https://omaps.app/map?v=1&ll=53.9,27.56&n=%D0%9F%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B',
    )
    expect(mockOpenExternalUrl.mock.calls[1][0]).toBe(
      'https://omaps.app/map?v=1&ll=53.9,27.56&n=%D0%9F%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B',
    )
    expect(mockOpenExternalUrl.mock.calls[2][0]).toBe(
      'https://www.google.com/maps/search/?api=1&query=53.9,27.56',
    )
    // Should stop once one candidate opened.
    expect(mockOpenExternalUrl).toHaveBeenCalledTimes(3)
  })

  it('opens Waze and OpenStreetMap from quest navigation', async () => {
    await openQuestMap(point, 'waze')
    await openQuestMap(point, 'osm')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe('https://waze.com/ul?ll=53.9,27.56&navigate=yes')
    expect(mockOpenExternalUrl.mock.calls[1][0]).toBe(
      'https://www.openstreetmap.org/?mlat=53.9&mlon=27.56#map=16/53.9/27.56',
    )
  })

  it('notifies the user when no map candidate could be opened', async () => {
    mockOpenExternalUrl.mockResolvedValue(false)

    const opened = await openQuestMap(point, 'mapsme')

    expect(opened).toBe(false)
    expect(mockShowToastMessage).toHaveBeenCalledTimes(1)
    expect(mockShowToastMessage.mock.calls[0][0]).toMatchObject({ type: 'info' })
  })

  it('encodes the point title for the mapsme deep link', async () => {
    await openQuestMap(point, 'mapsme')

    expect(mockOpenExternalUrl.mock.calls[0][0]).toBe(
      'mapsme://map?ll=53.9,27.56&zoom=17&n=%D0%9F%D0%BB%D0%BE%D1%89%D0%B0%D0%B4%D1%8C%20%D0%9F%D0%BE%D0%B1%D0%B5%D0%B4%D1%8B',
    )
  })
})

describe('questWizardHelpers.copyQuestCoords', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSetStringAsync.mockResolvedValue(undefined)
  })

  it('copies coordinates with fixed 6-decimal precision and notifies the user', async () => {
    await copyQuestCoords({ lat: 53.9006, lng: 27.559 })

    expect(mockSetStringAsync).toHaveBeenCalledWith('53.900600, 27.559000')
    expect(mockShowToastMessage.mock.calls[0][0]).toMatchObject({ text1: 'Координаты скопированы' })
  })
})

describe('questWizardHelpers.confirmQuestAsync', () => {
  // #1555: на web подтверждение больше не идёт через нативный `window.confirm` —
  // он синхронно морозил JS-поток вкладки. Теперь промис резолвит дизайн-системный
  // `ConfirmDialog`, смонтированный как `ConfirmDialogHost` (общий мост, #1556).
  let unsubscribe: (() => void) | null = null

  beforeEach(() => {
    jest.clearAllMocks()
    unsubscribe = null
  })

  afterEach(() => {
    unsubscribe?.()
    // Хвост незакрытого диалога не должен утекать в соседний тест.
    resolveConfirmDialog(false)
    jest.useRealTimers()
  })

  const mountHost = () => {
    unsubscribe = subscribeConfirmDialog(() => {})
  }

  it('web: passes the request to the dialog host instead of calling window.confirm', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const nativeConfirm = jest.spyOn(window, 'confirm').mockReturnValue(true)
    mountHost()

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')

    expect(nativeConfirm).not.toHaveBeenCalled()
    expect(getConfirmDialogRequest()).toMatchObject({
      title: 'Сбросить прогресс?',
      message: 'Все ваши ответы будут удалены.',
    })

    resolveConfirmDialog(true)
    await expect(pending).resolves.toBe(true)
    expect(getConfirmDialogRequest()).toBeNull()

    nativeConfirm.mockRestore()
  })

  it('web: cancel and Escape resolve false, so the destructive action is skipped', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    mountHost()

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')
    resolveConfirmDialog(false)

    await expect(pending).resolves.toBe(false)
  })

  it('web: resolves false when no host is mounted, never leaving the await hanging', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.useFakeTimers()

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')
    expect(getConfirmDialogRequest()).toMatchObject({ title: 'Сбросить прогресс?' })

    jest.advanceTimersByTime(CONFIRM_DIALOG_HOST_TIMEOUT_MS)

    await expect(pending).resolves.toBe(false)
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  it('web: a second request cancels the previous one instead of leaking its promise', async () => {
    ;(Platform as { OS: string }).OS = 'web'
    mountHost()

    const first = confirmQuestAsync('Первый', 'Сообщение')
    const second = confirmQuestAsync('Второй', 'Сообщение')

    await expect(first).resolves.toBe(false)
    expect(getConfirmDialogRequest()).toMatchObject({ title: 'Второй' })

    resolveConfirmDialog(true)
    await expect(second).resolves.toBe(true)
  })

  it('web: unmounting the host with an open dialog resolves false instead of hanging', async () => {
    // #1555 P2: уход со страницы (браузерный Back) не должен оставлять висящий await,
    // а протухший запрос — всплывать призрачным диалогом в следующем инстансе хоста.
    ;(Platform as { OS: string }).OS = 'web'
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const unmount = subscribeConfirmDialog(() => {})

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')
    unmount()

    await expect(pending).resolves.toBe(false)
    expect(getConfirmDialogRequest()).toBeNull()

    warn.mockRestore()
  })

  it('native: still goes through Alert.alert and maps the buttons to the promise', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
    mountHost()

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')

    expect(alert).toHaveBeenCalledTimes(1)
    // Web-хост при этом не задействован: запроса в сторе нет.
    expect(getConfirmDialogRequest()).toBeNull()

    const [, , buttons] = alert.mock.calls[0] as unknown as [string, string, Array<{ text: string; onPress?: () => void }>]
    buttons[1].onPress?.()
    await expect(pending).resolves.toBe(true)

    alert.mockRestore()
  })

  it('native: dismissing the alert resolves false', async () => {
    ;(Platform as { OS: string }).OS = 'android'
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {})

    const pending = confirmQuestAsync('Сбросить прогресс?', 'Все ваши ответы будут удалены.')

    const options = alert.mock.calls[0][3] as unknown as { onDismiss?: () => void }
    options.onDismiss?.()
    await expect(pending).resolves.toBe(false)

    alert.mockRestore()
  })
})
