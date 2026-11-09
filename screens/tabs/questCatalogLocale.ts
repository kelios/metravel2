import { createContext } from 'react'
import type { SupportedLocale } from '@/i18n/config'

/** #3217: the locale hub `/{locale}/quests` — its cards open the same-language detail. */
export const QuestCatalogLocaleContext = createContext<Exclude<SupportedLocale, 'ru'> | null>(null)
