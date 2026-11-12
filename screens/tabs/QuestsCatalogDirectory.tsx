import type { SupportedLocale } from '@/i18n/config'
import type { QuestMeta } from './questsShared'

export type QuestDirectoryLink = { title: string; path: string }

export const QUEST_DIRECTORY_QUEST_LIMIT = 24

type Props = {
  countries: readonly QuestDirectoryLink[]
  cities: readonly QuestDirectoryLink[]
  quests: readonly Pick<QuestMeta, 'id' | 'cityId' | 'title'>[]
  /** #3360: языковой хаб — ссылки на страницы его языка, все участники. */
  localeHub?: Exclude<SupportedLocale, 'ru'> | null
}

/**
 * Указатель каталога — ссылочный HTML для сайта (#3218). В приложении страны и
 * города выбираются в фильтре каталога, отдельного списка ссылок там нет.
 */
export default function QuestsCatalogDirectory(_props: Props) {
  return null
}
