import { useSyncExternalStore } from 'react'

import { i18n } from '@/i18n'
import { getQuestContentLocale } from '@/api/questContentLocale'

const subscribe = (onChange: () => void) => {
  i18n.on('languageChanged', onChange)
  return () => {
    i18n.off('languageChanged', onChange)
  }
}

/**
 * Локаль контента квестов для ключей запросов (#2197): тот же резолвер, что у
 * не-хуковых чтений, плюс подписка на смену языка, поэтому переключение языка
 * меняет ключ и перезапрашивает квест без перезагрузки. Подписка идёт на
 * экземпляр i18n, которым управляет `LocaleProvider`: `useLocale()` бросает вне
 * провайдера, а квестовые хуки рендерятся и без него (тесты, изолированные
 * деревья).
 */
export function useQuestContentLocale(): string {
  return useSyncExternalStore(subscribe, getQuestContentLocale, getQuestContentLocale)
}
