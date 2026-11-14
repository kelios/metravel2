// utils/shareOrCopy.ts
// Одна схема «системный шаринг, иначе копирование ссылки» (#3379): на Android и
// iOS — системный лист `Share.share`, в браузере — Web Share API, а где его нет
// (десктоп) — копирование текста. Отмена листа — не ошибка.

import { Platform, Share, type ShareContent, type ShareOptions } from 'react-native'

import { devWarn } from '@/utils/logger'

export type ShareOrCopyOutcome = 'shared' | 'copied' | 'dismissed' | 'unavailable' | 'failed'

export type ShareOrCopyRequest = {
  web: { title: string; text: string; url: string }
  native: ShareContent
  nativeOptions?: ShareOptions
  copyText: string
  copy?: (text: string) => Promise<unknown>
}

const isAbort = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'

const browserClipboard = (): ((text: string) => Promise<unknown>) | null =>
  typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function'
    ? (text) => navigator.clipboard.writeText(text)
    : null

export async function shareOrCopy({
  web,
  native,
  nativeOptions,
  copyText,
  copy,
}: ShareOrCopyRequest): Promise<ShareOrCopyOutcome> {
  try {
    if (Platform.OS !== 'web') {
      const result = await Share.share(native, nativeOptions)
      return result.action === Share.sharedAction ? 'shared' : 'dismissed'
    }
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      await navigator.share(web)
      return 'shared'
    }
    const write = copy ?? browserClipboard()
    if (!write) return 'unavailable'
    await write(copyText)
    return 'copied'
  } catch (error) {
    if (isAbort(error)) return 'dismissed'
    devWarn('[shareOrCopy] share failed', error)
    return 'failed'
  }
}
