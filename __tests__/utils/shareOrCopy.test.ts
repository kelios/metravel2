import { Platform, Share } from 'react-native'

import { shareOrCopy } from '@/utils/shareOrCopy'

const request = {
  web: { title: 'Квест', text: 'Пройди квест', url: 'https://metravel.by/quests/4/q' },
  native: { title: 'Квест', message: 'Пройди квест https://metravel.by/quests/4/q' },
  nativeOptions: { dialogTitle: 'Поделиться' },
  copyText: 'https://metravel.by/quests/4/q',
}

describe('shareOrCopy (#3379)', () => {
  const originalPlatform = Platform.OS
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const setNavigator = (value: unknown) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value })
  const setOs = (value: string) => Object.defineProperty(Platform, 'OS', { configurable: true, value })

  afterEach(() => {
    jest.restoreAllMocks()
    setOs(originalPlatform)
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
    else delete (globalThis as { navigator?: Navigator }).navigator
  })

  it.each([
    [Share.sharedAction, 'shared'],
    [Share.dismissedAction, 'dismissed'],
  ])('opens the system sheet on native and maps %s to %s', async (action, outcome) => {
    setOs('android')
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action } as never)
    await expect(shareOrCopy(request)).resolves.toBe(outcome)
    expect(share).toHaveBeenCalledWith(request.native, request.nativeOptions)
  })

  it('uses Web Share in a browser that has it, without copying', async () => {
    setOs('web')
    const share = jest.fn().mockResolvedValue(undefined)
    const writeText = jest.fn()
    setNavigator({ share, clipboard: { writeText } })
    await expect(shareOrCopy(request)).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(request.web)
    expect(writeText).not.toHaveBeenCalled()
  })

  it('copies the text through the browser clipboard by default, or the given writer', async () => {
    setOs('web')
    const writeText = jest.fn().mockResolvedValue(undefined)
    setNavigator({ clipboard: { writeText } })
    await expect(shareOrCopy(request)).resolves.toBe('copied')
    expect(writeText).toHaveBeenCalledWith(request.copyText)

    const copy = jest.fn().mockResolvedValue(true)
    await expect(shareOrCopy({ ...request, copy })).resolves.toBe('copied')
    expect(copy).toHaveBeenCalledWith(request.copyText)
    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('reports unavailable without share or clipboard, dismissed on abort, failed on other errors', async () => {
    setOs('web')
    setNavigator({})
    await expect(shareOrCopy(request)).resolves.toBe('unavailable')
    setNavigator({ share: jest.fn().mockRejectedValue({ name: 'AbortError' }) })
    await expect(shareOrCopy(request)).resolves.toBe('dismissed')
    setNavigator({ share: jest.fn().mockRejectedValue(new Error('denied')) })
    await expect(shareOrCopy(request)).resolves.toBe('failed')
  })
})
